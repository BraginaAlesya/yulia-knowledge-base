-- Phase 2: client cabinet.
-- Run after phase-1-foundation.sql.  The bot remains the single executor of
-- booking and cancellation rules; the web application only adds safe commands.

create or replace function public.current_client_source_ids()
returns bigint[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(client_source_id), '{}'::bigint[])
  from public.crm_account_clients
  where account_id = (select auth.uid())
$$;

-- A client sees only their own profile, history and package.  A guardian may
-- have several source ids here later without changing the policy model.
drop policy if exists "Client reads own CRM profile" on public.crm_clients;
create policy "Client reads own CRM profile" on public.crm_clients
for select to authenticated
using (
  (select public.current_role()) = 'client'
  and source_id = any((select public.current_client_source_ids()))
);

drop policy if exists "Client reads own memberships" on public.crm_memberships;
create policy "Client reads own memberships" on public.crm_memberships
for select to authenticated
using (
  (select public.current_role()) = 'client'
  and client_source_id = any((select public.current_client_source_ids()))
);

drop policy if exists "Client reads own bookings" on public.crm_bookings;
create policy "Client reads own bookings" on public.crm_bookings
for select to authenticated
using (
  (select public.current_role()) = 'client'
  and client_source_id = any((select public.current_client_source_ids()))
);

drop policy if exists "Clients read active sessions" on public.crm_sessions;
create policy "Clients read active sessions" on public.crm_sessions
for select to authenticated
using (
  (select public.current_role()) = 'client'
  and is_active = true
  and starts_at >= now() - interval '1 day'
);

drop policy if exists "Client reads own commands" on public.crm_operation_commands;
create policy "Client reads own commands" on public.crm_operation_commands
for select to authenticated
using (
  (select public.current_role()) = 'client'
  and requested_by = (select auth.uid())
);

drop policy if exists "Client creates safe commands" on public.crm_operation_commands;
create policy "Client creates safe commands" on public.crm_operation_commands
for insert to authenticated
with check (
  (select public.current_role()) = 'client'
  and requested_by = (select auth.uid())
  and (
    (
      action in ('book_session', 'join_waitlist')
      and booking_source_id is null
      and (payload ? 'clientSourceId')
      and (payload ? 'sessionSourceId')
      and ((payload ->> 'clientSourceId')::bigint = any((select public.current_client_source_ids())))
    )
    or (
      action = 'cancel_booking'
      and exists (
        select 1 from public.crm_bookings booking
        where booking.source_id = crm_operation_commands.booking_source_id
          and booking.client_source_id = any((select public.current_client_source_ids()))
      )
    )
  )
);

-- Clients cannot edit their name or membership.  Contact details are updated
-- through this small scoped RPC only for a linked profile.
create or replace function public.update_my_client_contact(
  target_client_source_id bigint,
  next_phone text,
  next_email text,
  next_photo_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select public.current_role()) <> 'client'
     or not target_client_source_id = any((select public.current_client_source_ids())) then
    raise exception 'Недостаточно прав';
  end if;

  update public.crm_clients
  set
    phone = nullif(trim(next_phone), ''),
    email = nullif(lower(trim(next_email)), ''),
    photo_url = nullif(trim(next_photo_url), '')
  where source_id = target_client_source_id;
end;
$$;

revoke all on function public.update_my_client_contact(bigint, text, text, text) from public;
grant execute on function public.update_my_client_contact(bigint, text, text, text) to authenticated;

-- A small read model keeps the client interface simple while never exposing
-- other clients' names, contacts or bookings.
create or replace function public.my_client_cabinet_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with own_clients as (
    select c.source_id, c.full_name, c.phone, c.email, c.photo_url,
      c.access_state, link.relationship, link.is_default
    from public.crm_clients c
    join public.crm_account_clients link on link.client_source_id = c.source_id
    where link.account_id = (select auth.uid())
  ), own_ids as (
    select source_id from own_clients
  )
  select jsonb_build_object(
    'clients', coalesce((
      select jsonb_agg(to_jsonb(own_clients) order by is_default desc, full_name)
      from own_clients
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceId', membership.source_id,
        'clientSourceId', membership.client_source_id,
        'planCode', membership.plan_code,
        'practicesTotal', membership.practices_total,
        'practicesLeft', membership.practices_left,
        'endsAt', membership.ends_at,
        'status', membership.status
      ) order by membership.id desc)
      from public.crm_memberships membership
      where membership.client_source_id in (select source_id from own_ids)
    ), '[]'::jsonb),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceId', booking.source_id,
        'clientSourceId', booking.client_source_id,
        'sessionSourceId', booking.session_source_id,
        'bookingType', booking.booking_type,
        'status', booking.status,
        'paymentRequired', booking.payment_required,
        'startsAt', coalesce(session.starts_at, booking.custom_starts_at),
        'direction', coalesce(session.direction, booking.custom_title, 'Практика'),
        'subtitle', session.subtitle,
        'createdAt', booking.created_at
      ) order by coalesce(session.starts_at, booking.custom_starts_at) desc nulls last)
      from public.crm_bookings booking
      left join public.crm_sessions session on session.source_id = booking.session_source_id
      where booking.client_source_id in (select source_id from own_ids)
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceId', session.source_id,
        'startsAt', session.starts_at,
        'direction', session.direction,
        'subtitle', session.subtitle,
        'capacity', session.capacity,
        'bookedCount', (
          select count(*) from public.crm_bookings booking
          where booking.session_source_id = session.source_id and booking.status = 'booked'
        )
      ) order by session.starts_at)
      from public.crm_sessions session
      where session.is_active = true and session.starts_at >= now()
    ), '[]'::jsonb)
  )
  where (select public.current_role()) = 'client'
$$;

revoke all on function public.my_client_cabinet_snapshot() from public;
grant execute on function public.my_client_cabinet_snapshot() to authenticated;
