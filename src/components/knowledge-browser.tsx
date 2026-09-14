"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ContentBlockEditor,
  ContentBlockRenderer,
  type ContentBlock,
} from "./content-blocks";

type Kind = "Практика" | "Методика" | "Статья" | "Видео" | "Аудио" | "Заметка";
type Status = "Опубликовано" | "Черновик" | "Архив";
type Role = "owner" | "technical_admin" | "trainer" | "client";
type AccessRole = "trainer" | "client" | "technical_admin";
type Section =
  | "Главная"
  | "Библиотека"
  | "Практики"
  | "Клиентам"
  | "Команде"
  | "Папки"
  | "Архив";

type Item = {
  id: string;
  title: string;
  kind: Kind;
  text: string;
  tags: string[];
  status: Status;
  folderId: string | null;
  folderName: string | null;
  accessRoles: AccessRole[];
  contentBlocks: ContentBlock[];
  date: string;
  icon: string;
};

type Folder = { id: string; title: string; description: string | null };

const nav: { id: Section; icon: string }[] = [
  { id: "Главная", icon: "⌂" },
  { id: "Библиотека", icon: "▤" },
  { id: "Практики", icon: "◌" },
  { id: "Клиентам", icon: "♡" },
  { id: "Команде", icon: "✦" },
  { id: "Папки", icon: "▱" },
  { id: "Архив", icon: "□" },
];

const filterMap: Record<string, Kind | "all"> = {
  "Все материалы": "all",
  Практики: "Практика",
  Методики: "Методика",
  Статьи: "Статья",
  Видео: "Видео",
  Аудио: "Аудио",
  Заметки: "Заметка",
};

const kindIcons: Record<Kind, string> = {
  Практика: "◌",
  Методика: "✦",
  Статья: "☼",
  Видео: "↗",
  Аудио: "◒",
  Заметка: "⌁",
};

const emptyForm = {
  title: "",
  kind: "Практика" as Kind,
  text: "",
  tags: "",
};

const materialTemplates: Record<string, { label: string; kind: Kind; text: string; accessRoles: AccessRole[] }> = {
  practice: { label: "Карточка практики", kind: "Практика", accessRoles: ["trainer"], text: "Для какого состояния подходит:\n\nКак проходит практика:\n\nЧто понадобится:\n\nНа что обратить внимание:\n\nГраница безопасности:" },
  method: { label: "Методическая карта", kind: "Методика", accessRoles: ["trainer"], text: "Задача и ожидаемый результат:\n\nЛогика ведения:\n\nИнвентарь и среда:\n\nВажные ограничения:\n\nПримечания для ведущего:" },
  client: { label: "Гид для клиента", kind: "Статья", accessRoles: ["trainer", "client"], text: "Когда это может быть полезно:\n\nЧто можно попробовать:\n\nЧего ожидать:\n\nКогда лучше сделать паузу и обратиться к врачу:" },
  faq: { label: "Вопрос и ответ", kind: "Заметка", accessRoles: ["trainer", "client"], text: "Вопрос:\n\nКороткий ответ:\n\nПодробнее:\n\nЧто важно не обещать:" },
  brand: { label: "Коммуникационный материал", kind: "Статья", accessRoles: [], text: "Задача сообщения:\n\nДля кого:\n\nГлавная мысль:\n\nКак говорить:\n\nКаких формулировок избегать:" },
};

function statusClass(status: Status) {
  if (status === "Опубликовано") return "published";
  if (status === "Черновик") return "draft";
  return "archived";
}

function accessLabel(roles: AccessRole[]) {
  if (!roles.length) return "Только владельцы";
  if (roles.includes("trainer") && roles.includes("client")) return "Тренеры и клиенты";
  if (roles.includes("trainer")) return "Тренеры";
  if (roles.includes("client")) return "Клиенты";
  return "Команда";
}

