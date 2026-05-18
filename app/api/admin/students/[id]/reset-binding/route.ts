import { NextRequest, NextResponse } from "next/server";
import { resetStudentBinding } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatDatabaseError } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

interface ResetStudentBindingRouteProps {
  params: Promise<{
    id: string;
  }>;
}

function applyStudentClassFilter(url: URL, className: string) {
  const value = className.trim();

  if (value) {
    url.searchParams.set("class_name", value);
  }
}

export async function POST(request: NextRequest, { params }: ResetStudentBindingRouteProps) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  const { id } = await params;
  const formData = await request.formData();
  const className = String(formData.get("class_name") ?? "");

  try {
    const result = await resetStudentBinding(id);
    const redirectUrl = buildRedirectUrl(request, "/admin/students");
    applyStudentClassFilter(redirectUrl, className);
    redirectUrl.searchParams.set(
      "message",
      result.hadBinding
        ? `已清除旧设备记录：${result.student.name} (${result.student.student_id})`
        : `该学生没有旧设备记录：${result.student.name} (${result.student.student_id})`,
    );
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    const redirectUrl = buildRedirectUrl(request, "/admin/students");
    applyStudentClassFilter(redirectUrl, className);
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
