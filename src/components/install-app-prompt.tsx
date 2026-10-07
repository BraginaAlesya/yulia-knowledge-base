"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isAppleMobile() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  });

  useEffect(() => {
    const receivePrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as InstallPromptEvent);
    };
    const installedApp = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", receivePrompt);
    window.addEventListener("appinstalled", installedApp);
    return () => {
      window.removeEventListener("beforeinstallprompt", receivePrompt);
      window.removeEventListener("appinstalled", installedApp);
    };
  }, []);

  if (installed || dismissed || (!deferredPrompt && !isAppleMobile())) return null;

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  }

  return <aside className="install-app-prompt" aria-label="Установить приложение">
    <button type="button" className="install-app-close" onClick={() => setDismissed(true)} aria-label="Закрыть">×</button>
    <div className="install-app-icon">В</div>
    <div><strong>Добавьте на экран</strong><p>{isAppleMobile() ? "В Safari нажмите «Поделиться» → «На экран Домой»." : "Так кабинет открывается как отдельное приложение."}</p></div>
    {deferredPrompt ? <button type="button" className="install-app-button" onClick={install}>Добавить</button> : null}
  </aside>;
}
