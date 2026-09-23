"use client";

import { useMemo, useState } from "react";

type Client = { source_id: number; full_name: string; phone: string | null };
type Membership = { source_id: number; client_source_id: number; practices_left: number; status: string; ends_at: string | null };
type Payment = { source_id: number; client_source_id: number; amount: number; paid_at: string };
type Session = { source_id: number; starts_at: string; direction: string; subtitle: string | null; capacity: number; is_active: boolean };
type Booking = { source_id: number; client_source_id: number; session_source_id: number | null; booking_type: string; status: string; custom_title: string | null; custom_starts_at: string | null; created_at: string | null };
type Funnel = { client_source_id: number; status: string; updated_at: string | null };

const formatMoney = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const formatDateTime = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function statusLabel(status: string) {
  return ({ booked: "Записан", attended: "Пришла", no_show: "Не пришла", cancelled: "Отменена", late_cancel: "Поздняя отмена" } as Record<string, string>)[status] || status;
}

export default function OperationsDashboard({ name, clients, memberships, payments, sessions, bookings, funnel, sourceReady }: {
  name: string;
  clients: Client[];
  memberships: Membership[];
  payments: Payment[];
  sessions: Session[];
  bookings: Booking[];
  funnel: Funnel[];
  sourceReady: boolean;
}) {
  const [activeSession, setActiveSession] = useState<number | null>(sessions[0]?.source_id ?? null);
  const [notice, setNotice] = useState("");
  const clientById = useMemo(() => new Map(clients.map((client) => [client.source_id, client])), [clients]);
  const bookingsBySession = useMemo(() => {
    const map = new Map<number, Booking[]>();
    bookings.forEach((booking) => {
      if (booking.session_source_id === null) return;
      map.set(booking.session_source_id, [...(map.get(booking.session_source_id) ?? []), booking]);
    });
    return map;
  }, [bookings]);
  const revenue = payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const activeMemberships = memberships.filter((membership) => membership.status === "active" && membership.practices_left > 0).length;
  const attendance = bookings.filter((booking) => booking.status === "attended").length;
  const noShows = bookings.filter((booking) => booking.status === "no_show").length;
  const funnelStages = [
    ["lead", "Заявки"], ["trial_booked", "Пробные"], ["trial_attended", "Пришли"], ["sold", "Купили"],
  ] as const;
  const maxFunnel = Math.max(1, ...funnelStages.map(([stage]) => funnel.filter((item) => item.status === stage).length));
  const selectedBookings = activeSession ? bookingsBySession.get(activeSession) ?? [] : [];

  async function sendCommand(action: "attendance" | "cancel_booking", bookingSourceId: number, attended?: boolean) {
    setNotice("Передаём действие боту…");
    const response = await fetch("/api/operations/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, bookingSourceId, attended }),
    });
    setNotice(response.ok ? "Готово: бот обработает действие в течение минуты. Затем обновите страницу." : "Не получилось передать действие. Попробуйте ещё раз.");
  }

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <a href="/" className="back-link">← База знаний</a>
        <span>{name} · кабинет владельца</span>
      </header>
      <div className="operations-body">
        <div className="operations-heading">
          <div><small>Операционный кабинет ✦</small><h1>Клиенты и практики</h1><p>Записи, воронка и ключевые цифры — в одном спокойном рабочем экране.</p></div>
          <a className="sheet-link" href="https://docs.google.com/spreadsheets/d/11RPtVsR0VEOw2lTnwCCR3Zxvz2UdjpLjEkjpAF0AihM/edit" target="_blank" rel="noreferrer">Открыть CRM-таблицу ↗</a>
        </div>
        {!sourceReady ? <div className="sync-note"><strong>Связь с ботом ещё настраивается.</strong><span>Экран появится с живыми данными сразу после первого защищённого обмена.</span></div> : <div className="sync-note"><strong>Данные обновляются из бота каждые 5 минут.</strong><span>Действия из этого кабинета бот выполнит в течение минуты.</span></div>}
        <section className="operations-stats">
          <Metric label="Выручка за 30 дней" value={`${formatMoney.format(revenue)} ₽`} note={`${payments.length} оплат`} />
          <Metric label="Активные абонементы" value={String(activeMemberships)} note="с доступными практиками" />
          <Metric label="Посещений" value={String(attendance)} note={noShows ? `Неявок: ${noShows}` : "Без неявок"} />
          <Metric label="Клиентов" value={String(clients.length)} note="в единой базе" highlighted />
        </section>
        <section className="operations-grid">
          <div className="operation-panel funnel-panel"><div className="panel-title"><div><small>Конверсии</small><h2>Путь клиента</h2></div><span>За всё время</span></div>
            <div className="funnel-chart">{funnelStages.map(([stage, label]) => { const amount = funnel.filter((item) => item.status === stage).length; return <div key={stage} className="funnel-row"><span>{label}</span><div><i style={{ width: `${Math.max(8, amount / maxFunnel * 100)}%` }} /></div><b>{amount}</b></div>; })}</div>
          </div>
          <div className="operation-panel attention-panel"><div className="panel-title"><div><small>На сегодня</small><h2>Фокус Юлии</h2></div></div>
            <p><b>{sessions.length}</b> ближайших практик</p><p><b>{bookings.filter((booking) => booking.status === "booked").length}</b> актуальных записей</p><p><b>{funnel.filter((item) => ["lead", "contacted", "thinking"].includes(item.status)).length}</b> клиентов ждут следующего шага</p>
          </div>
        </section>
        <section className="operation-panel schedule-panel"><div className="panel-title"><div><small>Расписание</small><h2>Ближайшие тренировки</h2></div><span>Нажмите, чтобы увидеть состав группы</span></div>
          <div className="session-list">{sessions.length ? sessions.map((session) => { const sessionBookings = (bookingsBySession.get(session.source_id) ?? []).filter((booking) => booking.status === "booked"); return <button type="button" key={session.source_id} className={activeSession === session.source_id ? "session-card selected" : "session-card"} onClick={() => setActiveSession(session.source_id)}><time>{formatDateTime.format(new Date(session.starts_at))}</time><span><strong>{session.direction}</strong><small>{session.subtitle || "Практика"}</small></span><em>{sessionBookings.length}/{session.capacity}</em></button>; }) : <p className="empty-operation">После первой синхронизации здесь появится расписание.</p>}</div>
          {activeSession ? <div className="booking-list"><h3>Записаны на тренировку</h3>{selectedBookings.length ? selectedBookings.map((booking) => <div className="booking-row" key={booking.source_id}><span><strong>{clientById.get(booking.client_source_id)?.full_name || "Клиент"}</strong><small>{statusLabel(booking.status)}</small></span>{booking.status === "booked" ? <div className="booking-actions"><button type="button" onClick={() => sendCommand("attendance", booking.source_id, true)}>Пришла</button><button type="button" onClick={() => sendCommand("attendance", booking.source_id, false)}>Не пришла</button><button type="button" onClick={() => sendCommand("cancel_booking", booking.source_id)}>Отменить</button></div> : null}</div>) : <p className="empty-operation">Пока никто не записан.</p>}</div> : null}
          {notice ? <p className="command-notice">{notice}</p> : null}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, note, highlighted = false }: { label: string; value: string; note: string; highlighted?: boolean }) {
  return <div className={highlighted ? "operation-metric highlighted" : "operation-metric"}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}
