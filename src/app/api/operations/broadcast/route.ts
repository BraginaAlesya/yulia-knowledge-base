import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  const body = await request.json() as { audience?: "active" | "all"; text?: string };
  const text = String(body.text ?? "").trim();
  if (!text || text.length > 1200 || !["active", "all"].includes(body.audience ?? "")) {
    return NextResponse.json({ error: "Проверьте текст и аудиторию рассылки" }, { status: 400 });
  }

  const { error } = await supabase.from("crm_operation_commands").insert({
    action: "broadcast",
    booking_source_id: null,
    payload: { audience: body.audience, text },
    requested_by: user.id,
  });
  if (error) return NextResponse.json({ error: "Не удалось передать рассылку боту" }, { status: 500 });

  await supabase.from("crm_audit_log").insert({
    actor_id: user.id,
    action: "broadcast",
    entity_type: "message",
    details: { state: "queued", audience: body.audience, message: "Рассылка передана боту" },
  });
  return NextResponse.json({ ok: true, message: "Рассылка передана боту: он отправит её в течение минуты" });
}
