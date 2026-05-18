import { NextRequest, NextResponse } from "next/server";
import { createAttendanceSession, getCurrentActiveSession } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatDatabaseError } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  const formData = await request.formData();

  try {
    const activeSession = await getCurrentActiveSession();

    if (activeSession) {
      const redirectUrl = buildRedirectUrl(request, `/admin/session/${activeSession.id}`);
      redirectUrl.searchParams.set("error", "当前已有进行中的签到场次");
      return NextResponse.redirect(redirectUrl, 303);
    }

    const session = await createAttendanceSession({
      class_name: String(formData.get("class_name") ?? ""),
      duration_minutes: Number(formData.get("duration_minutes") ?? 0),
    });

    return NextResponse.redirect(buildRedirectUrl(request, `/admin/session/${session.id}`), 303);
  } catch (error) {
    const activeSession = await getCurrentActiveSession();
    const redirectUrl = buildRedirectUrl(
      request,
      activeSession ? `/admin/session/${activeSession.id}` : "/admin/session",
    );
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
