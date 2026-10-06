import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const body = await request.json() as {
    clientSourceId?: number;
    phone?: string;
    email?: string;
    photoUrl?: string;
  };
  if (!Number.isInteger(body.clientSourceId) || body.clientSourceId! < 1) {
    return NextResponse.json({ error: "Не найден профиль" }, { status: 400 });
  }

  const { error } = await supabase.rpc("update_my_client_contact", {
    target_client_source_id: body.clientSourceId,
    next_phone: body.phone ?? "",
    next_email: body.email ?? "",
    next_photo_url: body.photoUrl ?? "",
  });
  if (error) return NextResponse.json({ error: "Не удалось сохранить профиль" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
