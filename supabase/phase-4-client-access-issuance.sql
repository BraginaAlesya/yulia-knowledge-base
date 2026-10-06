-- Phase 4: client access issuance queue.
-- The owner places a request; the bot uses its server-only service key to
-- create/link the Supabase Auth account and delivers the temporary password
-- in Telegram. Raw passwords are never stored in Postgres or in the bot DB.

alter table public.crm_operation_commands
  drop constraint if exists crm_operation_commands_action_check;

alter table public.crm_operation_commands
  add constraint crm_operation_commands_action_check
  check (action in (
    'attendance', 'cancel_booking', 'book_session', 'join_waitlist',
    'finish_session', 'owner_correction', 'issue_client_access'
  ));
