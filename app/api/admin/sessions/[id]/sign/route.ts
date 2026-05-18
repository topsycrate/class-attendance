import { NextRequest, NextResponse } from "next/server";
import { markStudentSignedManually } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatDatabaseError } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

interface MarkSignRouteProps {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: MarkSignRouteProps) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  const { id } = await params;
  const formData = await request.formData();
  const studentId = String(formData.get("student_id") ?? "");

  try {
    const result = await markStudentSignedManually({
      session_id: id,
      student_id: studentId,
    });
    const redirectUrl = buildRedirectUrl(request, `/admin/session/${id}`);

    if (result.status === "already_signed") {
      redirectUrl.searchParams.set("message", `${result.student.name} 已完成签到`);
    } else {
      redirectUrl.searchParams.set("message", `已为 ${result.student.name} 补签`);
    }

    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    const redirectUrl = buildRedirectUrl(request, `/admin/session/${id}`);
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
