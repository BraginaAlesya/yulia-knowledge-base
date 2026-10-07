import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  const body = await request.json() as { clientSourceId?: number; note?: string };
  const clientSourceId = Number(body.clientSourceId);
  const note = String(body.note ?? "").trim();
  if (!Number.isInteger(clientSourceId) || clientSourceId < 1) {
    return NextResponse.json({ error: "Выберите клиента" }, { status: 400 });
  }
  if (!note || note.length > 2000) {
    return NextResponse.json({ error: "Укажите особые условия — до 2000 символов" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("crm_health_notes").upsert({
    client_source_id: clientSourceId,
    note_text: note,
    consent_at: now,
    updated_at: now,
    updated_by: user.id,
  }, { onConflict: "client_source_id" });
  if (error) return NextResponse.json({ error: "Не получилось сохранить особые условия" }, { status: 500 });

  await supabase.from("crm_audit_log").insert({
    actor_id: user.id,
    action: "health_note_saved",
    entity_type: "client",
    entity_source_id: clientSourceId,
    details: { message: "Обновлены особые условия для тренера" },
  });
  return NextResponse.json({ ok: true, message: "Особые условия сохранены" });
}
