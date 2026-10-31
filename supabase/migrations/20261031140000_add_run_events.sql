-- Forward-only migration. Production rollback requires a new migration.

create table public.monitor_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  monitor_id uuid not null,
  kind text not null check (kind in ('success', 'start', 'fail', 'warn')),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  overlapped boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, monitor_id)
    references public.monitors (tenant_id, id)
    on delete cascade
);

create index monitor_runs_monitor_created_idx
  on public.monitor_runs (monitor_id, created_at desc);

alter table public.monitor_runs enable row level security;

create policy monitor_runs_select_member
on public.monitor_runs
for select
to authenticated
using (public.is_tenant_member(tenant_id));

revoke all on table public.monitor_runs from anon;
grant select on table public.monitor_runs to authenticated;

alter table public.monitors add column running_since timestamptz;

alter table public.monitor_daily_stats
  add column fails integer not null default 0 check (fails >= 0),
  add column duration_count integer not null default 0
    check (duration_count >= 0),
  add column duration_sum_ms bigint not null default 0
    check (duration_sum_ms >= 0),
  add column duration_max_ms integer not null default 0
    check (duration_max_ms >= 0);

alter table public.incidents drop constraint incidents_reason_check;
alter table public.incidents
  add constraint incidents_reason_check
  check (reason in ('heartbeat_missed', 'run_failed'));

alter table public.notification_outbox
  drop constraint notification_outbox_kind_check;
alter table public.notification_outbox
  add constraint notification_outbox_kind_check
  check (kind in ('incident_opened', 'incident_resolved', 'run_failed'));

comment on table public.monitor_runs is
  'Run history (90 days). Kind and duration only: no payload, log, IP or output.';
comment on column public.monitors.running_since is
  'Set by a start ping, cleared by the next success or fail ping.';

