import { NextRequest, NextResponse } from "next/server";
import { deleteAttendanceSession } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatDatabaseError } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

interface DeleteSessionRouteProps {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: DeleteSessionRouteProps) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  const { id } = await params;
  const formData = await request.formData();
  const redirectPath = String(formData.get("redirect_path") ?? "/admin/session");
  const sessionDate = String(formData.get("session_date") ?? "");

  try {
    await deleteAttendanceSession(id);

    const redirectUrl = buildRedirectUrl(request, redirectPath || "/admin/session");

    if (sessionDate.trim()) {
      redirectUrl.searchParams.set("session_date", sessionDate.trim());
    }

    redirectUrl.searchParams.set("message", "签到场次已删除");
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    const redirectUrl = buildRedirectUrl(request, `/admin/session/${id}`);
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
