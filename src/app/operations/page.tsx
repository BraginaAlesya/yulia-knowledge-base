import OperationsDashboard from "@/components/operations-dashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Role = "owner" | "technical_admin" | "trainer" | "client";

export default async function OperationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/operations");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as Role | undefined;
  // This screen contains payments and personal data.  Technical access is
  // intentionally kept out of it; it will have a separate, non-sensitive
  // settings and diagnostics area.
  if (role !== "owner") redirect("/");

  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 30);
  const activitySince = new Date(now);
  activitySince.setDate(activitySince.getDate() - 90);
  const upcoming = new Date();
  upcoming.setHours(0, 0, 0, 0);

  const [clientsResult, membershipsResult, paymentsResult, sessionsResult, bookingsResult, funnelResult, trainersResult, accountLinksResult, healthNotesResult, syncResult, auditResult] = await Promise.all([
    supabase.from("crm_clients").select("source_id, full_name, acquisition_source, phone, email, access_state").order("full_name"),
    supabase.from("crm_memberships").select("source_id, client_source_id, practices_left, status, ends_at"),
    supabase.from("crm_payments").select("source_id, client_source_id, amount, paid_at").gte("paid_at", since.toISOString()),
    supabase.from("crm_sessions").select("source_id, starts_at, direction, subtitle, capacity, is_active, trainer_source_id").gte("starts_at", activitySince.toISOString()).order("starts_at").limit(240),
    supabase.from("crm_bookings").select("source_id, client_source_id, session_source_id, booking_type, status, custom_title, custom_starts_at, created_at").order("created_at", { ascending: false }).limit(800),
    supabase.from("crm_funnel").select("client_source_id, status, updated_at"),
    supabase.from("crm_trainers").select("source_id, display_name").eq("is_active", true).order("display_name"),
    supabase.from("crm_account_clients").select("account_id, client_source_id"),
    supabase.from("crm_health_notes").select("client_source_id, note_text, consent_at, updated_at").order("updated_at", { ascending: false }),
    supabase.from("crm_sync_state").select("last_success_at").eq("source", "telegram_bot").maybeSingle(),
    supabase.from("crm_audit_log").select("id, action, entity_type, entity_source_id, details, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  const errors = [
    clientsResult.error, membershipsResult.error, paymentsResult.error,
    sessionsResult.error, bookingsResult.error, funnelResult.error, trainersResult.error,
  ].filter(Boolean);

  return (
    <OperationsDashboard
      name={profile?.full_name || user.email || "Владелец"}
      clients={clientsResult.data ?? []}
      memberships={membershipsResult.data ?? []}
      payments={paymentsResult.data ?? []}
      sessions={sessionsResult.data ?? []}
      bookings={bookingsResult.data ?? []}
      funnel={funnelResult.data ?? []}
      trainers={trainersResult.data ?? []}
      accountLinks={accountLinksResult.data ?? []}
      healthNotes={healthNotesResult.data ?? []}
      auditRecords={auditResult.data ?? []}
      referenceNow={now.toISOString()}
      lastSyncedAt={syncResult.data?.last_success_at ?? null}
      sourceReady={!errors.length}
    />
  );
}
