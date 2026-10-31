-- Forward-only migration. Production rollback requires a new migration.

create table public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null
    check (kind in (
      'webhook', 'slack', 'discord', 'telegram', 'teams', 'pagerduty'
    )),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  target text not null check (char_length(target) between 1 and 600),
  target_hint text not null check (char_length(target_hint) <= 80),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index notification_channels_tenant_name_uidx
  on public.notification_channels (tenant_id, lower(btrim(name)));

create trigger notification_channels_set_updated_at
before update on public.notification_channels
for each row
execute function public.set_updated_at();

create or replace function public.enforce_notification_channel_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.notification_channels
    where tenant_id = new.tenant_id
  ) >= 10 then
    raise exception 'channel limit reached'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

create trigger notification_channels_limit
before insert on public.notification_channels
for each row
execute function public.enforce_notification_channel_limit();

alter table public.notification_channels enable row level security;

create policy notification_channels_select_member
on public.notification_channels
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy notification_channels_insert_member
on public.notification_channels
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy notification_channels_update_member
on public.notification_channels
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy notification_channels_delete_member
on public.notification_channels
for delete
to authenticated
using (public.is_tenant_member(tenant_id));

-- The target (webhook URL, bot token, routing key) is a secret: clients can
-- write it but never read it back. Only the service role reads it, to deliver.
revoke all on table public.notification_channels from anon;
revoke all on table public.notification_channels from authenticated;
grant select (
  id, tenant_id, kind, name, target_hint, enabled, created_at, updated_at
) on table public.notification_channels to authenticated;
grant insert (
  tenant_id, kind, name, target, target_hint, enabled
) on table public.notification_channels to authenticated;
grant update (
  name, target, target_hint, enabled, updated_at
) on table public.notification_channels to authenticated;
grant delete on table public.notification_channels to authenticated;

comment on column public.notification_channels.target is
  'Secret. Write-only for clients; read by the service role at delivery time.';