export default function KnowledgeBrowser({
  initialItems,
  initialFolders,
  role,
  name,
}: {
  initialItems: Item[];
  initialFolders: Folder[];
  role: Role;
  name: string;
}) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const owner = hydrated && role === "owner";
  const [section, setSection] = useState<Section>(role === "client" ? "Клиентам" : "Главная");
  const [tab, setTab] = useState("Все материалы");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(initialItems);
  const [folders, setFolders] = useState(initialFolders);
  const [folderId, setFolderId] = useState("all");
  const [audience, setAudience] = useState<"all" | "owner" | AccessRole>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState({
    ...emptyForm,
    folderId: "",
    accessRoles: [] as AccessRole[],
    contentBlocks: [] as ContentBlock[],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    ...emptyForm,
    folderId: "",
    accessRoles: [] as AccessRole[],
    contentBlocks: [] as ContentBlock[],
  });

  const live = items.filter((item) => item.status !== "Архив");
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const shown = useMemo(() => {
    const kind = filterMap[tab];
    return items.filter((item) => {
      if (section === "Архив") {
        if (item.status !== "Архив") return false;
      } else if (item.status === "Архив") return false;
      if (section === "Практики" && item.kind !== "Практика") return false;
      if (section === "Клиентам" && !item.accessRoles.includes("client")) return false;
      if (section === "Команде" && !item.accessRoles.includes("trainer")) return false;
      const matchesKind = kind === "all" || item.kind === kind;
      const matchesFolder = folderId === "all" || item.folderId === folderId;
      const matchesAudience = audience === "all"
        || (audience === "owner" ? item.accessRoles.length === 0 : item.accessRoles.includes(audience));
      const haystack = `${item.title} ${item.text} ${item.tags.join(" ")} ${item.folderName ?? ""}`.toLowerCase();
      return matchesKind && matchesFolder && matchesAudience && haystack.includes(query.trim().toLowerCase());
    });
  }, [audience, folderId, items, query, section, tab]);

  const tags = useMemo(() => {
    return [...new Set(live.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b, "ru"));
  }, [live]);

  async function addMaterial() {
    if (!form.title.trim() || (!form.text.trim() && !form.contentBlocks.length)) return;
    setSaveError("");
    const response = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        kind: form.kind,
        text: form.text.trim() || "Материал собран из визуальных блоков.",
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        folderId: form.folderId || null,
        accessRoles: form.accessRoles,
        contentBlocks: form.contentBlocks,
      }),
    });

    if (!response.ok) {
      setSaveError("Не удалось сохранить материал. Попробуйте ещё раз.");
      return;
    }

    const next = (await response.json()) as Item;
    setItems((current) => [
      {
        ...next,
        folderName: folders.find((folder) => folder.id === next.folderId)?.title ?? null,
      },
      ...current,
    ]);
    setForm({
      ...emptyForm,
      folderId: "",
      accessRoles: [],
      contentBlocks: [],
    });
    setComposerOpen(false);
    setSection("Библиотека");
    setSelectedId(next.id);
  }

  async function updateStatus(id: string, status: Status) {
    setSaveError("");
    const response = await fetch(`/api/materials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setSaveError("Не удалось обновить материал. Попробуйте ещё раз.");
      return;
    }

    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }

  function openEdit(item: Item) {
    setSaveError("");
    setEditForm({
      title: item.title,
      kind: item.kind,
      text: item.text,
      tags: item.tags.join(", "),
      folderId: item.folderId ?? "",
      accessRoles: [...item.accessRoles],
      contentBlocks: structuredClone(item.contentBlocks ?? []),
    });
    setEditingId(item.id);
  }

  function toggleEditAccess(roleToToggle: AccessRole) {
    setEditForm((current) => ({
      ...current,
      accessRoles: current.accessRoles.includes(roleToToggle)
        ? current.accessRoles.filter((role) => role !== roleToToggle)
        : [...current.accessRoles, roleToToggle],
    }));
  }

  async function saveEdit() {
    if (
      !editingId ||
      !editForm.title.trim() ||
      (!editForm.text.trim() && !editForm.contentBlocks.length)
    ) return;

    setSaveError("");

    const response = await fetch(`/api/materials/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title.trim(),
        kind: editForm.kind,
        text: editForm.text.trim() || "Материал собран из визуальных блоков.",
        tags: editForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        folderId: editForm.folderId || null,
        accessRoles: editForm.accessRoles,
        contentBlocks: editForm.contentBlocks,
      }),
    });

    if (!response.ok) {
      setSaveError("Не удалось сохранить изменения. Попробуйте ещё раз.");
      return;
    }

    const updated = (await response.json()) as Item;
    const nextFolderName =
      folders.find((folder) => folder.id === updated.folderId)?.title ?? null;

    setItems((current) =>
      current.map((item) =>
        item.id === editingId
          ? {
              ...item,
              ...updated,
              folderName: nextFolderName,
            }
          : item,
      ),
    );

    setEditingId(null);
  }

  async function deleteMaterial(item: Item) {
    if (!window.confirm(`Удалить «${item.title}»? Это действие нельзя отменить.`)) return;
    setSaveError("");
    const response = await fetch(`/api/materials/${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      setSaveError("Не удалось удалить материал. Попробуйте ещё раз.");
      return;
    }
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    setSelectedId(null);
  }

  async function addFolder() {
    const title = window.prompt("Как назвать папку?");
    if (!title?.trim()) return;
    const response = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    if (!response.ok) {
      setSaveError("Не удалось создать папку. Попробуйте другое название.");
      return;
    }
    const created = await response.json() as Folder;
    setFolders((current) => [...current, created].sort((a, b) => a.title.localeCompare(b.title, "ru")));
  }

  function toggleAccess(roleToToggle: AccessRole) {
    setForm((current) => ({
      ...current,
      accessRoles: current.accessRoles.includes(roleToToggle)
        ? current.accessRoles.filter((role) => role !== roleToToggle)
        : [...current.accessRoles, roleToToggle],
    }));
  }

  function applyTemplate(key: string) {
    const template = materialTemplates[key];
    if (!template) return;
    setForm({
      title: "",
      kind: template.kind,
      text: template.text,
      tags: "",
      folderId: "",
      accessRoles: template.accessRoles,
      contentBlocks: [],
    });
  }

  return (
    <main className="app-shell">
      {menuOpen ? (
        <button
          type="button"
          className="nav-scrim"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <b>Ю</b>
          <span>
            <strong>Дом телесной</strong>
            устойчивости
          </span>
        </div>
        <small className="workspace">Рабочее пространство</small>
        <nav>
          {nav.filter((item) => owner || (item.id !== "Папки" && item.id !== "Архив")).map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? "active" : ""}
              onClick={() => {
                setSection(item.id);
                setMenuOpen(false);
              }}
            >
              <i>{item.icon}</i>
              {item.id}
              {item.id === "Библиотека" ? <em>{live.length}</em> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <p>
            «Тело — опора в жизни»
            
            
          </p>
          <div className="profile">
            <b>{name.slice(0, 1).toUpperCase()}</b>
            <span>
              <strong>{name}</strong>
              {owner ? "Владелец пространства" : role === "trainer" ? "Тренер" : "Участница"}
            </span>
            <i>•••</i>
          </div>
        </div>
      </aside>

      <section className="content">
        <header>
          <span>
            <button
              type="button"
              className="menu-btn"
              onClick={() => setMenuOpen(true)}
            >
              Меню
            </button>
            Пространство Юлии / <strong>{section}</strong>
          </span>
          <aside>
            <form action="/auth/signout" method="post">
              <button type="submit" className="signout">Выйти</button>
            </form>
          </aside>
        </header>

        <div className="body">
          {section === "Главная" ? (
            <>
              <div className="heading">
                <div>
                  <small>Обзор пространства ✦</small>
                  <h1>База знаний Юлии</h1>
                  <p>Методология, практики и материалы в одном рабочем столе.</p>
                </div>
                {owner ? <button
                  type="button"
                  className="add"
                  onClick={() => setComposerOpen(true)}
                >
                  ＋ Добавить материал
                </button> : null}
              </div>
              <div className="section-title">
                <div>
                  <h2>
                    Недавние материалы <small>{live.slice(0, 4).length}</small>
                  </h2>
                  <p>То, с чем команда работает прямо сейчас</p>
                </div>
              </div>
              <MaterialGrid
                items={live.slice(0, 4)}
                onOpen={setSelectedId}
              />
            </>
          ) : null}

          {section === "Папки" && owner ? (
            <>
              <div className="heading"><div><small>Структура библиотеки ✦</small><h1>Папки</h1><p>Создавайте свои разделы, а затем выбирайте папку при добавлении материала.</p></div><button type="button" className="add" onClick={addFolder}>＋ Новая папка</button></div>
              <div className="folder-list">
                {folders.length ? folders.map((folder) => (
                  <button key={folder.id} type="button" onClick={() => { setFolderId(folder.id); setSection("Библиотека"); }}>
                    <span>▱</span><div><strong>{folder.title}</strong><small>{folder.description || "Открыть материалы в папке"}</small></div><em>{items.filter((item) => item.folderId === folder.id).length}</em>
                  </button>
                )) : <Empty text="Создайте первую папку — например, «Основа подхода» или «Клиентская библиотека»." />}
              </div>
            </>
          ) : null}

          {section !== "Главная" && section !== "Папки" ? (
            <>
              <div className="heading">
                <div>
                  <small>{section === "Клиентам" ? "Просто и бережно" : section === "Команде" ? "Ведение и методика" : section === "Практики" ? "По состоянию" : "Единая библиотека"} ✦</small>
                  <h1>{section === "Клиентам" ? "Клиентская библиотека" : section === "Команде" ? "Материалы для команды" : section}</h1>
                  <p>{section === "Клиентам" ? "Понятные материалы без профессионального жаргона." : section === "Команде" ? "Методика, правила и утверждённые сценарии для тренеров." : "Один материал — без копий, с понятным доступом для каждой роли."}</p>
                </div>
                {owner ? <button type="button" className="add" onClick={() => setComposerOpen(true)}>＋ Добавить материал</button> : null}
              </div>
              <div className="toolbar"><label>⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти по названию, содержанию или тегу..." /></label></div>
              <div className="filter-row">
                <select value={tab} onChange={(event) => setTab(event.target.value)}>{Object.keys(filterMap).map((name) => <option key={name}>{name}</option>)}</select>
                {owner ? <select value={folderId} onChange={(event) => setFolderId(event.target.value)}><option value="all">Все папки</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.title}</option>)}</select> : null}
                {owner ? <div className="access-filter"><span>Показывать:</span>{(["all", "owner", "trainer", "client"] as const).map((value) => <button key={value} type="button" className={audience === value ? "chosen" : ""} onClick={() => setAudience(value)}>{value === "all" ? "Все" : value === "owner" ? "Только владельцам" : value === "trainer" ? "Тренерам" : "Клиентам"}</button>)}</div> : null}
              </div>
              {tags.length ? <div className="tag-filter"><span>Теги:</span>{tags.map((tag) => <button key={tag} type="button" onClick={() => setQuery(tag)}>#{tag}</button>)}</div> : null}
              <div className="section-title"><div><h2>Материалы <small>{shown.length}</small></h2><p>Все знания в одном пространстве</p></div></div>
              {shown.length ? <MaterialGrid items={shown} onOpen={setSelectedId} /> : <Empty text="По этому запросу в библиотеке пока пусто." />}
            </>
          ) : null}
        </div>
      </section>

      {composerOpen ? (
        <div className="modal-scrim">
          <div className="modal">
            <h2>Новый материал</h2>
            <label>
              Начните с шаблона
              <select defaultValue="" onChange={(event) => applyTemplate(event.target.value)}>
                <option value="" disabled>Выберите шаблон</option>
                {Object.entries(materialTemplates).map(([key, template]) => (
                  <option key={key} value={key}>{template.label}</option>
                ))}
              </select>
            </label>
            <label>
              Название
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Как называется практика или заметка"
              />
            </label>
            <label>
              Тип
              <select
                value={form.kind}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    kind: event.target.value as Kind,
                  }))
                }
              >
                {(Object.keys(kindIcons) as Kind[]).map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </label>
            <label>
              Папка
              <select
                value={form.folderId}
                onChange={(event) => setForm((current) => ({ ...current, folderId: event.target.value }))}
              >
                <option value="">Без папки</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.title}</option>)}
              </select>
            </label>
            <label>
              Содержание
              <textarea
                value={form.text}
                onChange={(event) =>
                  setForm((current) => ({ ...current, text: event.target.value }))
                }
                placeholder="Коротко, как это войдёт в базу знаний"
              />
            </label>
            <div className="builder-section">
              <div className="builder-title">
                <strong>Дополнительные блоки</strong>
                <small>
                  Фото, галереи, таблицы, графики, схемы, файлы, ссылки и другие элементы.
                </small>
              </div>

              <ContentBlockEditor
                blocks={form.contentBlocks}
                onChange={(contentBlocks) =>
                  setForm((current) => ({
                    ...current,
                    contentBlocks,
                  }))
                }
                materials={items.map((item) => ({
                  id: item.id,
                  title: item.title,
                }))}
              />
            </div>

            <label>
              Теги через запятую
              <input
                value={form.tags}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="дыхание, утро, ресурс"
              />
              <small>Новый тег создаётся автоматически — просто впишите его.</small>
            </label>
            <fieldset className="access-choice">
              <legend>Кому открыть материал</legend>
              <label><input type="checkbox" checked={form.accessRoles.includes("trainer")} onChange={() => toggleAccess("trainer")} /> Тренерам</label>
              <label><input type="checkbox" checked={form.accessRoles.includes("client")} onChange={() => toggleAccess("client")} /> Клиентам</label>
              <small>Владельцы всегда видят все материалы. Без отметок материал доступен только владельцам.</small>
            </fieldset>
            <div className="modal-actions">
              <button type="button" onClick={() => setComposerOpen(false)}>
                Отмена
              </button>
              <button type="button" className="add" onClick={addMaterial}>
                Сохранить черновик
              </button>
            </div>
            {saveError ? <p className="form-error">{saveError}</p> : null}
          </div>
        </div>
      ) : null}

      {editingId ? (
        <div className="modal-scrim">
          <div className="modal">
            <h2>Редактировать материал</h2>

            <label>
              Название
              <input
                value={editForm.title}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Тип
              <select
                value={editForm.kind}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    kind: event.target.value as Kind,
                  }))
                }
              >
                {(Object.keys(kindIcons) as Kind[]).map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </label>

            <label>
              Папка
              <select
                value={editForm.folderId}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    folderId: event.target.value,
                  }))
                }
              >
                <option value="">Без папки</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Содержание
              <textarea
                value={editForm.text}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    text: event.target.value,
                  }))
                }
              />
            </label>

            <div className="builder-section">
              <div className="builder-title">
                <strong>Конструктор материала</strong>
                <small>
                  Добавляйте блоки, меняйте порядок, скрывайте или дублируйте их.
                </small>
              </div>

              <ContentBlockEditor
                blocks={editForm.contentBlocks}
                onChange={(contentBlocks) =>
                  setEditForm((current) => ({
                    ...current,
                    contentBlocks,
                  }))
                }
                materials={items
                  .filter((item) => item.id !== editingId)
                  .map((item) => ({
                    id: item.id,
                    title: item.title,
                  }))}
              />
            </div>

            <label>
              Теги
              <input
                value={editForm.tags}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    tags: event.target.value,
                  }))
                }
                placeholder="Введите свои теги через запятую"
              />
              <small>
                Используйте только те теги, которые удобны вам для навигации.
              </small>
            </label>

            <fieldset className="access-choice">
              <legend>Кому открыть материал</legend>

              <label>
                <input
                  type="checkbox"
                  checked={editForm.accessRoles.includes("trainer")}
                  onChange={() => toggleEditAccess("trainer")}
                />
                Тренерам
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={editForm.accessRoles.includes("client")}
                  onChange={() => toggleEditAccess("client")}
                />
                Клиентам
              </label>

              <small>
                Если ничего не выбрано, материал видит только владелец.
              </small>
            </fieldset>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setSaveError("");
                }}
              >
                Отмена
              </button>

              <button
                type="button"
                className="add"
                onClick={saveEdit}
              >
                Сохранить изменения
              </button>
            </div>

            {saveError ? <p className="form-error">{saveError}</p> : null}
          </div>
        </div>
      ) : null}

      {selected && !editingId ? (
        <div className="modal-scrim">
          <div className="modal">
            <small>{selected.kind} · {accessLabel(selected.accessRoles)}</small>
            <h2>{selected.title}</h2>
            <p className="material-main-text">{selected.text}</p>

            {selected.contentBlocks?.length ? (
              <ContentBlockRenderer
                blocks={selected.contentBlocks}
                materials={items.map((item) => ({
                  id: item.id,
                  title: item.title,
                }))}
                onOpenMaterial={(id) => setSelectedId(id)}
              />
            ) : null}

            <div className="tags">
              {selected.folderName ? <span className="folder-chip">▱ {selected.folderName}</span> : null}
              {selected.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
            {owner ? <div className="modal-actions">
              <button type="button" onClick={() => openEdit(selected)}>
                Редактировать
              </button>
              <button type="button" className="danger" onClick={() => deleteMaterial(selected)}>
                Удалить
              </button>
              {selected.status !== "Опубликовано" ? (
                <button
                  type="button"
                  className="add"
                  onClick={() => updateStatus(selected.id, "Опубликовано")}
                >
                  Опубликовать
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateStatus(selected.id, "Черновик")}
                >
                  Вернуть в черновик
                </button>
              )}
              {selected.status !== "Архив" ? (
                <button
                  type="button"
                  onClick={() => updateStatus(selected.id, "Архив")}
                >
                  В архив
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateStatus(selected.id, "Черновик")}
                >
                  Достать из архива
                </button>
              )}
              <button type="button" onClick={() => setSelectedId(null)}>
                Закрыть
              </button>
            </div> : <div className="modal-actions"><button type="button" onClick={() => setSelectedId(null)}>Закрыть</button></div>}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function MaterialGrid({
  items,
  onOpen,
}: {
  items: Item[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid">
      {items.map((item) => (
        <article key={item.id}>
          <div className="material-icon">{item.icon}</div>
          <div className="card">
            <div className="card-top">
              <small>{item.kind}</small>
              <button type="button" onClick={() => onOpen(item.id)}>
                •••
              </button>
            </div>
            <h3>
              <button type="button" onClick={() => onOpen(item.id)}>
                {item.title}
              </button>
            </h3>
            <p>{item.text}</p>
            <div className="tags">
              {item.folderName ? <span className="folder-chip">▱ {item.folderName}</span> : null}
              <span className="access-chip">{accessLabel(item.accessRoles)}</span>
              {item.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
            <footer>
              <span className={statusClass(item.status)}>● {item.status}</span>
              <time>{item.date}</time>
            </footer>
          </div>
        </article>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
