import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/auth";
import { buildRedirectUrl } from "@/lib/request-url";

export async function POST(request: Request) {
  const response = NextResponse.redirect(buildRedirectUrl(request, "/admin/login"), 303);
  clearAdminSession(response);
  return response;
}
