import { NextRequest, NextResponse } from "next/server";
import { importStudentsFromText } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatDatabaseError } from "@/lib/db";
import { buildRedirectUrl } from "@/lib/request-url";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  }

  const formData = await request.formData();
  const rawText = String(formData.get("students_text") ?? "");

  try {
    const result = await importStudentsFromText(rawText);
    const redirectUrl = buildRedirectUrl(request, "/admin/students");
    redirectUrl.searchParams.set(
      "message",
      `导入完成：新增 ${result.inserted}，更新 ${result.updated}，无效 ${result.invalid}`,
    );

    if (result.errors.length > 0) {
      redirectUrl.searchParams.set("errors", result.errors.slice(0, 5).join("；"));
    }

    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    const redirectUrl = buildRedirectUrl(request, "/admin/students");
    redirectUrl.searchParams.set("error", formatDatabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
