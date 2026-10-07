"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Client = { source_id: number; full_name: string; acquisition_source: string | null; email: string | null; access_state: string };
type Membership = { source_id: number; client_source_id: number; practices_left: number; status: string; ends_at: string | null };
type Payment = { source_id: number; client_source_id: number; amount: number; paid_at: string };
type Session = { source_id: number; starts_at: string; direction: string; subtitle: string | null; capacity: number; is_active: boolean; trainer_source_id: number | null };
type Booking = { source_id: number; client_source_id: number; session_source_id: number | null; booking_type: string; status: string; custom_title: string | null; custom_starts_at: string | null; created_at: string | null };
type Funnel = { client_source_id: number; status: string; updated_at: string | null };
type Trainer = { source_id: number; display_name: string };
type AccountLink = { account_id: string; client_source_id: number };
type AuditRecord = { id: string; action: string; entity_type: string; entity_source_id: number | null; details: Record<string, unknown>; created_at: string };

const formatMoney = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const formatDateTime = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const formatSyncTime = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

function dateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date(value));
}

function statusLabel(status: string) {
  return ({ booked: "Записан", attended: "Пришла", no_show: "Не пришла", cancelled: "Отменена", late_cancel: "Поздняя отмена" } as Record<string, string>)[status] || status;
}

function auditLabel(record: AuditRecord) {
  const result = record.details?.message;
  if (typeof result === "string" && result) return result;
  return ({ attendance: "Обновлено посещение", cancel_booking: "Отменена запись", book_session: "Создана запись", join_waitlist: "Клиент добавлен в лист ожидания", finish_session: "Практика завершена", issue_client_access: "Открыт клиентский кабинет", family_linked: "Связаны семейные профили" } as Record<string, string>)[record.action] ?? "Обновлены данные";
}

