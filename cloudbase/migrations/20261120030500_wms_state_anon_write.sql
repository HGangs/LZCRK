grant select, insert, update, delete on public.wms_state to anon;
grant select on public.wms_state_history to anon;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname='public' and tablename='wms_state' and policyname='wms_state_write_anon'
  ) then
    create policy wms_state_write_anon on public.wms_state
      for all to anon using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname='public' and tablename='wms_state_history' and policyname='wms_hist_write_anon'
  ) then
    create policy wms_hist_write_anon on public.wms_state_history
      for all to anon using (true) with check (true);
  end if;
end $$;
