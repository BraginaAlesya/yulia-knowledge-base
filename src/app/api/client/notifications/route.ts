import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type PushSubscriptionPayload = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "client") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  const body = await request.json() as { webEnabled?: boolean; telegramEnabled?: boolean };
  if (typeof body.webEnabled !== "boolean" || typeof body.telegramEnabled !== "boolean") return NextResponse.json({ error: "Некорректная настройка" }, { status: 400 });
  const { error } = await supabase.from("crm_notification_preferences").upsert({
    account_id: user.id,
    web_enabled: body.webEnabled,
    telegram_enabled: body.telegramEnabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id" });
  if (error) return NextResponse.json({ error: "Не удалось сохранить настройку" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "client") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  const subscription = await request.json() as PushSubscriptionPayload;
  const endpoint = String(subscription.endpoint ?? "");
  const p256dh = String(subscription.keys?.p256dh ?? "");
  const auth = String(subscription.keys?.auth ?? "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "Браузер передал неполные данные уведомлений" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("crm_web_push_subscriptions").upsert({
    account_id: user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    updated_at: now,
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Не удалось подключить это устройство" }, { status: 500 });

  await supabase.from("crm_notification_preferences").upsert({
    account_id: user.id,
    web_enabled: true,
    updated_at: now,
  }, { onConflict: "account_id" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "client") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

  const body = await request.json() as { endpoint?: string };
  const endpoint = String(body.endpoint ?? "");
  if (endpoint) await supabase.from("crm_web_push_subscriptions").delete().eq("endpoint", endpoint);
  await supabase.from("crm_notification_preferences").upsert({
    account_id: user.id,
    web_enabled: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id" });
  return NextResponse.json({ ok: true });
}
