import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  clearAdminSession(response);
  return response;
}
