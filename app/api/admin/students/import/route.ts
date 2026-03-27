import { NextRequest, NextResponse } from "next/server";
import { importStudentsFromText } from "@/lib/actions";
import { isAdminRequest } from "@/lib/auth";
import { formatSupabaseError } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const formData = await request.formData();
  const rawText = String(formData.get("students_text") ?? "");

  try {
    const result = await importStudentsFromText(rawText);
    const redirectUrl = new URL("/admin/students", request.url);
    redirectUrl.searchParams.set(
      "message",
      `导入完成：新增 ${result.inserted}，更新 ${result.updated}，无效 ${result.invalid}`,
    );

    if (result.errors.length > 0) {
      redirectUrl.searchParams.set("errors", result.errors.slice(0, 5).join("；"));
    }

    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    const redirectUrl = new URL("/admin/students", request.url);
    redirectUrl.searchParams.set("error", formatSupabaseError(error));
    return NextResponse.redirect(redirectUrl, 303);
  }
}
