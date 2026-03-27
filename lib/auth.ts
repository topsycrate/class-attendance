import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
} from "@/lib/constants";

function getAdminSecret() {
  const secret = process.env.ADMIN_PASSWORD;

  if (!secret) {
    throw new Error("缺少 ADMIN_PASSWORD 配置");
  }

  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getAdminSecret()).update(value).digest("hex");
}

export function isAdminPasswordValid(password: string) {
  const expected = Buffer.from(getAdminSecret());
  const actual = Buffer.from(password);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function createAdminSessionToken() {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function isAdminSessionTokenValid(token?: string | null) {
  if (!token) {
    return false;
  }

  const [issuedAt, signature] = token.split(".");

  if (!issuedAt || !signature) {
    return false;
  }

  const expected = sign(issuedAt);

  if (expected.length !== signature.length) {
    return false;
  }

  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return false;
  }

  const age = Date.now() - Number(issuedAt);
  return Number.isFinite(age) && age >= 0 && age < ADMIN_SESSION_MAX_AGE * 1000;
}

function getCookieConfig() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function setAdminSession(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: createAdminSessionToken(),
    maxAge: ADMIN_SESSION_MAX_AGE,
    ...getCookieConfig(),
  });
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    maxAge: 0,
    ...getCookieConfig(),
  });
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return isAdminSessionTokenValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
}
