import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey, {
    auth: {
      // The callback page exchanges the one-time code itself. Keeping this off
      // prevents the browser client from consuming the same code in parallel.
      detectSessionInUrl: false,
    },
  });
}
