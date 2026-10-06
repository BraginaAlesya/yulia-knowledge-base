import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "client") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  const { password } = await request.json() as { password?: string };
  if (typeof password !== "string" || password.trim().length < 10) {
    return NextResponse.json({ error: "Придумайте пароль не короче 10 символов" }, { status: 400 });
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return NextResponse.json({ error: "Не удалось изменить пароль" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
