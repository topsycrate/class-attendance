import { NextRequest, NextResponse } from "next/server";
import { deleteStudent } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatDatabaseError } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

interface DeleteStudentRouteProps {
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

export async function POST(request: NextRequest, { params }: DeleteStudentRouteProps) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  const { id } = await params;
  const formData = await request.formData();
  const className = String(formData.get("class_name") ?? "");

  try {
    const student = await deleteStudent(id);
    const redirectUrl = buildRedirectUrl(request, "/admin/students");
    applyStudentClassFilter(redirectUrl, className);
    redirectUrl.searchParams.set("message", `已删除学生：${student.name} (${student.student_id})`);
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    const redirectUrl = buildRedirectUrl(request, "/admin/students");
    applyStudentClassFilter(redirectUrl, className);
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
