"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import InstallAppPrompt from "@/components/install-app-prompt";
import WebNotificationSettings from "@/components/web-notification-settings";

type ClientProfile = {
  source_id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  relationship: "self" | "guardian";
  is_default: boolean;
};
type Membership = { sourceId: number; clientSourceId: number; planCode: string; practicesTotal: number; practicesLeft: number; endsAt: string | null; status: string };
type Booking = { sourceId: number; clientSourceId: number; sessionSourceId: number | null; bookingType: string; status: string; paymentRequired: boolean; startsAt: string | null; direction: string; subtitle: string | null; createdAt: string | null };
type Session = { sourceId: number; startsAt: string; direction: string; subtitle: string | null; capacity: number; bookedCount: number };
type Waitlist = { source_id: number; client_source_id: number; session_source_id: number; status: "waiting" | "offered"; created_at: string };
type Snapshot = { clients: ClientProfile[]; memberships: Membership[]; bookings: Booking[]; sessions: Session[]; waitlist?: Waitlist[] };

const dateTime = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

function bookingLabel(status: string) {
  return ({ booked: "Записана", attended: "Была", no_show: "Не пришла", cancelled: "Отменена", late_cancel: "Поздняя отмена" } as Record<string, string>)[status] ?? status;
}

function membershipLabel(plan: string) {
  return plan.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ClientCabinet({ snapshot, referenceNow, notificationPreferences }: { snapshot: Snapshot; referenceNow: string; notificationPreferences: { webEnabled: boolean; telegramEnabled: boolean } }) {
  const [selectedClientId, setSelectedClientId] = useState(snapshot.clients.find((client) => client.is_default)?.source_id ?? snapshot.clients[0]?.source_id ?? null);
  const [notice, setNotice] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const activeClient = snapshot.clients.find((client) => client.source_id === selectedClientId) ?? snapshot.clients[0];
  const now = useMemo(() => new Date(referenceNow), [referenceNow]);
  const bookings = useMemo(() => snapshot.bookings.filter((booking) => booking.clientSourceId === activeClient?.source_id), [activeClient?.source_id, snapshot.bookings]);
  const upcomingBookings = useMemo(() => bookings.filter((booking) => booking.status === "booked" && booking.startsAt && new Date(booking.startsAt) >= now).sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime()), [bookings, now]);
  const history = useMemo(() => bookings.filter((booking) => booking.status !== "booked" || (booking.startsAt && new Date(booking.startsAt) < now)).slice(0, 8), [bookings, now]);
  const membership = useMemo(() => snapshot.memberships.find((item) => item.clientSourceId === activeClient?.source_id && item.status === "active" && item.practicesLeft > 0) ?? snapshot.memberships.find((item) => item.clientSourceId === activeClient?.source_id), [activeClient?.source_id, snapshot.memberships]);
  const bookedSessionIds = new Set(upcomingBookings.map((booking) => booking.sessionSourceId).filter((id): id is number => id !== null));
  const waitlist = useMemo(() => snapshot.waitlist ?? [], [snapshot.waitlist]);
  const activeWaitlist = useMemo(() => waitlist.filter((item) => item.client_source_id === activeClient?.source_id), [activeClient?.source_id, waitlist]);
  const waitlistedSessionIds = new Set(activeWaitlist.map((item) => item.session_source_id));
  const sessionById = useMemo(() => new Map(snapshot.sessions.map((session) => [session.sourceId, session])), [snapshot.sessions]);
  const availableSessions = snapshot.sessions.filter((session) => !bookedSessionIds.has(session.sourceId)).slice(0, 8);

  function isLateCancellation(booking: Booking) {
    if (!booking.startsAt) return false;
    const starts = new Date(booking.startsAt);
    const cutoff = new Date(starts);
    if (starts.getHours() < 11) {
      cutoff.setDate(cutoff.getDate() - 1);
      cutoff.setHours(21, 0, 0, 0);
    } else {
      cutoff.setHours(cutoff.getHours() - 5);
    }
    return now > cutoff;
  }

  async function sendCommand(action: "book_session" | "join_waitlist" | "cancel_booking" | "move_booking", ids: { sessionSourceId?: number; bookingSourceId?: number; confirmedLateCancel?: boolean }) {
    if (!activeClient) return;
    setNotice("Передаём запрос…");
    const response = await fetch("/api/client/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, clientSourceId: activeClient.source_id, ...ids }),
    });
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
    setNotice(response.ok ? `${payload.message ?? "Готово"}. Бот обновит кабинет в течение минуты.` : payload.error ?? "Не получилось выполнить запрос. Попробуйте ещё раз.");
  }

  function cancelBooking(booking: Booking) {
    const late = isLateCancellation(booking);
    if (late && !window.confirm("До практики осталось менее разрешённого срока отмены. Запись будет отменена, а одна практика спишется с абонемента. Продолжить?")) return;
    void sendCommand("cancel_booking", { bookingSourceId: booking.sourceId, confirmedLateCancel: late });
  }

  function moveBooking(booking: Booking, session: Session) {
    if (!window.confirm(`Перенести запись на ${dateTime.format(new Date(session.startsAt))}?`)) return;
    void sendCommand("move_booking", { bookingSourceId: booking.sourceId, sessionSourceId: session.sourceId });
    setTransferOpen(false);
  }

  if (!activeClient) {
    return <main className="client-shell"><section className="client-empty"><h1>Кабинет готовится</h1><p>Администратор ещё не привязал этот вход к профилю клиента.</p></section></main>;
  }

  return (
    <main className="client-shell">
      <header className="client-header">
        <div className="client-brand"><b>В</b><span>Взмах к себе<br />Дом телесной устойчивости</span></div>
        <div className="client-actions"><Link href="/?view=materials">Материалы</Link><button type="button" onClick={() => setProfileOpen(true)} aria-label="Открыть профиль">{activeClient.full_name.slice(0, 1).toUpperCase()}</button></div>
      </header>

      <section className="client-body">
        <InstallAppPrompt />
        <div className="client-welcome"><small>МОЁ ПРОСТРАНСТВО</small><h1>Здравствуйте, {activeClient.full_name.split(" ")[0]}!</h1><p>Записи, пакет практик и всё важное — здесь.</p></div>

        {snapshot.clients.length > 1 ? <div className="client-switcher"><span>Сейчас смотрим:</span>{snapshot.clients.map((client) => <button type="button" key={client.source_id} className={client.source_id === activeClient.source_id ? "chosen" : ""} onClick={() => setSelectedClientId(client.source_id)}>{client.relationship === "guardian" ? `Ребёнок · ${client.full_name}` : client.full_name}</button>)}</div> : null}

        <section className="client-card next-practice">
          <div className="client-card-heading"><small>БЛИЖАЙШАЯ ПРАКТИКА</small><span>{upcomingBookings.length ? "Вы записаны" : "Записи пока нет"}</span></div>
          {upcomingBookings[0] ? <><h2>{upcomingBookings[0].direction}</h2><p>{upcomingBookings[0].startsAt ? dateTime.format(new Date(upcomingBookings[0].startsAt)) : "Время уточняется"}</p>{upcomingBookings[0].paymentRequired ? <em>Нужно оплатить занятие у Юли</em> : null}<div className="client-booking-actions"><button type="button" className="quiet-action" onClick={() => cancelBooking(upcomingBookings[0])}>Отменить запись</button>{!isLateCancellation(upcomingBookings[0]) ? <button type="button" className="quiet-action" onClick={() => setTransferOpen((value) => !value)}>{transferOpen ? "Закрыть варианты" : "Перенести"}</button> : null}</div>{transferOpen ? <div className="transfer-options">{availableSessions.length ? availableSessions.map((session) => <button type="button" key={session.sourceId} onClick={() => moveBooking(upcomingBookings[0], session)}><strong>{session.direction}</strong><span>{dateTime.format(new Date(session.startsAt))}</span></button>) : <p>Подходящих свободных вариантов пока нет.</p>}</div> : null}<small className="cancellation-rule">Отмена и перенос без списания — до 5 часов; для утренних практик — до 21:00 накануне.</small></> : <><h2>Выберите удобную практику</h2><p>Свободные места и лист ожидания — внизу экрана.</p></>}
        </section>

        <section className="client-card package-card">
          <div className="client-card-heading"><small>МОЙ ПАКЕТ ПРАКТИК</small><span>{membership?.status === "active" && membership.practicesLeft > 0 ? "Активен" : "Можно записаться разово"}</span></div>
          {membership ? <><h2>{membershipLabel(membership.planCode)}</h2><strong>{membership.practicesLeft} <small>из {membership.practicesTotal} практик осталось</small></strong><p>{membership.endsAt ? `Действует до ${shortDate.format(new Date(`${membership.endsAt}T12:00:00`))}` : "Срок уточняется"}</p></> : <><h2>Пакета пока нет</h2><p>Можно записаться на одну практику. Оплату Юля подтвердит отдельно.</p></>}
        </section>

        {activeWaitlist.length ? <section className="client-card waitlist-card">
          <div className="client-card-heading"><small>ЛИСТ ОЖИДАНИЯ</small><span>{activeWaitlist.length}</span></div>
          {activeWaitlist.map((item) => { const session = sessionById.get(item.session_source_id); return <div className="waitlist-row" key={item.source_id}><div><strong>{session?.direction || "Практика"}</strong><p>{session ? dateTime.format(new Date(session.startsAt)) : "Время уточняется"}</p></div><em>{item.status === "offered" ? "Место предложено" : "Ждём место"}</em></div>; })}
        </section> : null}

        <section className="client-section">
          <div className="client-section-heading"><div><small>ЗАПИСАТЬСЯ</small><h2>Ближайшие практики</h2></div><span>Все доступны вам</span></div>
          <div className="client-session-list">{availableSessions.length ? availableSessions.map((session) => { const full = session.bookedCount >= session.capacity; const waiting = waitlistedSessionIds.has(session.sourceId); return <article key={session.sourceId} className="client-session"><time>{dateTime.format(new Date(session.startsAt))}</time><div><strong>{session.direction}</strong><span>{session.subtitle || "Групповая практика"}</span></div><em>{session.bookedCount}/{session.capacity}</em><button type="button" disabled={waiting} onClick={() => sendCommand(full ? "join_waitlist" : "book_session", { sessionSourceId: session.sourceId })}>{waiting ? "Вы в ожидании" : full ? "В лист ожидания" : "Записаться"}</button></article>; }) : <p className="client-empty-list">Пока нет ближайших практик.</p>}</div>
        </section>

        <section className="client-section">
          <div className="client-section-heading"><div><small>МОЯ ИСТОРИЯ</small><h2>Посещения и отмены</h2></div></div>
          <div className="client-history">{history.length ? history.map((booking) => <div key={booking.sourceId}><span>{booking.startsAt ? shortDate.format(new Date(booking.startsAt)) : "Дата уточняется"}</span><strong>{booking.direction}</strong><em>{bookingLabel(booking.status)}</em></div>) : <p className="client-empty-list">История появится после первой практики.</p>}</div>
        </section>
        {notice ? <p className="client-notice">{notice}</p> : null}
      </section>

      {profileOpen ? <ProfileSheet client={activeClient} notificationPreferences={notificationPreferences} onClose={() => setProfileOpen(false)} onSaved={(message) => setNotice(message)} /> : null}
    </main>
  );
}

