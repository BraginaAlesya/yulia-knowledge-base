import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  const body = await request.json() as { clientSourceId?: number };
  if (!Number.isInteger(body.clientSourceId) || body.clientSourceId! < 1) {
    return NextResponse.json({ error: "Не выбран клиент" }, { status: 400 });
  }

  const { error } = await supabase.from("crm_operation_commands").insert({
    action: "issue_client_access",
    booking_source_id: null,
    payload: { clientSourceId: body.clientSourceId },
    requested_by: user.id,
  });
  if (error) return NextResponse.json({ error: "Не удалось передать создание доступа" }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Бот создаст доступ и отправит его клиенту в Telegram" });
}
