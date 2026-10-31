-- Forward-only migration. Production rollback requires a new migration.

create table public.account_preferences (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  display_name text
    check (
      display_name is null
      or char_length(btrim(display_name)) between 1 and 60
    ),
  timezone text not null default 'Europe/Paris'
    check (char_length(timezone) between 1 and 64),
  notify_on_open boolean not null default true,
  notify_on_resolve boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_account_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.timezone
  ) then
    raise exception 'unknown timezone'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger account_preferences_validate_timezone
before insert or update on public.account_preferences
for each row
execute function public.validate_account_timezone();

create trigger account_preferences_set_updated_at
before update on public.account_preferences
for each row
execute function public.set_updated_at();

alter table public.account_preferences enable row level security;

create policy account_preferences_select_member
on public.account_preferences
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy account_preferences_insert_member
on public.account_preferences
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy account_preferences_update_member
on public.account_preferences
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

revoke all on table public.account_preferences from anon;
grant select, insert on table public.account_preferences to authenticated;
grant update (
  display_name,
  timezone,
  notify_on_open,
  notify_on_resolve,
  updated_at
) on table public.account_preferences to authenticated;

alter table public.notification_outbox
  drop constraint notification_outbox_status_check;

alter table public.notification_outbox
  add constraint notification_outbox_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'dead', 'skipped'));

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

  update public.notification_outbox as outbox
  set
    status = 'skipped',
    next_attempt_at = null,
    last_error_code = 'preference_disabled'
  from public.account_preferences as preferences
  where preferences.tenant_id = outbox.tenant_id
    and outbox.status in ('pending', 'failed')
    and (
      (outbox.kind = 'incident_opened' and not preferences.notify_on_open)
      or (outbox.kind = 'incident_resolved'
        and not preferences.notify_on_resolve)
    );

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

comment on table public.account_preferences is
  'Per-tenant display and alert preferences. No credentials or contact data.';
