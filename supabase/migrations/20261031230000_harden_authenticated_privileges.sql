-- Forward-only migration. Production rollback requires a new migration.
-- Security hardening found by the pre-production audit.
--
-- Supabase grants every new table to anon / authenticated / service_role by
-- default. Earlier migrations only removed anon, so authenticated kept full
-- table privileges (including TRUNCATE, which Row Level Security does not
-- cover) and the column-level UPDATE grants were purely additive. Clients can
-- sign in directly against the auth API and call PostgREST with their own JWT,
-- so database privileges are the real boundary, not the application layer.
-- This migration makes the privileges match the documented intent.

revoke all on table
  public.tenants,
  public.tenant_memberships,
  public.monitors,
  public.incidents,
  public.notification_outbox,
  public.monitor_folders,
  public.monitor_runs,
  public.monitor_daily_stats,
  public.account_preferences,
  public.status_pages,
  public.maintenance_windows
from authenticated;

-- Read-only tables (writes go through security definer functions or the
-- service role).
grant select on table
  public.tenants,
  public.tenant_memberships,
  public.incidents,
  public.notification_outbox,
  public.monitor_runs,
  public.monitor_daily_stats
to authenticated;

-- Monitors: the heartbeat token hash is never readable, and clients can only
-- write the descriptive columns. State (status, deadlines, counters) changes
-- through the lifecycle functions.
grant select (
  id, tenant_id, heartbeat_token_prefix, interval_seconds, grace_seconds,
  status, last_heartbeat_at, alert_at, incident_opened_at, paused_at, enabled,
  created_at, updated_at, folder_id, total_pings, name, description, notes,
  alerts_enabled, running_since, cron_expression, cron_timezone,
  cron_deadline_stale, show_on_status_page, tags
) on table public.monitors to authenticated;

grant insert (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, status, last_heartbeat_at, alert_at,
  incident_opened_at, paused_at, enabled, cron_expression, cron_timezone,
  cron_deadline_stale
) on table public.monitors to authenticated;

grant delete on table public.monitors to authenticated;

grant update (
  folder_id, name, description, notes, alerts_enabled, tags,
  show_on_status_page, updated_at
) on table public.monitors to authenticated;

grant select, insert, delete on table public.monitor_folders to authenticated;
grant update (name, updated_at) on table public.monitor_folders
  to authenticated;

grant select, insert, delete on table public.status_pages to authenticated;
grant update (slug, title, description, enabled, updated_at)
  on table public.status_pages to authenticated;

grant select, insert, delete on table public.maintenance_windows
  to authenticated;

grant select, insert on table public.account_preferences to authenticated;
grant update (
  display_name, timezone, notify_on_open, notify_on_resolve, updated_at,
  time_format, density, default_view, default_sort, default_interval_minutes,
  default_grace_minutes, default_folder_id, reminder_interval_minutes,
  weekly_report_enabled
) on table public.account_preferences to authenticated;

-- Future objects created by migrations start with no client privilege: every
-- table and function must be granted explicitly, as the migrations already do.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
