import { NextRequest, NextResponse } from "next/server";
import { resetStudentPin } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatDatabaseError } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

interface ResetStudentPinRouteProps {
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

export async function POST(request: NextRequest, { params }: ResetStudentPinRouteProps) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  const { id } = await params;
  const formData = await request.formData();
  const className = String(formData.get("class_name") ?? "");

  try {
    const result = await resetStudentPin(id);
    const redirectUrl = buildRedirectUrl(request, "/admin/students");
    applyStudentClassFilter(redirectUrl, className);
    redirectUrl.searchParams.set(
      "message",
      result.hadPin
        ? `已重置 PIN：${result.student.name} (${result.student.student_id})`
        : `该学生尚未设置 PIN：${result.student.name} (${result.student.student_id})`,
    );
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    const redirectUrl = buildRedirectUrl(request, "/admin/students");
    applyStudentClassFilter(redirectUrl, className);
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
