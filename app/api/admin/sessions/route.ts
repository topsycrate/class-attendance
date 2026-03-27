import { NextRequest, NextResponse } from "next/server";
import { createAttendanceSession } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatSupabaseError } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const formData = await request.formData();

  try {
    const session = await createAttendanceSession({
      class_name: String(formData.get("class_name") ?? ""),
      sign_code: String(formData.get("sign_code") ?? ""),
      duration_minutes: Number(formData.get("duration_minutes") ?? 0),
    });

    return NextResponse.redirect(new URL(`/admin/session/${session.id}`, request.url), 303);
  } catch (error) {
    const redirectUrl = new URL("/admin/session", request.url);
    redirectUrl.searchParams.set("error", formatSupabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
