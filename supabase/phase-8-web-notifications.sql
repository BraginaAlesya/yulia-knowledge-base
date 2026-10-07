-- Phase 8: preferences and device subscriptions for web notifications.
-- Run after phase-2-client-cabinet.sql. Sending is enabled only when the
-- bot receives the VAPID keys during the final publication step.

create table if not exists public.crm_notification_preferences (
  account_id uuid primary key references public.profiles(id) on delete cascade,
  web_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_web_push_subscriptions_account_idx
  on public.crm_web_push_subscriptions(account_id);

alter table public.crm_notification_preferences enable row level security;
alter table public.crm_web_push_subscriptions enable row level security;

drop policy if exists "Client manages own notification preferences" on public.crm_notification_preferences;
create policy "Client manages own notification preferences" on public.crm_notification_preferences
for all to authenticated
using ((select public.current_role()) = 'client' and account_id = (select auth.uid()))
with check ((select public.current_role()) = 'client' and account_id = (select auth.uid()));

drop policy if exists "Client manages own web push subscriptions" on public.crm_web_push_subscriptions;
create policy "Client manages own web push subscriptions" on public.crm_web_push_subscriptions
for all to authenticated
using ((select public.current_role()) = 'client' and account_id = (select auth.uid()))
with check ((select public.current_role()) = 'client' and account_id = (select auth.uid()));
