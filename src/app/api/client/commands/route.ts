import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Action = "book_session" | "join_waitlist" | "cancel_booking" | "move_booking";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "client") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  const body = await request.json() as {
    action?: Action;
    clientSourceId?: number;
    sessionSourceId?: number;
    bookingSourceId?: number;
    confirmedLateCancel?: boolean;
  };
  const action = body.action;
  if (!action || !["book_session", "join_waitlist", "cancel_booking", "move_booking"].includes(action)) {
    return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
  }

  if (action === "cancel_booking" || action === "move_booking") {
    if (!Number.isInteger(body.bookingSourceId) || body.bookingSourceId! < 1) {
      return NextResponse.json({ error: "Не выбрана запись" }, { status: 400 });
    }
    if (action === "move_booking" && (!Number.isInteger(body.sessionSourceId) || body.sessionSourceId! < 1)) {
      return NextResponse.json({ error: "Не выбрано новое время" }, { status: 400 });
    }
    const { error } = await supabase.from("crm_operation_commands").insert({
      action,
      booking_source_id: body.bookingSourceId,
      payload: action === "cancel_booking"
        ? { confirmedLateCancel: body.confirmedLateCancel === true }
        : { sessionSourceId: body.sessionSourceId },
      requested_by: user.id,
    });
    if (error) return NextResponse.json({ error: action === "move_booking" ? "Не удалось передать перенос" : "Не удалось передать отмену" }, { status: 500 });
    return NextResponse.json({ ok: true, message: action === "move_booking" ? "Запрос на перенос передан" : "Запрос на отмену передан" });
  }

  if (!Number.isInteger(body.clientSourceId) || !Number.isInteger(body.sessionSourceId)
      || body.clientSourceId! < 1 || body.sessionSourceId! < 1) {
    return NextResponse.json({ error: "Не выбрана практика" }, { status: 400 });
  }

  const { error } = await supabase.from("crm_operation_commands").insert({
    action,
    booking_source_id: null,
    payload: { clientSourceId: body.clientSourceId, sessionSourceId: body.sessionSourceId },
    requested_by: user.id,
  });
  if (error) return NextResponse.json({ error: "Не удалось передать запись" }, { status: 500 });
  return NextResponse.json({ ok: true, message: action === "join_waitlist" ? "Вы добавлены в лист ожидания" : "Запрос на запись передан" });
}
