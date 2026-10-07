import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  const body = await request.json() as { guardianClientId?: number; childClientId?: number };
  if (!Number.isInteger(body.guardianClientId) || !Number.isInteger(body.childClientId)
      || body.guardianClientId! < 1 || body.childClientId! < 1 || body.guardianClientId === body.childClientId) {
    return NextResponse.json({ error: "Выберите двух разных клиентов" }, { status: 400 });
  }

  const { data: guardianLink, error: guardianError } = await supabase
    .from("crm_account_clients")
    .select("account_id")
    .eq("client_source_id", body.guardianClientId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (guardianError || !guardianLink) {
    return NextResponse.json({ error: "Сначала откройте кабинет родителю" }, { status: 400 });
  }

  const { error } = await supabase.from("crm_account_clients").upsert({
    account_id: guardianLink.account_id,
    client_source_id: body.childClientId,
    relationship: "guardian",
    is_default: false,
  }, { onConflict: "account_id,client_source_id" });
  if (error) return NextResponse.json({ error: "Не получилось связать кабинеты" }, { status: 500 });

  await supabase.from("crm_audit_log").insert({
    actor_id: user.id,
    action: "family_linked",
    entity_type: "client",
    entity_source_id: body.childClientId,
    details: { guardianClientId: body.guardianClientId, message: "Ребёнок добавлен в семейный кабинет" },
  });

  return NextResponse.json({ ok: true, message: "Ребёнок добавлен в семейный кабинет" });
}
