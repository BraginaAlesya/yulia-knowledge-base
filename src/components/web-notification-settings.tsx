"use client";

import { useState } from "react";

function base64ToUint8Array(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export default function WebNotificationSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function savePreference(webEnabled: boolean) {
    const response = await fetch("/api/client/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webEnabled }),
    });
    return response.ok;
  }

  async function disable() {
    setSaving(true);
    try {
      const registration = await navigator.serviceWorker?.ready;
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await fetch("/api/client/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      else await savePreference(false);
      setEnabled(false);
      setNotice("Уведомления в приложении отключены на этом устройстве.");
    } catch {
      setNotice("Не удалось изменить настройку. Попробуйте ещё раз.");
    } finally { setSaving(false); }
  }

  async function enable() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotice("Этот браузер не поддерживает уведомления приложения.");
      return;
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setNotice("Уведомления подготовлены, но будут включены вместе с финальным запуском приложения.");
      return;
    }
    setSaving(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotice("Разрешение не получено. Его можно включить в настройках браузера.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(vapidKey) });
      const response = await fetch("/api/client/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("subscribe failed");
      setEnabled(true);
      setNotice("Уведомления подключены для этого устройства.");
    } catch {
      setNotice("Не удалось подключить уведомления. Проверьте настройки браузера.");
    } finally { setSaving(false); }
  }

  return <section className="web-notification-settings">
    <small>УВЕДОМЛЕНИЯ</small>
    <strong>В приложении</strong>
    <p>Напоминания и изменения расписания будут приходить на это устройство. Telegram можно оставить дополнительным каналом.</p>
    <button type="button" onClick={enabled ? disable : enable} disabled={saving}>{saving ? "Сохраняем…" : enabled ? "Отключить на этом устройстве" : "Включить уведомления"}</button>
    {notice ? <span>{notice}</span> : null}
  </section>;
}
