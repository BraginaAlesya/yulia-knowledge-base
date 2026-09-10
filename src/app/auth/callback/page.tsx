"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function AuthCallbackPage() {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let finished = false;

    function continueToCabinet() {
      if (finished) return;
      finished = true;
      window.location.replace("/");
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) continueToCabinet();
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setHasError(true);
      if (data.session) continueToCabinet();
    });

    const timeout = window.setTimeout(() => {
      if (!finished) setHasError(true);
    }, 2500);

    return () => {
      listener.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><b>В</b><span>Взмах к себе<br />Дом телесной устойчивости</span></div>
        <small>Проверяем ссылку</small>
        <h1>{hasError ? "Ссылка не сработала" : "Открываем ваше пространство"}</h1>
        <p>
          {hasError
            ? "Эта ссылка уже использована или устарела. Вернитесь на страницу входа и запросите новую."
            : "Пожалуйста, подождите несколько секунд."}
        </p>
        {hasError ? <a className="callback-link" href="/login">Вернуться ко входу</a> : null}
      </section>
    </main>
  );
}
