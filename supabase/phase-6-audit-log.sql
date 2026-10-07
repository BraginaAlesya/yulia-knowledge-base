-- Phase 6: owner action history.
-- Run after phase-1-foundation.sql.

drop policy if exists "Owner writes audit log" on public.crm_audit_log;
create policy "Owner writes audit log" on public.crm_audit_log
for insert to authenticated
with check (
  (select public.current_role()) = 'owner'
  and actor_id = (select auth.uid())
);
