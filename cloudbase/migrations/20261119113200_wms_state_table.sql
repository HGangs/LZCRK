create table if not exists public.wms_state (
  id text primary key,
  payload jsonb not null,
  rev bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text default ''
);
create index if not exists wms_state_updated_idx on public.wms_state (updated_at desc);
alter table public.wms_state enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'wms_state' and policyname = 'wms_state_read') then
    create policy wms_state_read on public.wms_state for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'wms_state' and policyname = 'wms_state_write') then
    create policy wms_state_write on public.wms_state for all to authenticated using (true) with check (true);
  end if;
end $$;
grant select on public.wms_state to anon;
grant select, insert, update, delete on public.wms_state to authenticated;