create table public.channel_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  channel_id uuid not null
    references public.notification_channels (id) on delete cascade,
  monitor_id uuid not null references public.monitors (id) on delete cascade,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  kind text not null
    check (kind in (
      'incident_opened', 'incident_resolved', 'run_failed', 'reminder'
    )),
  idempotency_key text not null unique,
  status text not null default 'pending'
    check (status in (
      'pending', 'processing', 'sent', 'failed', 'dead', 'skipped'
    )),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz default now(),
  claimed_at timestamptz,
  last_error_code text
    check (last_error_code is null or char_length(last_error_code) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index channel_outbox_pending_idx
  on public.channel_outbox (status, next_attempt_at)
  where status in ('pending', 'failed');

create trigger channel_outbox_set_updated_at
before update on public.channel_outbox
for each row
execute function public.set_updated_at();

alter table public.channel_outbox enable row level security;
revoke all on table public.channel_outbox from anon;
revoke all on table public.channel_outbox from authenticated;

alter table public.notification_outbox
  drop constraint notification_outbox_kind_check;
alter table public.notification_outbox
  add constraint notification_outbox_kind_check
  check (kind in (
    'incident_opened', 'incident_resolved', 'run_failed', 'reminder'
  ));

alter table public.incidents add column last_reminder_at timestamptz;

alter table public.account_preferences
  add column reminder_interval_minutes integer
    check (
      reminder_interval_minutes is null
      or reminder_interval_minutes in (60, 360, 1440, 10080)
    );

grant update (reminder_interval_minutes)
  on table public.account_preferences to authenticated;

create or replace function public.fan_out_to_channels()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.channel_outbox (
    tenant_id, channel_id, monitor_id, incident_id, kind, idempotency_key
  )
  select
    new.tenant_id,
    channel.id,
    new.monitor_id,
    new.incident_id,
    new.kind,
    new.idempotency_key || ':' || channel.id::text
  from public.notification_channels as channel
  where channel.tenant_id = new.tenant_id
    and channel.enabled
  on conflict (idempotency_key) do nothing;

  return new;
end;
$$;

revoke all on function public.fan_out_to_channels() from public;
revoke all on function public.fan_out_to_channels() from anon;
revoke all on function public.fan_out_to_channels() from authenticated;

create trigger notification_outbox_fan_out
after insert on public.notification_outbox
for each row
execute function public.fan_out_to_channels();

create or replace function public.claim_channel_deliveries(
  p_batch_size integer
)
returns table (
  delivery_id uuid,
  channel_kind text,
  channel_name text,
  target text,
  monitor_id uuid,
  monitor_name text,
  kind text,
  opened_at timestamptz,
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

  update public.channel_outbox as outbox
  set
    status = 'skipped',
    next_attempt_at = null,
    last_error_code = 'preference_disabled'
  from public.account_preferences as preferences
  where preferences.tenant_id = outbox.tenant_id
    and outbox.status in ('pending', 'failed')
    and (
      (outbox.kind in ('incident_opened', 'run_failed', 'reminder')
        and not preferences.notify_on_open)
      or (outbox.kind = 'incident_resolved'
        and not preferences.notify_on_resolve)
    );

  update public.channel_outbox as outbox
  set
    status = 'skipped',
    next_attempt_at = null,
    last_error_code = 'monitor_muted'
  from public.monitors as muted
  where muted.id = outbox.monitor_id
    and not muted.alerts_enabled
    and outbox.status in ('pending', 'failed');

  update public.channel_outbox as outbox
  set
    status = 'skipped',
    next_attempt_at = null,
    last_error_code = 'channel_disabled'
  from public.notification_channels as disabled
  where disabled.id = outbox.channel_id
    and not disabled.enabled
    and outbox.status in ('pending', 'failed');

  for target_delivery in
    select
      outbox.id,
      channel.kind as channel_kind,
      channel.name as channel_name,
      channel.target,
      outbox.monitor_id,
      monitor.name as monitor_name,
      outbox.kind,
      incident.opened_at,
      outbox.attempts
    from public.channel_outbox as outbox
    join public.notification_channels as channel
      on channel.id = outbox.channel_id
    join public.monitors as monitor
      on monitor.id = outbox.monitor_id
    join public.incidents as incident
      on incident.id = outbox.incident_id
    where outbox.status in ('pending', 'failed')
      and outbox.next_attempt_at <= clock_timestamp()
    order by outbox.next_attempt_at, outbox.created_at
    limit p_batch_size
    for update of outbox skip locked
  loop
    update public.channel_outbox
    set
      status = 'processing',
      attempts = target_delivery.attempts + 1,
      claimed_at = clock_timestamp()
    where id = target_delivery.id;

    delivery_id := target_delivery.id;
    channel_kind := target_delivery.channel_kind;
    channel_name := target_delivery.channel_name;
    target := target_delivery.target;
    monitor_id := target_delivery.monitor_id;
    monitor_name := target_delivery.monitor_name;
    kind := target_delivery.kind;
    opened_at := target_delivery.opened_at;
    attempts := target_delivery.attempts + 1;
    return next;
  end loop;
end;
$$;

create or replace function public.complete_channel_delivery(
  p_delivery_id uuid,
  p_success boolean,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_attempts integer;
begin
  select attempts
  into target_attempts
  from public.channel_outbox
  where id = p_delivery_id
    and status = 'processing'
  for update;

  if not found then
    return false;
  end if;

  update public.channel_outbox
  set
    status = case
      when p_success then 'sent'
      when target_attempts >= 5 then 'dead'
      else 'failed'
    end,
    next_attempt_at = case
      when p_success then null
      when target_attempts >= 5 then null
      when target_attempts = 1 then clock_timestamp() + interval '1 minute'
      when target_attempts = 2 then clock_timestamp() + interval '2 minutes'
      when target_attempts = 3 then clock_timestamp() + interval '5 minutes'
      else clock_timestamp() + interval '15 minutes'
    end,
    last_error_code = case
      when p_success then null
      else left(coalesce(p_error_code, 'delivery_failed'), 64)
    end
  where id = p_delivery_id;

  return true;
end;
$$;

create or replace function public.enqueue_incident_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  enqueued integer;
begin
  with due as (
    select incident.id
    from public.incidents as incident
    join public.monitors as monitor
      on monitor.id = incident.monitor_id
      and monitor.alerts_enabled
    join public.account_preferences as preferences
      on preferences.tenant_id = incident.tenant_id
      and preferences.reminder_interval_minutes is not null
      and preferences.notify_on_open
    where incident.resolved_at is null
      and coalesce(incident.last_reminder_at, incident.opened_at)
        + make_interval(mins => preferences.reminder_interval_minutes)
        <= clock_timestamp()
    for update of incident skip locked
  ),
  marked as (
    update public.incidents as incident
    set last_reminder_at = clock_timestamp()
    from due
    where incident.id = due.id
    returning incident.id, incident.tenant_id, incident.monitor_id
  )
  insert into public.notification_outbox (
    tenant_id, monitor_id, incident_id, kind, idempotency_key
  )
  select
    tenant_id,
    monitor_id,
    id,
    'reminder',
    'reminder:' || id::text || ':'
      || floor(extract(epoch from clock_timestamp()))::bigint::text
  from marked
  on conflict (idempotency_key) do nothing;

  get diagnostics enqueued = row_count;

  return enqueued;
end;
$$;

revoke all on function public.claim_channel_deliveries(integer) from public;
revoke all on function public.claim_channel_deliveries(integer) from anon;
revoke all on function public.claim_channel_deliveries(integer)
  from authenticated;
revoke all on function public.complete_channel_delivery(uuid, boolean, text)
  from public;
revoke all on function public.complete_channel_delivery(uuid, boolean, text)
  from anon;
revoke all on function public.complete_channel_delivery(uuid, boolean, text)
  from authenticated;
revoke all on function public.enqueue_incident_reminders() from public;
revoke all on function public.enqueue_incident_reminders() from anon;
revoke all on function public.enqueue_incident_reminders() from authenticated;

grant execute on function public.claim_channel_deliveries(integer)
  to service_role;
grant execute on function public.complete_channel_delivery(uuid, boolean, text)
  to service_role;
grant execute on function public.enqueue_incident_reminders() to service_role;
