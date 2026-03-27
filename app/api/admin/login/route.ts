import { NextResponse } from "next/server";
import { isAdminPasswordValid, setAdminSession } from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const redirectUrl = new URL("/admin/login", request.url);

  if (!isAdminPasswordValid(password)) {
    redirectUrl.searchParams.set("error", "密码错误，请重新输入");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const response = NextResponse.redirect(new URL("/admin/session", request.url), 303);
  setAdminSession(response);
  return response;
}
