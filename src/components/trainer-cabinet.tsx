"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Booking = { sourceId: number; status: string; bookingType: string; firstName: string; photoUrl: string | null; healthNote: string | null };
type Session = { sourceId: number; startsAt: string; direction: string; subtitle: string | null; capacity: number; completedAt: string | null; bookings: Booking[] };
type Snapshot = { trainer: { source_id: number; display_name: string; photo_url: string | null }; sessions: Session[]; attendanceLast30Days: number };

const dateTime = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const dayTime = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function bookingLabel(status: string) {
  return ({ booked: "Ожидает отметки", attended: "Пришла", no_show: "Не пришла" } as Record<string, string>)[status] ?? status;
}

export default function TrainerCabinet({ snapshot, referenceNow }: { snapshot: Snapshot; referenceNow: string }) {
  const router = useRouter();
  const now = useMemo(() => new Date(referenceNow), [referenceNow]);
  const [notice, setNotice] = useState("");
  const [openNote, setOpenNote] = useState<number | null>(null);
  const sessions = useMemo(() => snapshot.sessions.map((session) => ({ ...session, starts: new Date(session.startsAt) })), [snapshot.sessions]);
  const currentSession = sessions.find((session) => session.starts <= now && !session.completedAt) ?? sessions.find((session) => !session.completedAt) ?? null;
  const upcoming = sessions.filter((session) => session.starts >= now && session.sourceId !== currentSession?.sourceId).slice(0, 8);

  useEffect(() => {
    const refresh = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(refresh);
  }, [router]);

  async function send(action: "attendance" | "finish_session", payload: { bookingSourceId?: number; attended?: boolean; sessionSourceId?: number }) {
    setNotice("Передаём действие…");
    const response = await fetch("/api/trainer/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
    const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
    setNotice(response.ok ? `${data.message ?? "Готово"}. Бот обновит экран в течение минуты.` : data.error ?? "Не получилось выполнить действие.");
  }

  return <main className="trainer-shell">
    <header className="trainer-header"><div className="trainer-brand"><b>В</b><span>Взмах к себе<br />Дом телесной устойчивости</span></div><Link href="/?view=materials">Методика</Link></header>
    <section className="trainer-body">
      <div className="trainer-welcome"><small>КАБИНЕТ ТРЕНЕРА</small><h1>Здравствуйте, {snapshot.trainer.display_name.split(" ")[0]}!</h1><p>Здесь только ваши практики и группы. Данные клиентов остаются защищёнными.</p></div>
      <section className="trainer-stats"><article><small>БЛИЖАЙШАЯ ПРАКТИКА</small><strong>{currentSession ? dayTime.format(currentSession.starts) : "Нет в расписании"}</strong><span>{currentSession ? `${currentSession.bookings.length} записано` : ""}</span></article><article><small>ЗА 30 ДНЕЙ</small><strong>{snapshot.attendanceLast30Days}</strong><span>посещений отмечено</span></article></section>
      {currentSession ? <SessionCard session={currentSession} active now={now} noteId={openNote} onNote={setOpenNote} onAttendance={(bookingSourceId, attended) => send("attendance", { bookingSourceId, attended })} onFinish={() => send("finish_session", { sessionSourceId: currentSession.sourceId })} /> : <section className="trainer-empty"><h2>Сегодня практик нет</h2><p>Ближайшее расписание — ниже.</p></section>}
      <section className="trainer-section"><div><small>МОЁ РАСПИСАНИЕ</small><h2>Ближайшие практики</h2></div>{upcoming.length ? <div className="trainer-upcoming">{upcoming.map((session) => <article key={session.sourceId}><time>{dateTime.format(session.starts)}</time><strong>{session.direction}</strong><span>{session.subtitle || "Практика"}</span><em>{session.bookings.filter((booking) => booking.status === "booked").length}/{session.capacity} записано</em></article>)}</div> : <p>Ближайших практик пока нет.</p>}</section>
      {notice ? <p className="trainer-notice">{notice}</p> : null}
    </section>
  </main>;
}

function SessionCard({ session, active, now, noteId, onNote, onAttendance, onFinish }: { session: Session & { starts: Date }; active: boolean; now: Date; noteId: number | null; onNote: (id: number | null) => void; onAttendance: (id: number, attended: boolean) => void; onFinish: () => void }) {
  const pending = session.bookings.filter((booking) => booking.status === "booked");
  const mayFinish = session.starts <= now && pending.length === 0 && !session.completedAt;
  return <section className="trainer-current"><div className="trainer-current-heading"><div><small>{active ? "ТЕКУЩАЯ / БЛИЖАЙШАЯ ПРАКТИКА" : "ПРАКТИКА"}</small><h2>{session.direction}</h2><p>{dateTime.format(session.starts)}{session.subtitle ? ` · ${session.subtitle}` : ""}</p></div><span>{session.bookings.length}/{session.capacity}</span></div><div className="trainer-roster"><h3>Состав группы</h3>{session.bookings.length ? session.bookings.map((booking) => <article key={booking.sourceId} className="trainer-client"><div className={booking.photoUrl ? "trainer-avatar has-photo" : "trainer-avatar"} style={booking.photoUrl ? { backgroundImage: `url(${booking.photoUrl})` } : undefined}>{booking.photoUrl ? null : booking.firstName.slice(0, 1)}</div><div><strong>{booking.firstName}</strong>{booking.bookingType === "trial" ? <em>Пробная практика</em> : null}<span>{bookingLabel(booking.status)}</span></div>{booking.healthNote ? <button className="health-note-button" type="button" onClick={() => onNote(noteId === booking.sourceId ? null : booking.sourceId)}>Важное</button> : null}{booking.status === "booked" ? <div className="trainer-attendance"><button type="button" onClick={() => onAttendance(booking.sourceId, true)}>Пришла</button><button type="button" onClick={() => onAttendance(booking.sourceId, false)}>Не пришла</button></div> : null}{noteId === booking.sourceId && booking.healthNote ? <p className="trainer-health-note">{booking.healthNote}</p> : null}</article>) : <p>На эту практику пока никто не записан.</p>}</div>{session.completedAt ? <p className="trainer-finished">Практика завершена.</p> : <button className="trainer-finish" type="button" disabled={!mayFinish} title={mayFinish ? "" : "Сначала отметьте всех записанных после начала практики"} onClick={onFinish}>Завершить практику</button>} {!mayFinish && !session.completedAt && session.starts <= now && pending.length ? <p className="trainer-hint">Перед завершением отметьте всех: «пришла» или «не пришла».</p> : null}</section>;
}
