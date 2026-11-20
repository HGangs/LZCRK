create table if not exists public.wms_backup (
  id bigserial primary key,
  doc_id text not null default 'main',
  day date not null,
  kind text not null default 'auto',
  payload jsonb not null,
  size_bytes integer default 0,
  counts jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text default ''
);
create unique index if not exists wms_backup_day_kind_uidx on public.wms_backup (doc_id, day, kind);
create index if not exists wms_backup_created_idx on public.wms_backup (created_at desc);
alter table public.wms_backup enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wms_backup' and policyname='wms_backup_all') then
    create policy wms_backup_all on public.wms_backup for all to anon, authenticated using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.wms_backup to anon, authenticated;
grant usage, select on sequence public.wms_backup_id_seq to anon, authenticated;
