-- Forward-only migration. Production rollback requires a new migration.

create or replace function public.valid_monitor_tags(p_tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_tags is not null
    and coalesce(cardinality(p_tags), 0) <= 10
    and not exists (
      select 1
      from unnest(p_tags) as tag
      where tag is null or tag !~ '^[a-z0-9][a-z0-9_-]{0,23}$'
    )
    and (select count(distinct tag) from unnest(p_tags) as tag)
      = coalesce(cardinality(p_tags), 0);
$$;

alter table public.monitors
  add column tags text[] not null default '{}'
    check (public.valid_monitor_tags(tags));

create index monitors_tags_idx on public.monitors using gin (tags);

grant update (tags) on table public.monitors to authenticated;

comment on column public.monitors.tags is
  'Up to 10 distinct lowercase labels (a-z, 0-9, dash, underscore) used to filter monitors.';
