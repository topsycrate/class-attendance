import { NextResponse } from "next/server";
import { getCurrentActiveSession } from "@/lib/actions";
import { isAdminPasswordValid, setAdminSession } from "@/lib/auth";
import { buildRedirectUrl } from "@/lib/request-url";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const redirectUrl = buildRedirectUrl(request, "/admin/login");

  if (!isAdminPasswordValid(password)) {
    redirectUrl.searchParams.set("error", "密码错误，请重新输入");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const activeSession = await getCurrentActiveSession();
  const response = NextResponse.redirect(
    buildRedirectUrl(request, activeSession ? `/admin/session/${activeSession.id}` : "/admin/session"),
    303,
  );
  setAdminSession(response);
  return response;
}
