import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const statuses = ["Опубликовано", "Черновик", "Архив"] as const;
const kinds = ["Практика", "Методика", "Статья", "Видео", "Аудио", "Заметка"] as const;
const accessRoles = ["trainer", "client", "technical_admin"] as const;
const icons = { Практика: "◌", Методика: "✦", Статья: "☼", Видео: "↗", Аудио: "◒", Заметка: "⌁" };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { status?: string; title?: string; kind?: string; text?: string; tags?: string[]; folderId?: string | null; accessRoles?: string[]; contentBlocks?: unknown[] };
  if (body.status && !statuses.includes(body.status as (typeof statuses)[number])) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  if (body.kind && !kinds.includes(body.kind as (typeof kinds)[number])) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  if (body.title !== undefined && !body.title.trim()) return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  if (body.text !== undefined && !body.text.trim()) return NextResponse.json({ error: "Invalid text" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.status) update.status = body.status;
  if (body.title !== undefined) update.title = body.title.trim();
  if (body.kind) update.kind = body.kind;
  if (body.text !== undefined) update.summary = body.text.trim();
  if (body.tags) update.tags = body.tags;
  if (body.folderId !== undefined) update.folder_id = body.folderId;
  if (body.contentBlocks !== undefined) update.content_blocks = Array.isArray(body.contentBlocks) ? body.contentBlocks : [];
  if (body.accessRoles) update.access_roles = body.accessRoles.filter((role): role is (typeof accessRoles)[number] => accessRoles.includes(role as (typeof accessRoles)[number]));
  if (!Object.keys(update).length) return NextResponse.json({ error: "No changes" }, { status: 400 });

  const { id } = await context.params;
  const { data, error } = await supabase.from("materials").update(update).eq("id", id)
    .select("id, title, kind, summary, tags, status, folder_id, access_roles, content_blocks, created_at").single();
  if (error || !data) return NextResponse.json({ error: "Could not update" }, { status: 500 });
  return NextResponse.json({ id: data.id, title: data.title, kind: data.kind, text: data.summary, tags: data.tags ?? [], status: data.status, folderId: data.folder_id ?? null, folderName: null, accessRoles: data.access_roles ?? [], contentBlocks: data.content_blocks ?? [], date: "Сейчас", icon: icons[data.kind as keyof typeof icons] });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
