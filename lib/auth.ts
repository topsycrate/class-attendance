import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
  STUDENT_COOKIE_NAME,
  STUDENT_SESSION_MAX_AGE,
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

function createSessionToken(scope: string, subject: string) {
  const issuedAt = Date.now().toString();
  const payload = `${scope}:${subject}:${issuedAt}`;
  return `${subject}.${issuedAt}.${sign(payload)}`;
}

function parseSessionToken(scope: string, token?: string | null) {
  if (!token) {
    return null;
  }

  const [subject, issuedAt, signature] = token.split(".");

  if (!subject || !issuedAt || !signature) {
    return null;
  }

  const expected = sign(`${scope}:${subject}:${issuedAt}`);

  if (expected.length !== signature.length) {
    return null;
  }

  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return null;
  }

  return {
    subject,
    issuedAt,
  };
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
  return createSessionToken("admin", "admin");
}

export function isAdminSessionTokenValid(token?: string | null) {
  const parsed = parseSessionToken("admin", token);

  if (!parsed) {
    return false;
  }
  const age = Date.now() - Number(parsed.issuedAt);
  return Number.isFinite(age) && age >= 0 && age < ADMIN_SESSION_MAX_AGE * 1000;
}

export function createStudentSessionToken(studentId: string) {
  return createSessionToken("student", studentId);
}

export function getStudentIdFromSessionToken(token?: string | null) {
  const parsed = parseSessionToken("student", token);

  if (!parsed) {
    return null;
  }

  const age = Date.now() - Number(parsed.issuedAt);

  if (!Number.isFinite(age) || age < 0 || age >= STUDENT_SESSION_MAX_AGE * 1000) {
    return null;
  }

  return parsed.subject;
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

export function setStudentSession(response: NextResponse, studentId: string) {
  response.cookies.set({
    name: STUDENT_COOKIE_NAME,
    value: createStudentSessionToken(studentId),
    maxAge: STUDENT_SESSION_MAX_AGE,
    ...getCookieConfig(),
  });
}

export function clearStudentSession(response: NextResponse) {
  response.cookies.set({
    name: STUDENT_COOKIE_NAME,
    value: "",
    maxAge: 0,
    ...getCookieConfig(),
  });
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return isAdminSessionTokenValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function getAuthenticatedStudentId() {
  const cookieStore = await cookies();
  return getStudentIdFromSessionToken(cookieStore.get(STUDENT_COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export function isAdminRequest(request: NextRequest) {
  return isAdminSessionTokenValid(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
}

export function getStudentIdFromRequest(request: NextRequest) {
  return getStudentIdFromSessionToken(request.cookies.get(STUDENT_COOKIE_NAME)?.value);
}
