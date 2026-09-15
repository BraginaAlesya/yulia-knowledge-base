import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = new URL(request.url).searchParams.get("path");

  if (!path || path.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const { data, error } = await supabase.storage
    .from("material-assets")
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    console.error("Asset error:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