export default function OperationsDashboard({ name, clients, memberships, payments, sessions, bookings, funnel, trainers, accountLinks, auditRecords, referenceNow, lastSyncedAt, sourceReady }: {
  name: string;
  clients: Client[];
  memberships: Membership[];
  payments: Payment[];
  sessions: Session[];
  bookings: Booking[];
  funnel: Funnel[];
  trainers: Trainer[];
  accountLinks: AccountLink[];
  auditRecords: AuditRecord[];
  referenceNow: string;
  lastSyncedAt: string | null;
  sourceReady: boolean;
}) {
  const router = useRouter();
  const [directionFilter, setDirectionFilter] = useState("all");
  const [trainerFilter, setTrainerFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [accessNotice, setAccessNotice] = useState("");
  const [familyNotice, setFamilyNotice] = useState("");
  const [guardianClientId, setGuardianClientId] = useState("");
  const [childClientId, setChildClientId] = useState("");
  const now = useMemo(() => new Date(referenceNow), [referenceNow]);
  const today = dateKey(referenceNow);
  const recentLimit = new Date(now);
  recentLimit.setDate(recentLimit.getDate() - 7);

  useEffect(() => {
    const refresh = window.setInterval(() => router.refresh(), 5 * 60 * 1000);
    return () => window.clearInterval(refresh);
  }, [router]);

  const clientById = useMemo(() => new Map(clients.map((client) => [client.source_id, client])), [clients]);
  const sessionById = useMemo(() => new Map(sessions.map((session) => [session.source_id, session])), [sessions]);
  const sourceOptions = useMemo(() => [...new Set(clients.map((client) => client.acquisition_source).filter((source): source is string => Boolean(source)))].sort(), [clients]);
  const directionOptions = useMemo(() => [...new Set(sessions.map((session) => session.direction))].sort(), [sessions]);
  const selectedClientIds = useMemo(() => new Set(clients.filter((client) => sourceFilter === "all" || client.acquisition_source === sourceFilter).map((client) => client.source_id)), [clients, sourceFilter]);
  const visibleSessions = useMemo(() => sessions.filter((session) => {
    const directionMatch = directionFilter === "all" || session.direction === directionFilter;
    const trainerMatch = trainerFilter === "all" || String(session.trainer_source_id) === trainerFilter;
    return directionMatch && trainerMatch;
  }), [directionFilter, sessions, trainerFilter]);
  const visibleSessionIds = useMemo(() => new Set(visibleSessions.map((session) => session.source_id)), [visibleSessions]);
  const relevantBookings = useMemo(() => bookings.filter((booking) => selectedClientIds.has(booking.client_source_id) && (booking.session_source_id === null || visibleSessionIds.has(booking.session_source_id))), [bookings, selectedClientIds, visibleSessionIds]);
  const upcomingSessions = useMemo(() => visibleSessions.filter((session) => new Date(session.starts_at) >= now).slice(0, 18), [now, visibleSessions]);
  const [chosenSession, setChosenSession] = useState<number | null>(null);
  const activeSession = chosenSession && upcomingSessions.some((session) => session.source_id === chosenSession)
    ? chosenSession
    : upcomingSessions[0]?.source_id ?? null;

  const bookingsBySession = useMemo(() => {
    const map = new Map<number, Booking[]>();
    relevantBookings.forEach((booking) => {
      if (booking.session_source_id === null) return;
      map.set(booking.session_source_id, [...(map.get(booking.session_source_id) ?? []), booking]);
    });
    return map;
  }, [relevantBookings]);
  const relevantPayments = payments.filter((payment) => selectedClientIds.has(payment.client_source_id));
  const revenue = relevantPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const activeMemberships = useMemo(() => memberships.filter((membership) => membership.status === "active" && membership.practices_left > 0 && selectedClientIds.has(membership.client_source_id)), [memberships, selectedClientIds]);
  const activeClientIds = useMemo(() => new Set(activeMemberships.map((membership) => membership.client_source_id)), [activeMemberships]);
  const lastAttendance = useMemo(() => {
    const dates = new Map<number, Date>();
    relevantBookings.forEach((booking) => {
      if (booking.status !== "attended" || !booking.session_source_id) return;
      const session = sessionById.get(booking.session_source_id);
      if (!session) return;
      const date = new Date(session.starts_at);
      if (date > now || (dates.get(booking.client_source_id) ?? new Date(0)) < date) dates.set(booking.client_source_id, date);
    });
    return dates;
  }, [now, relevantBookings, sessionById]);
  const regularClients = [...activeClientIds].filter((id) => (lastAttendance.get(id) ?? new Date(0)) >= recentLimit);
  const inactiveClients = [...activeClientIds].filter((id) => !regularClients.includes(id));
  const endingMemberships = activeMemberships.filter((membership) => {
    const endsSoon = membership.ends_at ? new Date(`${membership.ends_at}T23:59:59`) <= new Date(now.getTime() + 7 * 86400000) : false;
    return endsSoon || membership.practices_left <= 2;
  });
  const attentionFunnel = funnel.filter((item) => selectedClientIds.has(item.client_source_id) && ["lead", "contacted", "thinking"].includes(item.status));
  const linkedClientIds = useMemo(() => new Set(accountLinks.map((link) => link.client_source_id)), [accountLinks]);
  const accessQueue = useMemo(() => clients.map((client) => {
    const hasActiveMembership = activeClientIds.has(client.source_id);
    const linked = linkedClientIds.has(client.source_id);
    const state = linked
      ? (hasActiveMembership ? "Кабинет активен" : "Кабинет сохранён")
      : !client.email ? "Нужна почта"
      : hasActiveMembership ? "Готов открыть доступ" : "Нет абонемента";
    return { ...client, state, priority: state === "Готов открыть доступ" ? 0 : state === "Нужна почта" && hasActiveMembership ? 1 : 2 };
  }).sort((a, b) => a.priority - b.priority || a.full_name.localeCompare(b.full_name, "ru")), [activeClientIds, clients, linkedClientIds]);
  const accessReady = accessQueue.filter((item) => item.state === "Готов открыть доступ");
  const funnelStages = [
    ["lead", "Заявки"], ["trial_booked", "Пробные"], ["trial_attended", "Пришли"], ["sold", "Купили"],
  ] as const;
  const maxFunnel = Math.max(1, ...funnelStages.map(([stage]) => funnel.filter((item) => selectedClientIds.has(item.client_source_id) && item.status === stage).length));
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

  async function issueClientAccess(clientSourceId: number) {
    setAccessNotice("Передаём запрос боту…");
    const response = await fetch("/api/operations/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientSourceId }),
    });
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
    setAccessNotice(response.ok ? `${payload.message ?? "Запрос передан"}.` : payload.error ?? "Не удалось передать запрос.");
  }

  async function linkFamily() {
    setFamilyNotice("Связываем кабинеты…");
    const response = await fetch("/api/operations/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guardianClientId: Number(guardianClientId), childClientId: Number(childClientId) }),
    });
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
    setFamilyNotice(response.ok ? `${payload.message ?? "Готово"}.` : payload.error ?? "Не получилось связать кабинеты.");
    if (response.ok) router.refresh();
  }

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <Link href="/?view=materials" className="back-link">← База знаний</Link>
        <span>{name} · кабинет владельца</span>
      </header>
      <div className="operations-body">
        <div className="operations-heading">
          <div><small>Операционный кабинет ✦</small><h1>Спокойный контроль дня</h1><p>Главное о клиентах, практиках и выручке — без ручных сверок.</p></div>
          <a className="sheet-link" href="https://docs.google.com/spreadsheets/d/11RPtVsR0VEOw2lTnwCCR3Zxvz2UdjpLjEkjpAF0AihM/edit" target="_blank" rel="noreferrer">Открыть CRM-таблицу ↗</a>
        </div>
        {!sourceReady ? <div className="sync-note"><strong>Связь с ботом ещё настраивается.</strong><span>Экран появится с живыми данными сразу после первого защищённого обмена.</span></div> : <div className="sync-note"><strong>Данные обновляются из бота каждые 5 минут{lastSyncedAt ? ` · последняя синхронизация в ${formatSyncTime.format(new Date(lastSyncedAt))}` : ""}.</strong><span>Действия из этого кабинета бот выполнит в течение минуты.</span></div>}
        <section className="operations-filters" aria-label="Фильтры статистики">
          <label>Направление<select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)}><option value="all">Все</option>{directionOptions.map((direction) => <option key={direction} value={direction}>{direction}</option>)}</select></label>
          <label>Тренер<select value={trainerFilter} onChange={(event) => setTrainerFilter(event.target.value)}><option value="all">Все</option>{trainers.map((trainer) => <option key={trainer.source_id} value={String(trainer.source_id)}>{trainer.display_name}</option>)}</select></label>
          <label>Источник<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">Все</option>{sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
        </section>
        <section className="operations-stats">
          <Metric label="Активны сейчас" value={String(activeClientIds.size)} note="с действующим абонементом" />
          <Metric label="Ходят регулярно" value={String(regularClients.length)} note="были на практике за 7 дней" />
          <Metric label="Нет больше 7 дней" value={String(inactiveClients.length)} note="стоит мягко напомнить" highlighted={Boolean(inactiveClients.length)} />
          <Metric label="Абонемент на исходе" value={String(endingMemberships.length)} note="≤ 2 практик или ≤ 7 дней" highlighted={Boolean(endingMemberships.length)} />
          <Metric label="Выручка за 30 дней" value={`${formatMoney.format(revenue)} ₽`} note={`${relevantPayments.length} оплат`} />
          <Metric label="Практики сегодня" value={String(upcomingSessions.filter((session) => dateKey(session.starts_at) === today).length)} note={`${relevantBookings.filter((booking) => booking.status === "booked").length} актуальных записей`} />
        </section>
        <section className="operations-grid">
          <div className="operation-panel funnel-panel"><div className="panel-title"><div><small>Конверсии</small><h2>Путь клиента</h2></div><span>За всё время</span></div>
            <div className="funnel-chart">{funnelStages.map(([stage, label]) => { const amount = funnel.filter((item) => selectedClientIds.has(item.client_source_id) && item.status === stage).length; return <div key={stage} className="funnel-row"><span>{label}</span><div><i style={{ width: `${Math.max(8, amount / maxFunnel * 100)}%` }} /></div><b>{amount}</b></div>; })}</div>
          </div>
          <div className="operation-panel attention-panel"><div className="panel-title"><div><small>На сегодня</small><h2>Фокус Юлии</h2></div></div>
            <p><b>{inactiveClients.length}</b> давно не были</p><p><b>{endingMemberships.length}</b> пора предложить продление</p><p><b>{attentionFunnel.length}</b> ждут следующего шага</p>
          </div>
        </section>
        <section className="operation-panel access-panel"><div className="panel-title"><div><small>Доступы к платформе</small><h2>Кому открыть кабинет</h2></div><span>{accessReady.length} готовы</span></div><p className="access-panel-intro">После покупки абонемента бот создаст доступ и отправит клиенту временный пароль в Telegram. Пароль нигде не хранится в открытом виде.</p><div className="access-queue">{accessQueue.slice(0, 8).map((client) => <div key={client.source_id}><span><strong>{client.full_name}</strong><small>{client.email || "Почта не указана"}</small></span><aside><em className={client.state === "Готов открыть доступ" ? "ready" : ""}>{client.state}</em>{client.state === "Готов открыть доступ" ? <button type="button" onClick={() => issueClientAccess(client.source_id)}>Открыть</button> : null}</aside></div>)}</div>{accessNotice ? <p className="command-notice">{accessNotice}</p> : null}</section>
        <section className="operation-panel family-panel"><div className="panel-title"><div><small>Семейный доступ</small><h2>Родитель и ребёнок</h2></div><span>{accountLinks.filter((link) => link.client_source_id !== Number(guardianClientId)).length ? "Можно связать" : ""}</span></div><p>Один взрослый кабинет может переключаться между профилями детей. У ребёнка при этом может оставаться свой собственный вход.</p><div className="family-form"><label>Родитель<select value={guardianClientId} onChange={(event) => setGuardianClientId(event.target.value)}><option value="">Выберите клиента с кабинетом</option>{accountLinks.map((link) => <option key={link.account_id + link.client_source_id} value={link.client_source_id}>{clientById.get(link.client_source_id)?.full_name || "Клиент"}</option>)}</select></label><label>Ребёнок<select value={childClientId} onChange={(event) => setChildClientId(event.target.value)}><option value="">Выберите ребёнка</option>{clients.filter((client) => String(client.source_id) !== guardianClientId).map((client) => <option key={client.source_id} value={client.source_id}>{client.full_name}</option>)}</select></label><button type="button" disabled={!guardianClientId || !childClientId} onClick={linkFamily}>Связать</button></div>{familyNotice ? <p className="command-notice">{familyNotice}</p> : null}</section>
        <section className="operation-panel audit-panel"><div className="panel-title"><div><small>История</small><h2>Последние действия</h2></div><span>Сохраняется отдельно</span></div><div className="audit-list">{auditRecords.length ? auditRecords.map((record) => <div key={record.id}><span>{formatDateTime.format(new Date(record.created_at))}</span><strong>{auditLabel(record)}</strong></div>) : <p className="empty-operation">Здесь появится история действий по кабинету, записям и доступам.</p>}</div></section>
        <section className="operation-panel schedule-panel"><div className="panel-title"><div><small>Расписание</small><h2>Ближайшие тренировки</h2></div><span>Нажмите, чтобы увидеть состав группы</span></div>
          <div className="session-list">{upcomingSessions.length ? upcomingSessions.map((session) => { const sessionBookings = (bookingsBySession.get(session.source_id) ?? []).filter((booking) => booking.status === "booked"); return <button type="button" key={session.source_id} className={activeSession === session.source_id ? "session-card selected" : "session-card"} onClick={() => setChosenSession(session.source_id)}><time>{formatDateTime.format(new Date(session.starts_at))}</time><span><strong>{session.direction}</strong><small>{session.subtitle || "Практика"}</small></span><em>{sessionBookings.length}/{session.capacity}</em></button>; }) : <p className="empty-operation">По выбранным фильтрам ближайших практик нет.</p>}</div>
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
