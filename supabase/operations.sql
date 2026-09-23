-- Operations bridge for the Vzmah bot and the owner workspace.
-- Run after schema.sql in Supabase SQL Editor.
-- The bot uses a service-role key only on its server; users access these
-- records through the policies below.

create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  source_id bigint not null unique,
  telegram_id bigint,
  telegram_username text,
  full_name text not null,
  phone text,
  acquisition_source text,
  registered_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.crm_memberships (
  id uuid primary key default gen_random_uuid(),
  source_id bigint not null unique,
  client_source_id bigint not null,
  plan_code text not null,
  practices_total integer not null,
  practices_left integer not null,
  amount numeric not null,
  paid_at timestamptz,
  starts_at date,
  ends_at date,
  status text not null,
  payment_source text,
  synced_at timestamptz not null default now()
);

create table if not exists public.crm_payments (
  id uuid primary key default gen_random_uuid(),
  source_id bigint not null unique,
  client_source_id bigint not null,
  membership_source_id bigint,
  amount numeric not null,
  plan_code text not null,
  source text,
  paid_at timestamptz not null,
  synced_at timestamptz not null default now()
);

create table if not exists public.crm_sessions (
  id uuid primary key default gen_random_uuid(),
  source_id bigint not null unique,
  starts_at timestamptz not null,
  direction text not null,
  subtitle text,
  capacity integer not null default 5,
  is_active boolean not null default true,
  synced_at timestamptz not null default now()
);

create table if not exists public.crm_bookings (
  id uuid primary key default gen_random_uuid(),
  source_id bigint not null unique,
  client_source_id bigint not null,
  session_source_id bigint,
  membership_source_id bigint,
  custom_title text,
  custom_starts_at timestamptz,
  booking_type text not null,
  status text not null,
  source text,
  created_at timestamptz,
  cancelled_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.crm_funnel (
  id uuid primary key default gen_random_uuid(),
  client_source_id bigint not null unique,
  status text not null,
  campaign text,
  utm text,
  first_response_at timestamptz,
  trial_booking_source_id bigint,
  trial_at timestamptz,
  trial_attended_at timestamptz,
  offer_at timestamptz,
  sale_at timestamptz,
  refusal_reason text,
  next_contact_at timestamptz,
  comment text,
  updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.crm_client_notes (
  id uuid primary key default gen_random_uuid(),
  source_id bigint not null unique,
  client_source_id bigint not null,
  note_text text not null,
  visibility text not null default 'private',
  author text,
  created_at timestamptz,
  synced_at timestamptz not null default now()
);

-- Commands are created on the platform and applied by the running bot.
-- This prevents the public app from ever receiving a Telegram token or a
-- database credential.
create table if not exists public.crm_operation_commands (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('attendance', 'cancel_booking')),
  booking_source_id bigint not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  result_message text,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists crm_sessions_starts_at_idx on public.crm_sessions(starts_at);
create index if not exists crm_bookings_session_idx on public.crm_bookings(session_source_id);
create index if not exists crm_bookings_client_idx on public.crm_bookings(client_source_id);
create index if not exists crm_commands_pending_idx on public.crm_operation_commands(status, requested_at);

alter table public.crm_clients enable row level security;
alter table public.crm_memberships enable row level security;
alter table public.crm_payments enable row level security;
alter table public.crm_sessions enable row level security;
alter table public.crm_bookings enable row level security;
alter table public.crm_funnel enable row level security;
alter table public.crm_client_notes enable row level security;
alter table public.crm_operation_commands enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'crm_clients', 'crm_memberships', 'crm_payments', 'crm_sessions',
    'crm_bookings', 'crm_funnel', 'crm_client_notes'
  ] loop
    execute format('drop policy if exists "Operations owners read %s" on public.%I', table_name, table_name);
    execute format('create policy "Operations owners read %s" on public.%I for select to authenticated using ((select public.current_role()) in (''owner'', ''technical_admin''))', table_name, table_name);
  end loop;
end $$;

drop policy if exists "Operations owners create commands" on public.crm_operation_commands;
create policy "Operations owners create commands"
on public.crm_operation_commands for insert to authenticated
with check (
  (select public.current_role()) in ('owner', 'technical_admin')
  and requested_by = (select auth.uid())
);

drop policy if exists "Operations owners read commands" on public.crm_operation_commands;
create policy "Operations owners read commands"
on public.crm_operation_commands for select to authenticated
using ((select public.current_role()) in ('owner', 'technical_admin'));
