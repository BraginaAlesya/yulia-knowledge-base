import KnowledgeBrowser from "@/components/knowledge-browser";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Role = "owner" | "technical_admin" | "trainer" | "client";
type MaterialRow = {
  id: string;
  title: string;
  kind: "Практика" | "Методика" | "Статья" | "Видео" | "Аудио" | "Заметка";
  summary: string;
  tags: string[];
  status: "Опубликовано" | "Черновик" | "Архив";
  created_at: string;
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

  if (role === "owner") {
    const { data } = await supabase
      .from("materials")
      .select("id, title, kind, summary, tags, status, created_at")
      .order("created_at", { ascending: false });

    const items = ((data ?? []) as MaterialRow[]).map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      text: item.summary,
      tags: item.tags ?? [],
      status: item.status,
      date: formatDate(item.created_at),
      icon: kindIcons[item.kind],
    }));

    return <KnowledgeBrowser initialItems={items} />;
  }

  return <RoleCabinet name={profile.full_name || user.email || "Пользователь"} role={role} />;
}

function RoleCabinet({ name, role }: { name: string; role: Exclude<Role, "owner"> }) {
  const content = {
    technical_admin: {
      kicker: "Технический кабинет",
      title: "Пространство управления",
      text: "Здесь будут интеграции бота, расписание, таблицы и технические настройки. Материалы Юлии закрыты для этой роли.",
      card: "Следующий шаг — подключить управление пользователями и аналитику из Google Sheets.",
    },
    trainer: {
      kicker: "Кабинет преподавателя",
      title: "Ваши материалы и обучение",
      text: "Здесь появятся назначенные Юлией курсы, материалы, заметки и отметки о прохождении.",
      card: "Пока вам ещё не назначены материалы.",
    },
    client: {
      kicker: "Личный кабинет",
      title: "Ваше расписание",
      text: "Здесь будут только ваши ближайшие занятия, напоминания и ссылка на запись через бота.",
      card: "Ближайших занятий пока нет.",
    },
  }[role];

  return (
    <main className="role-cabinet">
      <header className="role-header">
        <div className="role-brand"><b>В</b><span>Взмах к себе<br />Дом телесной устойчивости</span></div>
        <form action="/auth/signout" method="post"><button type="submit">Выйти</button></form>
      </header>
      <section className="role-content">
        <small>{content.kicker}</small>
        <h1>Здравствуйте, {name}</h1>
        <p>{content.text}</p>
        <div className="role-card">{content.card}</div>
      </section>
    </main>
  );
}
