import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Action = "attendance" | "finish_session";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "trainer") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  const body = await request.json() as {
    action?: Action;
    bookingSourceId?: number;
    sessionSourceId?: number;
    attended?: boolean;
  };
  if (body.action === "attendance") {
    if (!Number.isInteger(body.bookingSourceId) || body.bookingSourceId! < 1 || typeof body.attended !== "boolean") {
      return NextResponse.json({ error: "Не удалось определить отметку" }, { status: 400 });
    }
    const { error } = await supabase.from("crm_operation_commands").insert({
      action: "attendance",
      booking_source_id: body.bookingSourceId,
      payload: { attended: body.attended },
      requested_by: user.id,
    });
    if (error) return NextResponse.json({ error: "Не удалось передать отметку" }, { status: 500 });
    return NextResponse.json({ ok: true, message: body.attended ? "Отмечено: пришла" : "Отмечено: не пришла" });
  }

  if (body.action === "finish_session" && Number.isInteger(body.sessionSourceId) && body.sessionSourceId! > 0) {
    const { error } = await supabase.from("crm_operation_commands").insert({
      action: "finish_session",
      booking_source_id: null,
      payload: { sessionSourceId: body.sessionSourceId },
      requested_by: user.id,
    });
    if (error) return NextResponse.json({ error: "Не удалось завершить практику" }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Практика передана на завершение" });
  }

  return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
}
