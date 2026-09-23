import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["owner", "technical_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const body = await request.json() as {
    action?: "attendance" | "cancel_booking";
    bookingSourceId?: number;
    attended?: boolean;
  };
  if (!body.action || !Number.isInteger(body.bookingSourceId) || body.bookingSourceId! < 1) {
    return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
  }
  if (body.action === "attendance" && typeof body.attended !== "boolean") {
    return NextResponse.json({ error: "Укажите результат посещения" }, { status: 400 });
  }

  const { error } = await supabase.from("crm_operation_commands").insert({
    action: body.action,
    booking_source_id: body.bookingSourceId,
    payload: body.action === "attendance" ? { attended: body.attended } : {},
    requested_by: user.id,
  });
  if (error) return NextResponse.json({ error: "Не удалось передать действие боту" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
