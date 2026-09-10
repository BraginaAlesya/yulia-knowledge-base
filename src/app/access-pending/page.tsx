export default function AccessPendingPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><b>В</b><span>Взмах к себе<br />Дом телесной устойчивости</span></div>
        <small>Доступ ожидает подтверждения</small>
        <h1>Аккаунт создан</h1>
        <p>Юлия или технический администратор назначит вам роль. После этого этот же вход откроет ваш личный кабинет.</p>
        <form action="/auth/signout" method="post"><button type="submit">Выйти</button></form>
      </section>
    </main>
  );
}
