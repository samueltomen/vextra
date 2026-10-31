-- Forward-only migration. Production rollback requires a new migration.
-- Public status page: one page per tenant, exposing only the monitors the
-- tenant explicitly selected, through a narrow read function.

create table public.status_pages (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text
    check (description is null or char_length(description) <= 280),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger status_pages_set_updated_at
before update on public.status_pages
for each row
execute function public.set_updated_at();

alter table public.monitors
  add column show_on_status_page boolean not null default false;

alter table public.status_pages enable row level security;

create policy status_pages_select_member
on public.status_pages
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy status_pages_insert_member
on public.status_pages
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy status_pages_update_member
on public.status_pages
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy status_pages_delete_member
on public.status_pages
for delete
to authenticated
using (public.is_tenant_member(tenant_id));

revoke all on table public.status_pages from anon;
grant select, insert, delete on table public.status_pages to authenticated;
grant update (slug, title, description, enabled, updated_at)
  on table public.status_pages to authenticated;
grant update (show_on_status_page) on table public.monitors to authenticated;

-- Atomic save under the caller's RLS: the page and the exposed monitors change
-- together, and only monitors of the same tenant can be selected.
create or replace function public.save_status_page(
  p_tenant_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_enabled boolean,
  p_monitor_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.status_pages (tenant_id, slug, title, description, enabled)
  values (p_tenant_id, p_slug, p_title, p_description, p_enabled)
  on conflict (tenant_id) do update
    set slug = excluded.slug,
        title = excluded.title,
        description = excluded.description,
        enabled = excluded.enabled;

  update public.monitors
  set show_on_status_page = (id = any (coalesce(p_monitor_ids, '{}')))
  where tenant_id = p_tenant_id
    and show_on_status_page is distinct from
      (id = any (coalesce(p_monitor_ids, '{}')));
end;
$$;

revoke all on function public.save_status_page(uuid, text, text, text, boolean, uuid[])
  from public, anon;
grant execute on function public.save_status_page(uuid, text, text, text, boolean, uuid[])
  to authenticated;

-- Public read model. Returns names, states, availability and recent incidents
-- only: never ids, tokens, schedules, notes or tenant data.
create or replace function public.get_public_status_page(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page public.status_pages%rowtype;
  v_result jsonb;
begin
  select * into v_page
  from public.status_pages
  where slug = p_slug and enabled;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'title', v_page.title,
    'description', v_page.description,
    'generatedAt', now(),
    'monitors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', coalesce(m.name, 'Service ' || m.rn),
          'status', m.public_status,
          'uptime30d', m.uptime
        )
        order by m.rn
      )
      from (
        select
          row_number() over (order by mo.created_at, mo.id) as rn,
          mo.name,
          case
            when not mo.enabled or mo.paused_at is not null then 'paused'
            else mo.status
          end as public_status,
          case
            when extract(epoch from (now() - greatest(mo.created_at, now() - interval '30 days'))) < 60
              then 100
            else round(
              100 * (1 - least(1, coalesce((
                select sum(extract(epoch from (
                  least(coalesce(i.resolved_at, now()), now())
                  - greatest(i.opened_at, greatest(mo.created_at, now() - interval '30 days'))
                )))
                from public.incidents i
                where i.monitor_id = mo.id
                  and coalesce(i.resolved_at, now()) > greatest(mo.created_at, now() - interval '30 days')
              ), 0) / extract(epoch from (now() - greatest(mo.created_at, now() - interval '30 days'))))),
              3
            )
          end as uptime
        from public.monitors mo
        where mo.tenant_id = v_page.tenant_id and mo.show_on_status_page
      ) m
    ), '[]'::jsonb),
    'incidents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'monitor', coalesce(x.name, 'Service ' || x.rn),
          'openedAt', x.opened_at,
          'resolvedAt', x.resolved_at
        )
        order by x.opened_at desc
      )
      from (
        select
          row_number() over (order by mo.created_at, mo.id) as rn,
          mo.name, i.opened_at, i.resolved_at
        from public.incidents i
        join public.monitors mo
          on mo.tenant_id = i.tenant_id and mo.id = i.monitor_id
        where mo.tenant_id = v_page.tenant_id
          and mo.show_on_status_page
          and i.opened_at > now() - interval '14 days'
        order by i.opened_at desc
        limit 20
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_public_status_page(text) from public;
grant execute on function public.get_public_status_page(text)
  to anon, authenticated, service_role;

comment on table public.status_pages is
  'One public status page per tenant. Only monitors flagged show_on_status_page are exposed.';
