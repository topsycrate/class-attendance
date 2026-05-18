import { NextRequest, NextResponse } from "next/server";
import { markStudentOnLeave } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatDatabaseError } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

interface MarkLeaveRouteProps {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: MarkLeaveRouteProps) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  const { id } = await params;
  const formData = await request.formData();
  const studentId = String(formData.get("student_id") ?? "");

  try {
    const result = await markStudentOnLeave({
      session_id: id,
      student_id: studentId,
    });
    const redirectUrl = buildRedirectUrl(request, `/admin/session/${id}`);

    if (result.status === "already_signed") {
      redirectUrl.searchParams.set("error", `${result.student.name} 已完成签到，无需请假`);
    } else if (result.status === "already_on_leave") {
      redirectUrl.searchParams.set("message", `${result.student.name} 已标记为请假`);
    } else {
      redirectUrl.searchParams.set("message", `已将 ${result.student.name} 标记为请假`);
    }

    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    const redirectUrl = buildRedirectUrl(request, `/admin/session/${id}`);
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
