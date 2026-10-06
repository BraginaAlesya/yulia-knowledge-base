import TrainerCabinet from "@/components/trainer-cabinet";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TrainerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/trainer");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "trainer") redirect("/");

  const { data, error } = await supabase.rpc("my_trainer_cabinet_snapshot");
  if (error || !data || !data.trainer?.source_id) redirect("/access-pending");

  return <TrainerCabinet snapshot={data} referenceNow={new Date().toISOString()} />;
}
