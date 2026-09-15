"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type BlockType =
  | "text"
  | "heading"
  | "callout"
  | "checklist"
  | "steps"
  | "image"
  | "gallery"
  | "video"
  | "audio"
  | "file"
  | "link"
  | "table"
  | "chart"
  | "diagram"
  | "drawing"
  | "cards"
  | "comparison"
  | "quote"
  | "accordion"
  | "timeline"
  | "internal_link"
  | "button"
  | "divider";

export type ContentBlock = {
  id: string;
  type: BlockType;
  hidden?: boolean;
  data: any;
};

type MaterialOption = {
  id: string;
  title: string;
};

const blockLabels: Record<BlockType, string> = {
  text: "Текст",
  heading: "Заголовок",
  callout: "Выделение / безопасность",
  checklist: "Чек-лист",
  steps: "Пошаговая инструкция",
  image: "Фото",
  gallery: "Галерея",
  video: "Видео",
  audio: "Аудио",
  file: "Файл",
  link: "Ссылка",
  table: "Таблица",
  chart: "График",
  diagram: "Схема / ответвления",
  drawing: "Зарисовка",
  cards: "Карточки",
  comparison: "Сравнение",
  quote: "Цитата",
  accordion: "Раскрывающиеся блоки",
  timeline: "Таймлайн",
  internal_link: "Ссылка на материал платформы",
  button: "Кнопка",
  divider: "Разделитель",
};

function id() {
  return crypto.randomUUID();
}

function defaultData(type: BlockType): any {
  switch (type) {
    case "text":
      return { text: "" };
    case "heading":
      return { text: "", level: 2 };
    case "callout":
      return { tone: "important", title: "Важно", text: "" };
    case "checklist":
      return { items: [""] };
    case "steps":
      return { items: [""] };
    case "image":
      return { path: "", name: "", caption: "" };
    case "gallery":
      return { assets: [] };
    case "video":
      return { path: "", url: "", caption: "" };
    case "audio":
      return { path: "", caption: "" };
    case "file":
      return { path: "", name: "", caption: "" };
    case "link":
      return { url: "", title: "", description: "" };
    case "table":
      return {
        rows: [
          ["Колонка 1", "Колонка 2"],
          ["", ""],
        ],
      };
    case "chart":
      return {
        chartType: "bar",
        title: "",
        labels: ["Пункт 1", "Пункт 2"],
        values: [10, 20],
      };
    case "diagram":
      return { center: "Главная мысль", branches: ["Ветка 1", "Ветка 2"] };
    case "drawing":
      return { path: "", caption: "" };
    case "cards":
      return { items: [{ title: "", text: "" }] };
    case "comparison":
      return {
        leftTitle: "Вариант 1",
        rightTitle: "Вариант 2",
        leftItems: [""],
        rightItems: [""],
      };
    case "quote":
      return { text: "", author: "" };
    case "accordion":
      return { items: [{ title: "", text: "" }] };
    case "timeline":
      return { items: [{ title: "", text: "" }] };
    case "internal_link":
      return { materialId: "" };
    case "button":
      return { label: "Открыть", url: "" };
    case "divider":
      return {};
  }
}

async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error("upload failed");
  }

  return await response.json() as {
    path: string;
    name: string;
    mimeType: string;
  };
}

