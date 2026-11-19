create table if not exists public.wms_state_history (
  id bigserial primary key,
  doc_id text not null default 'main',
  rev bigint not null,
  payload jsonb not null,
  updated_at timestamptz,
  updated_by text default '',
  archived_at timestamptz not null default now(),
  archived_by text default 'auto'
);
create index if not exists wms_state_history_doc_idx on public.wms_state_history (doc_id, archived_at desc);

alter table public.wms_state_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wms_state_history' and policyname='wms_hist_read') then
    create policy wms_hist_read on public.wms_state_history for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wms_state_history' and policyname='wms_hist_write') then
    create policy wms_hist_write on public.wms_state_history for all to authenticated using (true) with check (true);
  end if;
end $$;

grant select on public.wms_state_history to anon;
grant select, insert, update, delete on public.wms_state_history to authenticated;
grant usage, select on sequence public.wms_state_history_id_seq to authenticated;

create or replace function public.wms_archive_state() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.wms_state_history (doc_id, rev, payload, updated_at, updated_by, archived_by)
  values (OLD.id, OLD.rev, OLD.payload, OLD.updated_at, OLD.updated_by, 'auto');

  delete from public.wms_state_history h
   where h.doc_id = OLD.id
     and h.id not in (
       select id from public.wms_state_history
        where doc_id = OLD.id
        order by archived_at desc, id desc
        limit 30);

  return NEW;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'wms_state_archive'
       and tgrelid = 'public.wms_state'::regclass
  ) then
    create trigger wms_state_archive before update on public.wms_state
    for each row execute function public.wms_archive_state();
  end if;
end $$;
