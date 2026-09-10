import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const kinds = ["Практика", "Методика", "Статья", "Видео", "Аудио", "Заметка"] as const;
const icons = { Практика: "◌", Методика: "✦", Статья: "☼", Видео: "↗", Аудио: "◒", Заметка: "⌁" };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { title?: string; kind?: string; text?: string; tags?: string[] };
  if (!body.title?.trim() || !body.text?.trim() || !body.kind || !kinds.includes(body.kind as (typeof kinds)[number])) {
    return NextResponse.json({ error: "Invalid material" }, { status: 400 });
  }

  const { data, error } = await supabase.from("materials").insert({
    title: body.title.trim(),
    kind: body.kind,
    summary: body.text.trim(),
    tags: body.tags ?? [],
    status: "Черновик",
    created_by: user.id,
  }).select("id, title, kind, summary, tags, status, created_at").single();

  if (error || !data) return NextResponse.json({ error: "Could not save" }, { status: 500 });

  return NextResponse.json({
    id: data.id, title: data.title, kind: data.kind, text: data.summary,
    tags: data.tags ?? [], status: data.status, date: "Сейчас", icon: icons[data.kind as keyof typeof icons],
  });
}
