-- Phase 7: owner broadcasts are queued for delivery by the Telegram bot.
-- Run after phase-4-client-access-issuance.sql.

alter table public.crm_operation_commands
  drop constraint if exists crm_operation_commands_action_check;

alter table public.crm_operation_commands
  add constraint crm_operation_commands_action_check
  check (action in (
    'attendance', 'cancel_booking', 'book_session', 'join_waitlist',
    'finish_session', 'owner_correction', 'issue_client_access', 'broadcast'
  ));
