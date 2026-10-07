import ClientCabinet from "@/components/client-cabinet";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ClientPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/client");

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "client") redirect("/");

  const { data, error } = await supabase.rpc("my_client_cabinet_snapshot");
  if (error || !data) redirect("/access-pending");

  const { data: waitlist } = await supabase
    .from("crm_waitlist")
    .select("source_id, client_source_id, session_source_id, status, created_at")
    .in("status", ["waiting", "offered"])
    .order("created_at", { ascending: true });

  return <ClientCabinet snapshot={{ ...data, waitlist: waitlist ?? [] }} referenceNow={new Date().toISOString()} />;
}
