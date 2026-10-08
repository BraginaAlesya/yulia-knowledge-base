-- Phase 9: safe client transfer. Run after phase-8-web-notifications.sql.
-- The bot still validates the cancellation window and availability.

alter table public.crm_operation_commands
  drop constraint if exists crm_operation_commands_action_check;

alter table public.crm_operation_commands
  add constraint crm_operation_commands_action_check
  check (action in (
    'attendance', 'cancel_booking', 'book_session', 'join_waitlist',
    'move_booking', 'finish_session', 'owner_correction',
    'issue_client_access', 'broadcast'
  ));

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
      and ((payload ->> 'clientSourceId')::bigint = any(public.current_client_source_ids()))
    )
    or (
      action = 'cancel_booking'
      and exists (
        select 1 from public.crm_bookings booking
        where booking.source_id = crm_operation_commands.booking_source_id
          and booking.client_source_id = any(public.current_client_source_ids())
      )
    )
    or (
      action = 'move_booking'
      and (payload ? 'sessionSourceId')
      and exists (
        select 1 from public.crm_bookings booking
        where booking.source_id = crm_operation_commands.booking_source_id
          and booking.client_source_id = any(public.current_client_source_ids())
      )
    )
  )
);
