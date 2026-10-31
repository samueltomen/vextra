-- Forward-only migration. Production rollback requires a new migration.

alter table public.monitors
  add column name text
    check (name is null or char_length(btrim(name)) between 1 and 80),
  add column description text
    check (description is null or char_length(description) <= 200),
  add column notes text
    check (notes is null or char_length(notes) <= 2000),
  add column alerts_enabled boolean not null default true;

grant update (name, description, notes, alerts_enabled)
  on table public.monitors to authenticated;

comment on column public.monitors.name is
  'Optional user label shown in the app and in alert e-mails. No secrets.';
comment on column public.monitors.alerts_enabled is
  'When false, alert deliveries of this monitor are skipped.';

alter table public.account_preferences
  add column time_format text not null default '24h'
    check (time_format in ('12h', '24h')),
  add column density text not null default 'compact'
    check (density in ('compact', 'comfortable')),
  add column default_view text not null default 'list'
    check (default_view in ('list', 'grid')),
  add column default_sort text not null default 'priority'
    check (default_sort in ('priority', 'name', 'signal', 'recent')),
  add column default_interval_minutes integer not null default 60
    check (default_interval_minutes between 1 and 525600),
  add column default_grace_minutes integer not null default 5
    check (default_grace_minutes between 0 and 10080),
  add column default_folder_id uuid;

alter table public.account_preferences
  add constraint account_preferences_default_folder_fk
  foreign key (tenant_id, default_folder_id)
  references public.monitor_folders (tenant_id, id)
  on delete set null (default_folder_id);

grant update (
  time_format,
  density,
  default_view,
  default_sort,
  default_interval_minutes,
  default_grace_minutes,
  default_folder_id
) on table public.account_preferences to authenticated;

drop function public.claim_notification_deliveries(integer);

create function public.claim_notification_deliveries(
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
      (outbox.kind = 'incident_opened' and not preferences.notify_on_open)
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

revoke all on function public.claim_notification_deliveries(integer)
  from public;
revoke all on function public.claim_notification_deliveries(integer)
  from anon;
revoke all on function public.claim_notification_deliveries(integer)
  from authenticated;
grant execute on function public.claim_notification_deliveries(integer)
  to service_role;
