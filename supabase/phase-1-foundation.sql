-- Phase 1: safe shared foundation for the bot, CRM and future web cabinets.
-- Run this once in Supabase SQL Editor AFTER schema.sql and operations.sql.
-- It is intentionally data-only: it does not create client access yet.

alter table public.crm_clients
  add column if not exists email text,
  add column if not exists photo_url text,
  add column if not exists access_state text not null default 'not_ready'
    check (access_state in ('not_ready', 'eligible', 'invited', 'active', 'blocked'));

alter table public.crm_sessions
  add column if not exists trainer_source_id bigint;

alter table public.crm_bookings
  add column if not exists payment_required boolean not null default false;

create table if not exists public.crm_trainers (
  id uuid primary key default gen_random_uuid(),
  source_id bigint not null unique,
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  photo_url text,
  is_active boolean not null default true,
  synced_at timestamptz not null default now()
);

-- One web account can represent the account holder and one or more children.
-- Passwords are never stored here; Supabase Auth owns their protected hashes.
create table if not exists public.crm_account_clients (
  account_id uuid not null references public.profiles(id) on delete cascade,
  client_source_id bigint not null references public.crm_clients(source_id) on delete cascade,
  relationship text not null check (relationship in ('self', 'guardian')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (account_id, client_source_id)
);

-- Health notes are deliberately not mirrored from the general CRM.  They are
-- added later only with explicit consent and are visible to the owner and the
-- trainer running the client's practice.
create table if not exists public.crm_health_notes (
  id uuid primary key default gen_random_uuid(),
  client_source_id bigint not null unique references public.crm_clients(source_id) on delete cascade,
  note_text text not null,
  consent_at timestamptz not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.crm_sync_state (
  source text primary key,
  status text not null check (status in ('ok', 'error')),
  details text,
  last_success_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_source_id bigint,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crm_sessions_trainer_idx on public.crm_sessions(trainer_source_id, starts_at);
create index if not exists crm_account_clients_account_idx on public.crm_account_clients(account_id);
create index if not exists crm_account_clients_client_idx on public.crm_account_clients(client_source_id);
create index if not exists crm_audit_log_created_idx on public.crm_audit_log(created_at desc);

alter table public.crm_trainers enable row level security;
alter table public.crm_account_clients enable row level security;
alter table public.crm_health_notes enable row level security;
alter table public.crm_sync_state enable row level security;
alter table public.crm_audit_log enable row level security;

-- The existing operation mirror contains finance and personal data.  Only
-- Юлия (owner) may read it.  Technical access stays in the bot and settings,
-- without phone numbers, client details or sums.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'crm_clients', 'crm_memberships', 'crm_payments', 'crm_sessions',
    'crm_bookings', 'crm_funnel', 'crm_client_notes'
  ] loop
    execute format('drop policy if exists "Operations owners read %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Owner reads %s" on public.%I', table_name, table_name);
    execute format(
      'create policy "Owner reads %s" on public.%I for select to authenticated using ((select public.current_role()) = ''owner'')',
      table_name, table_name
    );
  end loop;
end $$;

drop policy if exists "Owner reads trainers" on public.crm_trainers;
create policy "Owner reads trainers" on public.crm_trainers
for select to authenticated using ((select public.current_role()) = 'owner');

drop policy if exists "Trainers read their profile" on public.crm_trainers;
create policy "Trainers read their profile" on public.crm_trainers
for select to authenticated
using ((select public.current_role()) = 'trainer' and profile_id = (select auth.uid()));

drop policy if exists "Owner reads account links" on public.crm_account_clients;
create policy "Owner reads account links" on public.crm_account_clients
for select to authenticated using ((select public.current_role()) = 'owner');

drop policy if exists "Clients read their account links" on public.crm_account_clients;
create policy "Clients read their account links" on public.crm_account_clients
for select to authenticated using (account_id = (select auth.uid()));

drop policy if exists "Owner manages account links" on public.crm_account_clients;
create policy "Owner manages account links" on public.crm_account_clients
for all to authenticated
using ((select public.current_role()) = 'owner')
with check ((select public.current_role()) = 'owner');

drop policy if exists "Owner manages health notes" on public.crm_health_notes;
create policy "Owner manages health notes" on public.crm_health_notes
for all to authenticated
using ((select public.current_role()) = 'owner')
with check ((select public.current_role()) = 'owner');

drop policy if exists "Assigned trainer reads health note" on public.crm_health_notes;
create policy "Assigned trainer reads health note" on public.crm_health_notes
for select to authenticated
using (
  (select public.current_role()) = 'trainer'
  and exists (
    select 1
    from public.crm_trainers trainer
    join public.crm_sessions session on session.trainer_source_id = trainer.source_id
    join public.crm_bookings booking on booking.session_source_id = session.source_id
    where trainer.profile_id = (select auth.uid())
      and booking.client_source_id = crm_health_notes.client_source_id
      and booking.status in ('booked', 'attended', 'no_show')
  )
);

drop policy if exists "Owner reads sync state" on public.crm_sync_state;
create policy "Owner reads sync state" on public.crm_sync_state
for select to authenticated using ((select public.current_role()) = 'owner');

drop policy if exists "Owner reads audit log" on public.crm_audit_log;
create policy "Owner reads audit log" on public.crm_audit_log
for select to authenticated using ((select public.current_role()) = 'owner');

-- Platform commands are owner-only.  A technical specialist cannot operate
-- bookings or attendance from the web interface.
drop policy if exists "Operations owners create commands" on public.crm_operation_commands;
drop policy if exists "Operations owners read commands" on public.crm_operation_commands;
drop policy if exists "Owner creates commands" on public.crm_operation_commands;
drop policy if exists "Owner reads commands" on public.crm_operation_commands;

create policy "Owner creates commands" on public.crm_operation_commands
for insert to authenticated
with check (
  (select public.current_role()) = 'owner'
  and requested_by = (select auth.uid())
);

create policy "Owner reads commands" on public.crm_operation_commands
for select to authenticated
using ((select public.current_role()) = 'owner');

-- Prepare the command queue for the later client and trainer cabinets.
alter table public.crm_operation_commands
  alter column booking_source_id drop not null;

alter table public.crm_operation_commands
  drop constraint if exists crm_operation_commands_action_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'crm_operation_commands_action_check'
      and conrelid = 'public.crm_operation_commands'::regclass
  ) then
    alter table public.crm_operation_commands
      add constraint crm_operation_commands_action_check
      check (action in (
        'attendance', 'cancel_booking', 'book_session', 'join_waitlist',
        'finish_session', 'owner_correction'
      ));
  end if;
end $$;
