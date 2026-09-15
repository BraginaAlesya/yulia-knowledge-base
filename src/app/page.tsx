import KnowledgeBrowser from "@/components/knowledge-browser";
import type { ContentBlock } from "@/components/content-blocks";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Role = "owner" | "technical_admin" | "trainer" | "client";
type AccessRole = "trainer" | "client" | "technical_admin";
type MaterialRow = {
  id: string;
  title: string;
  kind: "Практика" | "Методика" | "Статья" | "Видео" | "Аудио" | "Заметка";
  summary: string;
  tags: string[];
  status: "Опубликовано" | "Черновик" | "Архив";
  folder_id: string | null;
  access_roles: AccessRole[] | null;
  content_blocks: ContentBlock[] | null;
  folders: { title: string }[] | null;
  created_at: string;
};

type FolderRow = {
  id: string;
  title: string;
  description: string | null;
};

const kindIcons: Record<MaterialRow["kind"], string> = {
  Практика: "◌",
  Методика: "✦",
  Статья: "☼",
  Видео: "↗",
  Аудио: "◒",
  Заметка: "⌁",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(
    new Date(value),
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/access-pending");

  const role = profile.role as Role;

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, kind, summary, tags, status, folder_id, access_roles, content_blocks, folders(title), created_at")
    .order("created_at", { ascending: false });

  const folders = role === "owner"
    ? ((await supabase.from("folders").select("id, title, description").order("title")).data ?? []) as FolderRow[]
    : [];

  const items = ((materials ?? []) as MaterialRow[]).map((item) => ({
    id: item.id,
    title: item.title,
    kind: item.kind,
    text: item.summary,
    tags: item.tags ?? [],
    status: item.status,
    folderId: item.folder_id,
    folderName: item.folders?.[0]?.title ?? null,
    contentBlocks: Array.isArray(item.content_blocks) ? item.content_blocks : [],
    accessRoles: (item.access_roles ?? []).filter(
      (access): access is AccessRole => access === "trainer" || access === "client" || access === "technical_admin",
    ),
    date: formatDate(item.created_at),
    icon: kindIcons[item.kind],
  }));

  return (
    <KnowledgeBrowser
      initialItems={items}
      initialFolders={folders}
      role={role}
      name={profile.full_name || user.email || "Пользователь"}
    />
  );
}