function ProfileSheet({ client, notificationPreferences, onClose, onSaved }: { client: ClientProfile; notificationPreferences: { webEnabled: boolean; telegramEnabled: boolean }; onClose: () => void; onSaved: (message: string) => void }) {
  const [phone, setPhone] = useState(client.phone ?? "");
  const [email, setEmail] = useState(client.email ?? "");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function save() {
    setState("saving");
    const response = await fetch("/api/client/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientSourceId: client.source_id, phone, email }) });
    if (!response.ok) { setState("error"); return; }
    if (password) {
      const passwordResponse = await fetch("/api/client/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (!passwordResponse.ok) { setState("error"); return; }
    }
    onSaved("Контактные данные сохранены");
    onClose();
  }

  return <div className="client-sheet-backdrop" role="presentation" onMouseDown={onClose}><section className="client-sheet" role="dialog" aria-modal="true" aria-label="Мой профиль" onMouseDown={(event) => event.stopPropagation()}><button className="client-sheet-close" type="button" onClick={onClose}>×</button><small>МОЙ ПРОФИЛЬ</small><h2>{client.full_name}</h2><p>Имя меняет администратор, чтобы записи всегда оставались корректными.</p><label>Телефон<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></label><label>Почта для связи<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label><label>Новый пароль <small>необязательно, от 10 символов</small><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" /></label>{state === "error" ? <p className="client-error">Не удалось сохранить данные. Проверьте пароль и попробуйте ещё раз.</p> : null}<button type="button" className="client-save" disabled={state === "saving"} onClick={save}>{state === "saving" ? "Сохраняем…" : "Сохранить"}</button><WebNotificationSettings initialPreferences={notificationPreferences} /></section></div>;
}
