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
  if (role !== "owner" && role !== "technical_admin") redirect("/");

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const upcoming = new Date();
  upcoming.setHours(0, 0, 0, 0);

  const [clientsResult, membershipsResult, paymentsResult, sessionsResult, bookingsResult, funnelResult] = await Promise.all([
    supabase.from("crm_clients").select("source_id, full_name, phone").order("full_name"),
    supabase.from("crm_memberships").select("source_id, client_source_id, practices_left, status, ends_at"),
    supabase.from("crm_payments").select("source_id, client_source_id, amount, paid_at").gte("paid_at", since.toISOString()),
    supabase.from("crm_sessions").select("source_id, starts_at, direction, subtitle, capacity, is_active").gte("starts_at", upcoming.toISOString()).order("starts_at").limit(40),
    supabase.from("crm_bookings").select("source_id, client_source_id, session_source_id, booking_type, status, custom_title, custom_starts_at, created_at").order("created_at", { ascending: false }).limit(800),
    supabase.from("crm_funnel").select("client_source_id, status, updated_at"),
  ]);

  const errors = [
    clientsResult.error, membershipsResult.error, paymentsResult.error,
    sessionsResult.error, bookingsResult.error, funnelResult.error,
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
      sourceReady={!errors.length}
    />
  );
}
