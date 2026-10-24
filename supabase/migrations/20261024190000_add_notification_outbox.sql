-- Forward-only migration. Production rollback requires a new migration.

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  monitor_id uuid not null references public.monitors (id) on delete cascade,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  kind text not null check (kind in ('incident_opened', 'incident_resolved')),
  idempotency_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz default now(),
  claimed_at timestamptz,
  last_error_code text
    check (last_error_code is null or char_length(last_error_code) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_outbox_pending_idx
  on public.notification_outbox (status, next_attempt_at)
  where status in ('pending', 'failed');

create trigger notification_outbox_set_updated_at
before update on public.notification_outbox
for each row
execute function public.set_updated_at();

alter table public.notification_outbox enable row level security;

create policy notification_outbox_select_member
on public.notification_outbox
for select
to authenticated
using (public.is_tenant_member(tenant_id));

revoke all on table public.notification_outbox from anon;
grant select on table public.notification_outbox to authenticated;

create or replace function public.record_heartbeat(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  received_at timestamptz := clock_timestamp();
  target_monitor record;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  select
    id,
    interval_seconds,
    grace_seconds
  into target_monitor
  from public.monitors
  where heartbeat_token_hash = p_token_hash
    and enabled
    and status <> 'paused'
  for update;

  if not found then
    return false;
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
    incident_opened_at = null
  where id = target_monitor.id;

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

create or replace function public.open_due_monitor_incidents(
  p_batch_size integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked_at timestamptz := clock_timestamp();
  opened_count integer := 0;
  opened_incident_id uuid;
  target_monitor record;
begin
  if p_batch_size < 1 or p_batch_size > 1000 then
    raise exception 'batch size must be between 1 and 1000'
      using errcode = '22023';
  end if;

  for target_monitor in
    select id, tenant_id
    from public.monitors
    where enabled
      and status not in ('paused', 'late')
      and incident_opened_at is null
      and alert_at <= checked_at
    order by alert_at
    limit p_batch_size
    for update skip locked
  loop
    opened_incident_id := null;

    update public.monitors
    set
      status = 'late',
      incident_opened_at = checked_at
    where id = target_monitor.id;

    insert into public.incidents (tenant_id, monitor_id, opened_at, reason)
    values (
      target_monitor.tenant_id,
      target_monitor.id,
      checked_at,
      'heartbeat_missed'
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
        'incident_opened',
        'incident_opened:' || opened_incident_id::text
      )
      on conflict (idempotency_key) do nothing;

      opened_count := opened_count + 1;
    end if;
  end loop;

  return opened_count;
end;
$$;

create or replace function public.claim_notification_deliveries(
  p_batch_size integer
)
returns table (
  delivery_id uuid,
  monitor_id uuid,
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

  for target_delivery in
    select
      outbox.id,
      outbox.monitor_id,
      outbox.kind,
      outbox.attempts,
      account.email
    from public.notification_outbox as outbox
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
    kind := target_delivery.kind;
    email := target_delivery.email;
    attempts := target_delivery.attempts + 1;
    return next;
  end loop;
end;
$$;

create or replace function public.complete_notification_delivery(
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
  from public.notification_outbox
  where id = p_delivery_id
    and status = 'processing'
  for update;

  if not found then
    return false;
  end if;

  update public.notification_outbox
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

revoke all on function public.claim_notification_deliveries(integer)
  from public;
revoke all on function public.claim_notification_deliveries(integer)
  from anon;
revoke all on function public.claim_notification_deliveries(integer)
  from authenticated;
revoke all on function public.complete_notification_delivery(
  uuid,
  boolean,
  text
) from public;
revoke all on function public.complete_notification_delivery(
  uuid,
  boolean,
  text
) from anon;
revoke all on function public.complete_notification_delivery(
  uuid,
  boolean,
  text
) from authenticated;

grant execute on function public.claim_notification_deliveries(integer)
  to service_role;
grant execute on function public.complete_notification_delivery(
  uuid,
  boolean,
  text
) to service_role;

comment on table public.notification_outbox is
  'Delivery metadata only. Recipient email is resolved at claim time and never stored here.';