export function ContentBlockEditor({
  blocks,
  onChange,
  materials,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  materials: MaterialOption[];
}) {
  const [newType, setNewType] = useState<BlockType>("text");

  function addBlock(type: BlockType) {
    onChange([
      ...blocks,
      {
        id: id(),
        type,
        data: defaultData(type),
      },
    ]);
  }

  function updateBlock(blockId: string, data: any) {
    onChange(
      blocks.map((block) =>
        block.id === blockId
          ? { ...block, data: { ...block.data, ...data } }
          : block,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...blocks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function duplicate(block: ContentBlock, index: number) {
    const next = [...blocks];
    next.splice(index + 1, 0, {
      ...block,
      id: id(),
      data: structuredClone(block.data),
    });
    onChange(next);
  }

  function remove(blockId: string) {
    if (!window.confirm("Удалить этот блок?")) return;
    onChange(blocks.filter((block) => block.id !== blockId));
  }

  function toggleHidden(blockId: string) {
    onChange(
      blocks.map((block) =>
        block.id === blockId
          ? { ...block, hidden: !block.hidden }
          : block,
      ),
    );
  }

  return (
    <div className="block-editor">
      <div className="block-add">
        <select
          value={newType}
          onChange={(event) => setNewType(event.target.value as BlockType)}
        >
          {Object.entries(blockLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button type="button" onClick={() => addBlock(newType)}>
          ＋ Добавить блок
        </button>
      </div>

      {!blocks.length ? (
        <div className="block-empty">
          Добавляйте текст, фото, таблицы, схемы, файлы и другие элементы.
        </div>
      ) : null}

      {blocks.map((block, index) => (
        <div
          className={`editor-block ${block.hidden ? "is-hidden" : ""}`}
          key={block.id}
        >
          <div className="editor-block-head">
            <strong>{blockLabels[block.type]}</strong>

            <div>
              <button type="button" onClick={() => move(index, -1)}>
                ↑
              </button>
              <button type="button" onClick={() => move(index, 1)}>
                ↓
              </button>
              <button type="button" onClick={() => duplicate(block, index)}>
                Дублировать
              </button>
              <button type="button" onClick={() => toggleHidden(block.id)}>
                {block.hidden ? "Показать" : "Скрыть"}
              </button>
              <button type="button" onClick={() => remove(block.id)}>
                Удалить
              </button>
            </div>
          </div>

          <BlockFields
            block={block}
            update={(data) => updateBlock(block.id, data)}
            materials={materials}
          />
        </div>
      ))}
    </div>
  );
}

function BlockFields({
  block,
  update,
  materials,
}: {
  block: ContentBlock;
  update: (data: any) => void;
  materials: MaterialOption[];
}) {
  const d = block.data;

  if (block.type === "text") {
    return (
      <textarea
        value={d.text}
        onChange={(e) => update({ text: e.target.value })}
        placeholder="Текст..."
      />
    );
  }

  if (block.type === "heading") {
    return (
      <div className="block-fields-row">
        <select
          value={d.level}
          onChange={(e) => update({ level: Number(e.target.value) })}
        >
          <option value={2}>Большой заголовок</option>
          <option value={3}>Подзаголовок</option>
        </select>
        <input
          value={d.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="Текст заголовка"
        />
      </div>
    );
  }

  if (block.type === "callout") {
    return (
      <>
        <div className="block-fields-row">
          <select
            value={d.tone}
            onChange={(e) => update({ tone: e.target.value })}
          >
            <option value="important">Важно</option>
            <option value="safety">Безопасность / ограничения</option>
            <option value="note">Заметка</option>
          </select>

          <input
            value={d.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Заголовок"
          />
        </div>

        <textarea
          value={d.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="Текст блока"
        />
      </>
    );
  }

  if (block.type === "checklist" || block.type === "steps") {
    return (
      <textarea
        value={(d.items ?? []).join("\n")}
        onChange={(e) =>
          update({ items: e.target.value.split("\n") })
        }
        placeholder="Каждый пункт с новой строки"
      />
    );
  }

  if (block.type === "image") {
    return (
      <>
        <AssetUploader
          accept="image/*"
          onUploaded={(asset) => update(asset)}
        />
        {d.path ? (
          <img
            className="editor-preview-image"
            src={`/api/assets?path=${encodeURIComponent(d.path)}`}
            alt=""
          />
        ) : null}
        <input
          value={d.caption ?? ""}
          onChange={(e) => update({ caption: e.target.value })}
          placeholder="Подпись к фото"
        />
      </>
    );
  }

  if (block.type === "gallery") {
    return (
      <>
        <AssetUploader
          accept="image/*"
          multiple
          onUploaded={(asset) =>
            update({ assets: [...(d.assets ?? []), asset] })
          }
        />

        <div className="editor-gallery">
          {(d.assets ?? []).map((asset: any, index: number) => (
            <div key={`${asset.path}-${index}`}>
              <img
                src={`/api/assets?path=${encodeURIComponent(asset.path)}`}
                alt=""
              />
              <button
                type="button"
                onClick={() =>
                  update({
                    assets: d.assets.filter((_: any, i: number) => i !== index),
                  })
                }
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (block.type === "video") {
    return (
      <>
        <AssetUploader
          accept="video/*"
          onUploaded={(asset) => update(asset)}
        />

        <input
          value={d.url ?? ""}
          onChange={(e) => update({ url: e.target.value })}
          placeholder="Или ссылка на YouTube / Rutube / VK"
        />

        <input
          value={d.caption ?? ""}
          onChange={(e) => update({ caption: e.target.value })}
          placeholder="Подпись"
        />
      </>
    );
  }

  if (block.type === "audio") {
    return (
      <>
        <AssetUploader
          accept="audio/*"
          onUploaded={(asset) => update(asset)}
        />

        <input
          value={d.caption ?? ""}
          onChange={(e) => update({ caption: e.target.value })}
          placeholder="Название или подпись"
        />
      </>
    );
  }

  if (block.type === "file") {
    return (
      <>
        <AssetUploader
          onUploaded={(asset) => update(asset)}
        />

        <input
          value={d.caption ?? ""}
          onChange={(e) => update({ caption: e.target.value })}
          placeholder="Описание файла"
        />
      </>
    );
  }

  if (block.type === "link") {
    return (
      <>
        <input
          value={d.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Название ссылки"
        />
        <input
          value={d.url}
          onChange={(e) => update({ url: e.target.value })}
          placeholder="https://..."
        />
        <textarea
          value={d.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Короткое пояснение"
        />
      </>
    );
  }

  if (block.type === "table") {
    return (
      <TableEditor
        rows={d.rows ?? [[""]]}
        onChange={(rows) => update({ rows })}
      />
    );
  }

  if (block.type === "chart") {
    return (
      <>
        <div className="block-fields-row">
          <select
            value={d.chartType}
            onChange={(e) => update({ chartType: e.target.value })}
          >
            <option value="bar">Столбцы</option>
            <option value="line">Линия</option>
            <option value="pie">Круговая</option>
          </select>

          <input
            value={d.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Название графика"
          />
        </div>

        <input
          value={(d.labels ?? []).join(", ")}
          onChange={(e) =>
            update({
              labels: e.target.value.split(",").map((v) => v.trim()),
            })
          }
          placeholder="Подписи: Январь, Февраль, Март"
        />

        <input
          value={(d.values ?? []).join(", ")}
          onChange={(e) =>
            update({
              values: e.target.value
                .split(",")
                .map((v) => Number(v.trim()) || 0),
            })
          }
          placeholder="Значения: 10, 20, 35"
        />

        <ChartBlock data={d} />
      </>
    );
  }

  if (block.type === "diagram") {
    return (
      <>
        <input
          value={d.center}
          onChange={(e) => update({ center: e.target.value })}
          placeholder="Центральная мысль"
        />

        <textarea
          value={(d.branches ?? []).join("\n")}
          onChange={(e) =>
            update({ branches: e.target.value.split("\n") })
          }
          placeholder="Каждое ответвление с новой строки"
        />

        <DiagramBlock data={d} />
      </>
    );
  }

  if (block.type === "drawing") {
    return (
      <>
        <DrawingEditor
          onSaved={(asset) => update(asset)}
        />

        {d.path ? (
          <img
            className="drawing-preview"
            src={`/api/assets?path=${encodeURIComponent(d.path)}`}
            alt=""
          />
        ) : null}

        <input
          value={d.caption ?? ""}
          onChange={(e) => update({ caption: e.target.value })}
          placeholder="Подпись к зарисовке"
        />
      </>
    );
  }

  if (block.type === "cards") {
    return (
      <PairListEditor
        items={d.items ?? []}
        firstPlaceholder="Название карточки"
        secondPlaceholder="Текст"
        onChange={(items) => update({ items })}
      />
    );
  }

  if (block.type === "comparison") {
    return (
      <>
        <div className="block-fields-row">
          <input
            value={d.leftTitle}
            onChange={(e) => update({ leftTitle: e.target.value })}
          />
          <input
            value={d.rightTitle}
            onChange={(e) => update({ rightTitle: e.target.value })}
          />
        </div>

        <div className="comparison-editor">
          <textarea
            value={(d.leftItems ?? []).join("\n")}
            onChange={(e) =>
              update({ leftItems: e.target.value.split("\n") })
            }
            placeholder="Левая колонка"
          />
          <textarea
            value={(d.rightItems ?? []).join("\n")}
            onChange={(e) =>
              update({ rightItems: e.target.value.split("\n") })
            }
            placeholder="Правая колонка"
          />
        </div>
      </>
    );
  }

  if (block.type === "quote") {
    return (
      <>
        <textarea
          value={d.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="Цитата"
        />
        <input
          value={d.author}
          onChange={(e) => update({ author: e.target.value })}
          placeholder="Автор / источник"
        />
      </>
    );
  }

  if (block.type === "accordion" || block.type === "timeline") {
    return (
      <PairListEditor
        items={d.items ?? []}
        firstPlaceholder={
          block.type === "accordion" ? "Заголовок / вопрос" : "Этап"
        }
        secondPlaceholder={
          block.type === "accordion" ? "Содержание / ответ" : "Описание"
        }
        onChange={(items) => update({ items })}
      />
    );
  }

  if (block.type === "internal_link") {
    return (
      <select
        value={d.materialId ?? ""}
        onChange={(e) => update({ materialId: e.target.value })}
      >
        <option value="">Выберите материал</option>
        {materials.map((material) => (
          <option key={material.id} value={material.id}>
            {material.title}
          </option>
        ))}
      </select>
    );
  }

  if (block.type === "button") {
    return (
      <div className="block-fields-row">
        <input
          value={d.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder="Текст кнопки"
        />
        <input
          value={d.url}
          onChange={(e) => update({ url: e.target.value })}
          placeholder="https://..."
        />
      </div>
    );
  }

  return <div className="divider-preview" />;
}

function AssetUploader({
  accept,
  multiple,
  onUploaded,
}: {
  accept?: string;
  multiple?: boolean;
  onUploaded: (asset: any) => void;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <label className="asset-uploader">
      {loading ? "Загрузка..." : multiple ? "＋ Добавить файлы" : "＋ Выбрать файл"}

      <input
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={async (event) => {
          const files = [...(event.target.files ?? [])];
          if (!files.length) return;

          setLoading(true);

          try {
            for (const file of files) {
              const asset = await uploadFile(file);
              onUploaded(asset);
            }
          } catch {
            window.alert("Не удалось загрузить файл.");
          } finally {
            setLoading(false);
            event.target.value = "";
          }
        }}
      />
    </label>
  );
}

function PairListEditor({
  items,
  firstPlaceholder,
  secondPlaceholder,
  onChange,
}: {
  items: { title: string; text: string }[];
  firstPlaceholder: string;
  secondPlaceholder: string;
  onChange: (items: { title: string; text: string }[]) => void;
}) {
  return (
    <div className="pair-list-editor">
      {items.map((item, index) => (
        <div key={index}>
          <input
            value={item.title}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, title: e.target.value };
              onChange(next);
            }}
            placeholder={firstPlaceholder}
          />
          <textarea
            value={item.text}
            onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, text: e.target.value };
              onChange(next);
            }}
            placeholder={secondPlaceholder}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            Удалить
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, { title: "", text: "" }])}
      >
        ＋ Добавить
      </button>
    </div>
  );
}

function TableEditor({
  rows,
  onChange,
}: {
  rows: string[][];
  onChange: (rows: string[][]) => void;
}) {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));

  return (
    <div className="table-editor">
      <table>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columnCount }).map((_, columnIndex) => (
                <td key={columnIndex}>
                  <input
                    value={row[columnIndex] ?? ""}
                    onChange={(e) => {
                      const next = rows.map((item) => [...item]);
                      while (next[rowIndex].length < columnCount) {
                        next[rowIndex].push("");
                      }
                      next[rowIndex][columnIndex] = e.target.value;
                      onChange(next);
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="table-actions">
        <button
          type="button"
          onClick={() =>
            onChange([...rows, Array.from({ length: columnCount }, () => "")])
          }
        >
          ＋ Строка
        </button>

        <button
          type="button"
          onClick={() => onChange(rows.map((row) => [...row, ""]))}
        >
          ＋ Колонка
        </button>

        {rows.length > 1 ? (
          <button
            type="button"
            onClick={() => onChange(rows.slice(0, -1))}
          >
            − Строка
          </button>
        ) : null}

        {columnCount > 1 ? (
          <button
            type="button"
            onClick={() => onChange(rows.map((row) => row.slice(0, -1)))}
          >
            − Колонка
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DrawingEditor({
  onSaved,
}: {
  onSaved: (asset: any) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  function position(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = ref.current!;
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  return (
    <div className="drawing-editor">
      <canvas
        ref={ref}
        width={900}
        height={420}
        onPointerDown={(event) => {
          drawing.current = true;
          const canvas = ref.current!;
          const ctx = canvas.getContext("2d")!;
          const p = position(event);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const canvas = ref.current!;
          const ctx = canvas.getContext("2d")!;
          const p = position(event);
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerLeave={() => {
          drawing.current = false;
        }}
      />

      <div className="drawing-actions">
        <button
          type="button"
          onClick={() => {
            const canvas = ref.current!;
            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }}
        >
          Очистить
        </button>

        <button
          type="button"
          onClick={() => {
            const canvas = ref.current!;

            canvas.toBlob(async (blob) => {
              if (!blob) return;

              const file = new File(
                [blob],
                `drawing-${Date.now()}.png`,
                { type: "image/png" },
              );

              try {
                const asset = await uploadFile(file);
                onSaved(asset);
              } catch {
                window.alert("Не удалось сохранить зарисовку.");
              }
            }, "image/png");
          }}
        >
          Сохранить зарисовку
        </button>
      </div>
    </div>
  );
}

export function ContentBlockRenderer({
  blocks,
  materials,
  onOpenMaterial,
}: {
  blocks: ContentBlock[];
  materials: MaterialOption[];
  onOpenMaterial?: (id: string) => void;
}) {
  return (
    <div className="content-block-renderer">
      {blocks
        .filter((block) => !block.hidden)
        .map((block) => (
          <RenderedBlock
            key={block.id}
            block={block}
            materials={materials}
            onOpenMaterial={onOpenMaterial}
          />
        ))}
    </div>
  );
}

function RenderedBlock({
  block,
  materials,
  onOpenMaterial,
}: {
  block: ContentBlock;
  materials: MaterialOption[];
  onOpenMaterial?: (id: string) => void;
}) {
  const d = block.data;

  if (block.type === "text") {
    return <div className="content-text">{d.text}</div>;
  }

  if (block.type === "heading") {
    return d.level === 3
      ? <h3 className="content-heading">{d.text}</h3>
      : <h2 className="content-heading">{d.text}</h2>;
  }

  if (block.type === "callout") {
    return (
      <div className={`content-callout ${d.tone}`}>
        <strong>{d.title}</strong>
        <div>{d.text}</div>
      </div>
    );
  }

  if (block.type === "checklist") {
    return (
      <ul className="content-checklist">
        {(d.items ?? []).filter(Boolean).map((item: string, index: number) => (
          <li key={index}>✓ {item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "steps") {
    return (
      <ol className="content-steps">
        {(d.items ?? []).filter(Boolean).map((item: string, index: number) => (
          <li key={index}>{item}</li>
        ))}
      </ol>
    );
  }

  if (block.type === "image") {
    return d.path ? (
      <figure className="content-image">
        <img
          src={`/api/assets?path=${encodeURIComponent(d.path)}`}
          alt={d.caption ?? ""}
        />
        {d.caption ? <figcaption>{d.caption}</figcaption> : null}
      </figure>
    ) : null;
  }

  if (block.type === "gallery") {
    return (
      <div className="content-gallery">
        {(d.assets ?? []).map((asset: any, index: number) => (
          <img
            key={`${asset.path}-${index}`}
            src={`/api/assets?path=${encodeURIComponent(asset.path)}`}
            alt=""
          />
        ))}
      </div>
    );
  }

  if (block.type === "video") {
    return (
      <div className="content-media">
        {d.path ? (
          <video
            controls
            src={`/api/assets?path=${encodeURIComponent(d.path)}`}
          />
        ) : null}

        {d.url ? (
          <a href={d.url} target="_blank" rel="noreferrer">
            Открыть видео ↗
          </a>
        ) : null}

        {d.caption ? <small>{d.caption}</small> : null}
      </div>
    );
  }

  if (block.type === "audio") {
    return d.path ? (
      <div className="content-media">
        <audio
          controls
          src={`/api/assets?path=${encodeURIComponent(d.path)}`}
        />
        {d.caption ? <small>{d.caption}</small> : null}
      </div>
    ) : null;
  }

  if (block.type === "file") {
    return d.path ? (
      <a
        className="content-file"
        href={`/api/assets?path=${encodeURIComponent(d.path)}`}
        target="_blank"
        rel="noreferrer"
      >
        <strong>{d.name || "Файл"}</strong>
        <span>{d.caption || "Открыть файл"} ↗</span>
      </a>
    ) : null;
  }

  if (block.type === "link") {
    return (
      <a
        className="content-link-card"
        href={d.url}
        target="_blank"
        rel="noreferrer"
      >
        <strong>{d.title || d.url}</strong>
        {d.description ? <span>{d.description}</span> : null}
        <small>{d.url}</small>
      </a>
    );
  }

  if (block.type === "table") {
    return (
      <div className="content-table-wrap">
        <table className="content-table">
          <tbody>
            {(d.rows ?? []).map((row: string[], rowIndex: number) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) =>
                  rowIndex === 0 ? (
                    <th key={cellIndex}>{cell}</th>
                  ) : (
                    <td key={cellIndex}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === "chart") {
    return <ChartBlock data={d} />;
  }

  if (block.type === "diagram") {
    return <DiagramBlock data={d} />;
  }

  if (block.type === "drawing") {
    return d.path ? (
      <figure className="content-image">
        <img
          src={`/api/assets?path=${encodeURIComponent(d.path)}`}
          alt={d.caption ?? ""}
        />
        {d.caption ? <figcaption>{d.caption}</figcaption> : null}
      </figure>
    ) : null;
  }

  if (block.type === "cards") {
    return (
      <div className="content-cards">
        {(d.items ?? []).map((item: any, index: number) => (
          <div key={index}>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "comparison") {
    return (
      <div className="content-comparison">
        <div>
          <strong>{d.leftTitle}</strong>
          <ul>
            {(d.leftItems ?? []).filter(Boolean).map((item: string, index: number) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <strong>{d.rightTitle}</strong>
          <ul>
            {(d.rightItems ?? []).filter(Boolean).map((item: string, index: number) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (block.type === "quote") {
    return (
      <blockquote className="content-quote">
        <p>{d.text}</p>
        {d.author ? <footer>{d.author}</footer> : null}
      </blockquote>
    );
  }

  if (block.type === "accordion") {
    return (
      <div className="content-accordion">
        {(d.items ?? []).map((item: any, index: number) => (
          <details key={index}>
            <summary>{item.title}</summary>
            <p>{item.text}</p>
          </details>
        ))}
      </div>
    );
  }

  if (block.type === "timeline") {
    return (
      <div className="content-timeline">
        {(d.items ?? []).map((item: any, index: number) => (
          <div key={index}>
            <span>{index + 1}</span>
            <section>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </section>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "internal_link") {
    const material = materials.find((item) => item.id === d.materialId);
    if (!material) return null;

    return (
      <button
        className="content-internal-link"
        type="button"
        onClick={() => onOpenMaterial?.(material.id)}
      >
        <span>Материал платформы</span>
        <strong>{material.title}</strong>
        <small>Открыть →</small>
      </button>
    );
  }

  if (block.type === "button") {
    return (
      <a
        className="content-button"
        href={d.url}
        target="_blank"
        rel="noreferrer"
      >
        {d.label}
      </a>
    );
  }

  return <hr className="content-divider" />;
}

function ChartBlock({ data }: { data: any }) {
  const labels = data.labels ?? [];
  const values = (data.values ?? []).map((value: any) => Number(value) || 0);
  const max = Math.max(...values, 1);

  if (data.chartType === "line") {
    const width = 600;
    const height = 220;
    const points = values.map((value: number, index: number) => {
      const x =
        values.length <= 1
          ? width / 2
          : (index / (values.length - 1)) * (width - 40) + 20;
      const y = height - 30 - (value / max) * (height - 60);
      return `${x},${y}`;
    });

    return (
      <div className="content-chart">
        {data.title ? <strong>{data.title}</strong> : null}
        <svg viewBox={`0 0 ${width} ${height}`}>
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
          />
        </svg>
        <div className="chart-labels">
          {labels.map((label: string, index: number) => (
            <span key={index}>{label}</span>
          ))}
        </div>
      </div>
    );
  }

  if (data.chartType === "pie") {
    const total = values.reduce((sum: number, value: number) => sum + value, 0) || 1;
    const colors = ["#56252d", "#a46e68", "#d5ada1", "#d7c8b6", "#8f7366", "#b59b84"];

    const gradient = values
      .map((value: number, index: number) => {
        const start = values
          .slice(0, index)
          .reduce((sum: number, previous: number) => sum + previous, 0);
        const end = start + value;
        return `${colors[index % colors.length]} ${(start / total) * 360}deg ${(end / total) * 360}deg`;
      })
      .join(", ");

    return (
      <div className="content-chart">
        {data.title ? <strong>{data.title}</strong> : null}
        <div className="pie-layout">
          <div
            className="pie-chart"
            style={{ background: `conic-gradient(${gradient})` }}
          />
          <div>
            {labels.map((label: string, index: number) => (
              <p key={index}>
                {label}: <b>{values[index] ?? 0}</b>
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-chart">
      {data.title ? <strong>{data.title}</strong> : null}

      <div className="bar-chart">
        {values.map((value: number, index: number) => (
          <div key={index}>
            <b>{value}</b>
            <i style={{ height: `${Math.max(4, (value / max) * 170)}px` }} />
            <span>{labels[index] ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagramBlock({ data }: { data: any }) {
  return (
    <div className="content-diagram">
      <div className="diagram-center">{data.center}</div>
      <div className="diagram-branches">
        {(data.branches ?? []).filter(Boolean).map((branch: string, index: number) => (
          <div key={index}>{branch}</div>
        ))}
      </div>
    </div>
  );
}
