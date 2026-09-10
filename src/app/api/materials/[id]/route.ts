import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const statuses = ["Опубликовано", "Черновик", "Архив"] as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { status?: string };
  if (!body.status || !statuses.includes(body.status as (typeof statuses)[number])) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { id } = await context.params;
  const { error } = await supabase.from("materials").update({ status: body.status }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not update" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
