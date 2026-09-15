import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { title?: string; description?: string | null };
  if (!body.title?.trim()) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });

  const { data, error } = await supabase.from("folders").insert({
    title: body.title.trim(),
    description: body.description?.trim() || null,
    created_by: user.id,
  }).select("id, title, description").single();

  if (error || !data) return NextResponse.json({ error: "Could not create folder" }, { status: 500 });
  return NextResponse.json(data);
}
