-- Phase 5: mirror the Telegram waitlist in the client cabinet.
-- Run after phase-1-foundation.sql and phase-2-client-cabinet.sql.

create table if not exists public.crm_waitlist (
  id uuid primary key default gen_random_uuid(),
  source_id bigint not null unique,
  client_source_id bigint not null references public.crm_clients(source_id) on delete cascade,
  session_source_id bigint not null references public.crm_sessions(source_id) on delete cascade,
  status text not null check (status in ('waiting', 'offered', 'accepted', 'expired', 'cancelled')),
  offered_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null,
  synced_at timestamptz not null default now()
);

create index if not exists crm_waitlist_client_idx on public.crm_waitlist(client_source_id, status);
create index if not exists crm_waitlist_session_idx on public.crm_waitlist(session_source_id, status);

alter table public.crm_waitlist enable row level security;

drop policy if exists "Owner reads waitlist" on public.crm_waitlist;
create policy "Owner reads waitlist" on public.crm_waitlist
for select to authenticated
using ((select public.current_role()) = 'owner');

drop policy if exists "Client reads own waitlist" on public.crm_waitlist;
create policy "Client reads own waitlist" on public.crm_waitlist
for select to authenticated
using (
  (select public.current_role()) = 'client'
  and client_source_id = any(public.current_client_source_ids())
);
