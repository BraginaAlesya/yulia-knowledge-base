"use client";

import { createClient } from "@/lib/supabase/client";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErrorMessage(error.message);
      setState("error");
      return;
    }

    setState("sent");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><b>В</b><span>Взмах к себе<br />Дом телесной устойчивости</span></div>
        <small>Закрытая платформа</small>
        <h1>Войдите в своё пространство</h1>
        <p>Введите почту — пришлём безопасную ссылку для входа. Пароль не понадобится.</p>
        <form onSubmit={signIn}>
          <label>
            Электронная почта
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button type="submit" disabled={state === "sending"}>
            {state === "sending" ? "Отправляем…" : "Получить ссылку для входа"}
          </button>
        </form>
        {state === "sent" ? <p className="login-success">Ссылка отправлена. Откройте письмо на этой почте.</p> : null}
        {state === "error" ? <p className="login-error">Не получилось отправить ссылку: {errorMessage}</p> : null}
      </section>
    </main>
  );
}
