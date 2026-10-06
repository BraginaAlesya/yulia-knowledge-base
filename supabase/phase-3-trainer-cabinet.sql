-- Phase 3: trainer cabinet.
-- Run after phase-1-foundation.sql and phase-2-client-cabinet.sql.
-- A trainer can see only their own practices and the minimum client data
-- needed to run them: first name, photo, trial flag and contraindications.

alter table public.crm_sessions
  add column if not exists completed_at timestamptz;

create or replace function public.current_trainer_source_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select source_id
  from public.crm_trainers
  where profile_id = (select auth.uid())
    and is_active = true
  limit 1
$$;

drop policy if exists "Trainers read own sessions" on public.crm_sessions;
create policy "Trainers read own sessions" on public.crm_sessions
for select to authenticated
using (
  (select public.current_role()) = 'trainer'
  and trainer_source_id = (select public.current_trainer_source_id())
);

drop policy if exists "Trainer reads own commands" on public.crm_operation_commands;
create policy "Trainer reads own commands" on public.crm_operation_commands
for select to authenticated
using (
  (select public.current_role()) = 'trainer'
  and requested_by = (select auth.uid())
);

drop policy if exists "Trainer creates attendance commands" on public.crm_operation_commands;
create policy "Trainer creates attendance commands" on public.crm_operation_commands
for insert to authenticated
with check (
  (select public.current_role()) = 'trainer'
  and requested_by = (select auth.uid())
  and (
    (
      action = 'attendance'
      and booking_source_id is not null
      and exists (
        select 1
        from public.crm_bookings booking
        join public.crm_sessions session on session.source_id = booking.session_source_id
        where booking.source_id = crm_operation_commands.booking_source_id
          and session.trainer_source_id = (select public.current_trainer_source_id())
          and booking.status = 'booked'
      )
    )
    or (
      action = 'finish_session'
      and booking_source_id is null
      and (payload ? 'sessionSourceId')
      and exists (
        select 1 from public.crm_sessions session
        where session.source_id = (payload ->> 'sessionSourceId')::bigint
          and session.trainer_source_id = (select public.current_trainer_source_id())
      )
    )
  )
);

-- Read model for the trainer's phone.  It deliberately does not return
-- client surname, phone, email, payment data or other trainer's sessions.
create or replace function public.my_trainer_cabinet_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with own_trainer as (
    select source_id, display_name, photo_url
    from public.crm_trainers
    where profile_id = (select auth.uid()) and is_active = true
    limit 1
  ), own_sessions as (
    select session.*
    from public.crm_sessions session
    join own_trainer trainer on trainer.source_id = session.trainer_source_id
    where session.is_active = true
      and session.starts_at >= now() - interval '8 hours'
    order by session.starts_at
    limit 40
  ), trainer_sessions_last_30_days as (
    select session.source_id
    from public.crm_sessions session
    join own_trainer trainer on trainer.source_id = session.trainer_source_id
    where session.starts_at >= now() - interval '30 days'
  )
  select jsonb_build_object(
    'trainer', coalesce((select to_jsonb(own_trainer) from own_trainer), '{}'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceId', session.source_id,
        'startsAt', session.starts_at,
        'direction', session.direction,
        'subtitle', session.subtitle,
        'capacity', session.capacity,
        'completedAt', session.completed_at,
        'bookings', coalesce((
          select jsonb_agg(jsonb_build_object(
            'sourceId', booking.source_id,
            'status', booking.status,
            'bookingType', booking.booking_type,
            'firstName', split_part(client.full_name, ' ', 1),
            'photoUrl', client.photo_url,
            'healthNote', health.note_text
          ) order by client.full_name)
          from public.crm_bookings booking
          join public.crm_clients client on client.source_id = booking.client_source_id
          left join public.crm_health_notes health on health.client_source_id = client.source_id
          where booking.session_source_id = session.source_id
            and booking.status in ('booked', 'attended', 'no_show')
        ), '[]'::jsonb)
      ) order by session.starts_at)
      from own_sessions session
    ), '[]'::jsonb),
    'attendanceLast30Days', coalesce((
      select count(*)
      from public.crm_bookings booking
      join trainer_sessions_last_30_days session on session.source_id = booking.session_source_id
      where booking.status = 'attended'
    ), 0)
  )
  where (select public.current_role()) = 'trainer'
$$;

revoke all on function public.my_trainer_cabinet_snapshot() from public;
grant execute on function public.my_trainer_cabinet_snapshot() to authenticated;