create or replace function public.record_heartbeat(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  received_at timestamptz := clock_timestamp();
  gap_seconds integer;
  run_duration integer;
  target_monitor record;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  select
    id,
    tenant_id,
    interval_seconds,
    grace_seconds,
    last_heartbeat_at,
    running_since
  into target_monitor
  from public.monitors
  where heartbeat_token_hash = p_token_hash
    and enabled
    and status <> 'paused'
  for update;

  if not found then
    return false;
  end if;

  if target_monitor.last_heartbeat_at is not null then
    gap_seconds := least(
      greatest(
        floor(
          extract(epoch from (received_at - target_monitor.last_heartbeat_at))
        )::integer,
        0
      ),
      31536000
    );
  end if;

  if target_monitor.running_since is not null then
    run_duration := least(
      greatest(
        floor(
          extract(epoch from (received_at - target_monitor.running_since))
          * 1000
        )::integer,
        0
      ),
      2147483647
    );
  end if;

  update public.monitors
  set
    status = 'healthy',
    last_heartbeat_at = received_at,
    alert_at = received_at
      + make_interval(
        secs => target_monitor.interval_seconds
          + target_monitor.grace_seconds
      ),
    incident_opened_at = null,
    running_since = null,
    total_pings = total_pings + 1
  where id = target_monitor.id;

  insert into public.monitor_runs (
    tenant_id, monitor_id, kind, duration_ms, created_at
  )
  values (
    target_monitor.tenant_id,
    target_monitor.id,
    'success',
    run_duration,
    received_at
  );

  insert into public.monitor_daily_stats as stats (
    monitor_id,
    tenant_id,
    day,
    pings,
    gap_count,
    gap_sum_seconds,
    gap_max_seconds,
    duration_count,
    duration_sum_ms,
    duration_max_ms
  )
  values (
    target_monitor.id,
    target_monitor.tenant_id,
    (received_at at time zone 'utc')::date,
    1,
    case when gap_seconds is null then 0 else 1 end,
    coalesce(gap_seconds, 0),
    coalesce(gap_seconds, 0),
    case when run_duration is null then 0 else 1 end,
    coalesce(run_duration, 0),
    coalesce(run_duration, 0)
  )
  on conflict (monitor_id, day) do update
  set
    pings = stats.pings + 1,
    gap_count = stats.gap_count + excluded.gap_count,
    gap_sum_seconds = stats.gap_sum_seconds + excluded.gap_sum_seconds,
    gap_max_seconds = greatest(stats.gap_max_seconds, excluded.gap_max_seconds),
    duration_count = stats.duration_count + excluded.duration_count,
    duration_sum_ms = stats.duration_sum_ms + excluded.duration_sum_ms,
    duration_max_ms = greatest(stats.duration_max_ms, excluded.duration_max_ms);

  delete from public.monitor_daily_stats
  where monitor_id = target_monitor.id
    and day < (received_at at time zone 'utc')::date - 90;

  delete from public.monitor_runs
  where monitor_id = target_monitor.id
    and created_at < received_at - interval '90 days';

  with resolved as (
    update public.incidents
    set
      resolved_at = received_at,
      resolution_reason = 'heartbeat_received'
    where monitor_id = target_monitor.id
      and resolved_at is null
    returning id, tenant_id, monitor_id
  )
  insert into public.notification_outbox (
    tenant_id,
    monitor_id,
    incident_id,
    kind,
    idempotency_key
  )
  select
    tenant_id,
    monitor_id,
    id,
    'incident_resolved',
    'incident_resolved:' || id::text
  from resolved
  on conflict (idempotency_key) do nothing;

  return true;
end;
$$;

create or replace function public.record_run_event(
  p_token_hash text,
  p_kind text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  received_at timestamptz := clock_timestamp();
  opened_incident_id uuid;
  run_duration integer;
  target_monitor record;
  was_running boolean;
begin
  if p_kind not in ('start', 'fail', 'warn') then
    return false;
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  select
    id,
    tenant_id,
    running_since,
    incident_opened_at
  into target_monitor
  from public.monitors
  where heartbeat_token_hash = p_token_hash
    and enabled
    and status <> 'paused'
  for update;

  if not found then
    return false;
  end if;

  was_running := target_monitor.running_since is not null;

  if p_kind = 'start' then
    update public.monitors
    set running_since = received_at
    where id = target_monitor.id;

    insert into public.monitor_runs (
      tenant_id, monitor_id, kind, overlapped, created_at
    )
    values (
      target_monitor.tenant_id,
      target_monitor.id,
      'start',
      was_running,
      received_at
    );
  elsif p_kind = 'warn' then
    insert into public.monitor_runs (
      tenant_id, monitor_id, kind, created_at
    )
    values (
      target_monitor.tenant_id,
      target_monitor.id,
      'warn',
      received_at
    );
  else
    if was_running then
      run_duration := least(
        greatest(
          floor(
            extract(epoch from (received_at - target_monitor.running_since))
            * 1000
          )::integer,
          0
        ),
        2147483647
      );
    end if;

    insert into public.monitor_runs (
      tenant_id, monitor_id, kind, duration_ms, created_at
    )
    values (
      target_monitor.tenant_id,
      target_monitor.id,
      'fail',
      run_duration,
      received_at
    );

    update public.monitors
    set running_since = null
    where id = target_monitor.id;

    if target_monitor.incident_opened_at is null then
      update public.monitors
      set
        status = 'late',
        incident_opened_at = received_at
      where id = target_monitor.id;

      insert into public.incidents (tenant_id, monitor_id, opened_at, reason)
      values (
        target_monitor.tenant_id,
        target_monitor.id,
        received_at,
        'run_failed'
      )
      on conflict (monitor_id) where resolved_at is null do nothing
      returning id into opened_incident_id;

      if opened_incident_id is not null then
        insert into public.notification_outbox (
          tenant_id,
          monitor_id,
          incident_id,
          kind,
          idempotency_key
        )
        values (
          target_monitor.tenant_id,
          target_monitor.id,
          opened_incident_id,
          'run_failed',
          'run_failed:' || opened_incident_id::text
        )
        on conflict (idempotency_key) do nothing;
      end if;
    end if;

    insert into public.monitor_daily_stats as stats (
      monitor_id, tenant_id, day, fails
    )
    values (
      target_monitor.id,
      target_monitor.tenant_id,
      (received_at at time zone 'utc')::date,
      1
    )
    on conflict (monitor_id, day) do update
    set fails = stats.fails + 1;
  end if;

  delete from public.monitor_runs
  where monitor_id = target_monitor.id
    and created_at < received_at - interval '90 days';

  return true;
end;
$$;

revoke all on function public.record_run_event(text, text) from public;
revoke all on function public.record_run_event(text, text) from authenticated;
grant execute on function public.record_run_event(text, text) to anon;

comment on function public.record_run_event(text, text) is
  'Records a start, fail or warn ping. A fail opens a run_failed incident.';

create or replace function public.claim_notification_deliveries(
  p_batch_size integer
)
returns table (
  delivery_id uuid,
  monitor_id uuid,
  monitor_name text,
  kind text,
  email text,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_delivery record;
begin
  if p_batch_size < 1 or p_batch_size > 1000 then
    raise exception 'batch size must be between 1 and 1000'
      using errcode = '22023';
  end if;

  update public.notification_outbox as outbox
  set
    status = 'skipped',
    next_attempt_at = null,
    last_error_code = 'preference_disabled'
  from public.account_preferences as preferences
  where preferences.tenant_id = outbox.tenant_id
    and outbox.status in ('pending', 'failed')
    and (
      (outbox.kind in ('incident_opened', 'run_failed')
        and not preferences.notify_on_open)
      or (outbox.kind = 'incident_resolved'
        and not preferences.notify_on_resolve)
    );

  update public.notification_outbox as outbox
  set
    status = 'skipped',
    next_attempt_at = null,
    last_error_code = 'monitor_muted'
  from public.monitors as muted
  where muted.id = outbox.monitor_id
    and not muted.alerts_enabled
    and outbox.status in ('pending', 'failed');

  for target_delivery in
    select
      outbox.id,
      outbox.monitor_id,
      monitor.name as monitor_name,
      outbox.kind,
      outbox.attempts,
      account.email
    from public.notification_outbox as outbox
    join public.monitors as monitor
      on monitor.id = outbox.monitor_id
    join public.tenant_memberships as membership
      on membership.tenant_id = outbox.tenant_id
      and membership.role = 'owner'
    join auth.users as account
      on account.id = membership.user_id
    where outbox.status in ('pending', 'failed')
      and outbox.next_attempt_at <= clock_timestamp()
    order by outbox.next_attempt_at, outbox.created_at
    limit p_batch_size
    for update of outbox skip locked
  loop
    update public.notification_outbox
    set
      status = 'processing',
      attempts = target_delivery.attempts + 1,
      claimed_at = clock_timestamp()
    where id = target_delivery.id;

    delivery_id := target_delivery.id;
    monitor_id := target_delivery.monitor_id;
    monitor_name := target_delivery.monitor_name;
    kind := target_delivery.kind;
    email := target_delivery.email;
    attempts := target_delivery.attempts + 1;
    return next;
  end loop;
end;
$$;
