"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setState("error");
      return;
    }

    setState("sent");
    router.replace("/");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><b>В</b><span>Взмах к себе<br />Дом телесной устойчивости</span></div>
        <small>Закрытая платформа</small>
        <h1>Войдите в своё пространство</h1>
        <p>Введите почту и пароль, которые вы получили от администратора.</p>
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
          <label>
            Пароль
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={state === "sending"}>
            {state === "sending" ? "Проверяем…" : "Войти"}
          </button>
        </form>
        {state === "sent" ? <p className="login-success">Вход выполнен. Открываем ваше пространство…</p> : null}
        {state === "error" ? <p className="login-error">Не получилось войти: {errorMessage}</p> : null}
      </section>
    </main>
  );
}
