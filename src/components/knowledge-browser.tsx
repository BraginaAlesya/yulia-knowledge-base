"use client";

import { useMemo, useState } from "react";

type Kind = "Практика" | "Методика" | "Статья" | "Видео" | "Аудио" | "Заметка";
type Status = "Опубликовано" | "Черновик" | "Архив";
type Section =
  | "Главная"
  | "Материалы"
  | "Категории"
  | "Теги"
  | "Архив"
  | "Настройки";

type Item = {
  id: string;
  title: string;
  kind: Kind;
  text: string;
  tags: string[];
  status: Status;
  date: string;
  icon: string;
};

const nav: { id: Section; icon: string }[] = [
  { id: "Главная", icon: "⌂" },
  { id: "Материалы", icon: "▤" },
  { id: "Категории", icon: "◫" },
  { id: "Теги", icon: "#" },
  { id: "Архив", icon: "□" },
  { id: "Настройки", icon: "⚙" },
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

function statusClass(status: Status) {
  if (status === "Опубликовано") return "published";
  if (status === "Черновик") return "draft";
  return "archived";
}

export default function KnowledgeBrowser({ initialItems }: { initialItems: Item[] }) {
  const [section, setSection] = useState<Section>("Материалы");
  const [tab, setTab] = useState("Все материалы");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(initialItems);
  const [menuOpen, setMenuOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const live = items.filter((item) => item.status !== "Архив");
  const archived = items.filter((item) => item.status === "Архив");
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const shown = useMemo(() => {
    const kind = filterMap[tab];
    return items.filter((item) => {
      if (item.status === "Архив") return false;
      const matchesKind = kind === "all" || item.kind === kind;
      const haystack = `${item.title} ${item.text} ${item.tags.join(" ")}`.toLowerCase();
      return matchesKind && haystack.includes(query.trim().toLowerCase());
    });
  }, [items, query, tab]);

  const categories = useMemo(() => {
    return (Object.keys(kindIcons) as Kind[]).map((kind) => ({
      kind,
      icon: kindIcons[kind],
      count: live.filter((item) => item.kind === kind).length,
    }));
  }, [live]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of live) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [live]);

  async function addMaterial() {
    if (!form.title.trim() || !form.text.trim()) return;
    setSaveError("");
    const response = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        kind: form.kind,
        text: form.text.trim(),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
    });

    if (!response.ok) {
      setSaveError("Не удалось сохранить материал. Попробуйте ещё раз.");
      return;
    }

    const next = (await response.json()) as Item;
    setItems((current) => [next, ...current]);
    setForm(emptyForm);
    setComposerOpen(false);
    setSection("Материалы");
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
          {nav.map((item) => (
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
              {item.id === "Материалы" ? <em>{live.length}</em> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <p>
            «Тело — это место,
            <br />
            куда всегда можно вернуться»
          </p>
          <div className="profile">
            <b>Ю</b>
            <span>
              <strong>Юлия</strong>
              Автор пространства
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
            <span>⌕</span>
            <span>♧</span>
            <b>Ю</b>
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
                <button
                  type="button"
                  className="add"
                  onClick={() => setComposerOpen(true)}
                >
                  ＋ Добавить материал
                </button>
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

          {section === "Материалы" ? (
            <>
              <div className="heading">
                <div>
                  <small>Коллекция знаний ✦</small>
                  <h1>База знаний</h1>
                  <p>Методология, практики и материалы Юлии</p>
                </div>
                <button
                  type="button"
                  className="add"
                  onClick={() => setComposerOpen(true)}
                >
                  ＋ Добавить материал
                </button>
              </div>
              
              <div className="toolbar">
                <label>
                  ⌕
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Найти материал..."
                  />
                </label>
                <button type="button">Сначала новые ⌄</button>
              </div>
              <div className="filters">
                {Object.keys(filterMap).map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={tab === name ? "chosen" : ""}
                    onClick={() => setTab(name)}
                  >
                    {name}
                    {name === "Все материалы" ? <sup>{live.length}</sup> : null}
                  </button>
                ))}
              </div>
              <div className="section-title">
                <div>
                  <h2>
                    Материалы <small>{shown.length}</small>
                  </h2>
                  <p>Все знания в одном пространстве</p>
                </div>
                <span>▦ ☷</span>
              </div>
              {shown.length ? (
                <MaterialGrid items={shown} onOpen={setSelectedId} />
              ) : (
                <Empty text="По этому запросу в коллекции пока пусто." />
              )}
            </>
          ) : null}

          {section === "Категории" ? (
            <>
              <PageIntro
                kicker="Структура"
                title="Категории"
                text="Типы материалов, из которых складывается методология Юлии."
              />
              <div className="category-grid">
                {categories.map((category) => (
                  <button
                    key={category.kind}
                    type="button"
                    className="category-card"
                    onClick={() => {
                      setTab(
                        Object.entries(filterMap).find(
                          ([, kind]) => kind === category.kind,
                        )?.[0] ?? "Все материалы",
                      );
                      setSection("Материалы");
                    }}
                  >
                    <span>{category.icon}</span>
                    <strong>{category.kind}</strong>
                    <small>{category.count} в коллекции</small>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {section === "Теги" ? (
            <>
              <PageIntro
                kicker="Навигация"
                title="Теги"
                text="Живые темы, которыми помечены практики, статьи и заметки."
              />
              <div className="tag-cloud">
                {tags.map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setQuery(tag);
                      setTab("Все материалы");
                      setSection("Материалы");
                    }}
                  >
                    #{tag}
                    <em>{count}</em>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {section === "Архив" ? (
            <>
              <PageIntro
                kicker="Память"
                title="Архив"
                text="Материалы, которые больше не показываем в рабочей коллекции."
              />
              {archived.length ? (
                <MaterialGrid items={archived} onOpen={setSelectedId} />
              ) : (
                <Empty text="Архив пуст — всё ещё в живой коллекции." />
              )}
            </>
          ) : null}

          {section === "Настройки" ? (
            <>
              <PageIntro
                kicker="Пространство"
                title="Настройки"
                text="Параметры рабочего пространства и доступов."
              />
              <div className="settings">
                <label>
                  Название пространства
                  <input defaultValue="Дом телесной устойчивости" />
                </label>
                <label>
                  Автор
                  <input defaultValue="Юлия" />
                </label>
                <label>
                  Тон базы знаний
                  <input defaultValue="Тёплый, телесный, без давления" />
                </label>
                <p>Настройки пространства будут подключены следующим этапом.</p>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {composerOpen ? (
        <div className="modal-scrim">
          <div className="modal">
            <h2>Новый материал</h2>
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
              Описание
              <textarea
                value={form.text}
                onChange={(event) =>
                  setForm((current) => ({ ...current, text: event.target.value }))
                }
                placeholder="Коротко, как это войдёт в базу знаний"
              />
            </label>
            <label>
              Теги через запятую
              <input
                value={form.tags}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="дыхание, утро, ресурс"
              />
            </label>
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

      {selected ? (
        <div className="modal-scrim">
          <div className="modal">
            <small>{selected.kind}</small>
            <h2>{selected.title}</h2>
            <p>{selected.text}</p>
            <div className="tags">
              {selected.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
            <div className="modal-actions">
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
            </div>
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

function PageIntro({
  kicker,
  title,
  text,
}: {
  kicker: string;
  title: string;
  text: string;
}) {
  return (
    <div className="heading">
      <div>
        <small>{kicker} ✦</small>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
