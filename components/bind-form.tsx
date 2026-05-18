"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CLASS_OPTIONS } from "@/lib/constants";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type {
  StudentAuthStatusResult,
  StudentLoginResult,
  StudentPinSetupResult,
} from "@/lib/types";

interface BindFormProps {
  redirectTo?: string;
}

type AuthMode = "login" | "setup";

export function BindForm({ redirectTo }: BindFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [className, setClassName] = useState<(typeof CLASS_OPTIONS)[number]>("一班");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [authStatus, setAuthStatus] = useState<StudentAuthStatusResult | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : null;

  useEffect(() => {
    getOrCreateDeviceId();

    async function loadStatus() {
      try {
        const response = await fetch("/api/student/auth/status", {
          cache: "no-store",
        });
        const result = (await response.json()) as StudentAuthStatusResult;
        setAuthStatus(result);

        if (result.authenticated && safeRedirect) {
          router.replace(safeRedirect);
        }
      } finally {
        setStatusLoading(false);
      }
    }

    void loadStatus();
  }, [router, safeRedirect]);

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const deviceId = getOrCreateDeviceId();
      const response = await fetch("/api/student/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: studentId,
          pin,
          device_id: deviceId,
        }),
      });
      const result = (await response.json()) as StudentLoginResult;
      setMessage(result.message);
      setIsSuccess(result.success);

      if (result.success) {
        if (safeRedirect) {
          window.setTimeout(() => {
            router.replace(safeRedirect);
          }, 700);
        } else {
          window.setTimeout(() => {
            router.replace("/");
          }, 700);
        }
      }
    } catch {
      setMessage("登录失败，请稍后重试");
      setIsSuccess(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const deviceId = getOrCreateDeviceId();
      const response = await fetch("/api/student/auth/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: studentId,
          name,
          class_name: className,
          pin,
          device_id: deviceId,
        }),
      });
      const result = (await response.json()) as StudentPinSetupResult;
      setMessage(result.message);
      setIsSuccess(result.success);

      if (result.success) {
        if (safeRedirect) {
          window.setTimeout(() => {
            router.replace(safeRedirect);
          }, 700);
        } else {
          window.setTimeout(() => {
            router.replace("/");
          }, 700);
        }
      }
    } catch {
      setMessage("设置 PIN 失败，请稍后重试");
      setIsSuccess(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/student/auth/logout", {
        method: "POST",
      });
      window.location.reload();
    } finally {
      setLoggingOut(false);
    }
  }

  if (statusLoading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-4 sm:px-5 sm:py-10">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur sm:rounded-[2rem] sm:p-6">
          <p className="text-base font-medium text-ink">正在读取登录状态...</p>
        </div>
      </div>
    );
  }

  if (authStatus?.authenticated) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-4 sm:px-5 sm:py-10">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur sm:rounded-[2rem] sm:p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-accent">学生账号</p>
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">已登录</h1>
          </div>

          <div className="mt-6 rounded-[1.5rem] bg-paper px-4 py-4">
            <p className="text-base font-semibold text-ink">{authStatus.student.name}</p>
            <p className="mt-2 text-sm text-ink/65">学号：{authStatus.student.student_id}</p>
            <p className="text-sm text-ink/65">班级：{authStatus.student.class_name || "未设置"}</p>
          </div>

          <div className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm text-ink">
            当前账号已保持登录状态，可直接扫码签到。
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={safeRedirect || "/"}
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
            >
              {safeRedirect ? "继续" : "返回首页"}
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? "退出中..." : "退出登录"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-4 sm:px-5 sm:py-10">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur sm:rounded-[2rem] sm:p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-accent">学生账号</p>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">登录 / 首次设置 PIN</h1>
          <p className="text-sm leading-6 text-ink/70">
            已设置 PIN 直接登录；首次使用请输入学号、姓名、班级并设置 PIN。
          </p>
        </div>

        <div className="mt-6 flex rounded-[1.5rem] bg-paper p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMessage(null);
            }}
            className={`flex-1 rounded-[1.25rem] px-4 py-3 text-sm font-medium transition ${
              mode === "login" ? "bg-ink text-white" : "text-ink/70"
            }`}
          >
            账号登录
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("setup");
              setMessage(null);
            }}
            className={`flex-1 rounded-[1.25rem] px-4 py-3 text-sm font-medium transition ${
              mode === "setup" ? "bg-ink text-white" : "text-ink/70"
            }`}
          >
            首次设置 PIN
          </button>
        </div>

        {mode === "login" ? (
          <form className="mt-6 space-y-4" onSubmit={handleLoginSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">学号</span>
              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent"
                placeholder="请输入学号"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">PIN 码</span>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent"
                placeholder="请输入 PIN 码"
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-2xl bg-ink px-4 py-4 text-base font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSetupSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">学号</span>
              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent"
                placeholder="请输入学号"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">姓名</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent"
                placeholder="请输入姓名"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">班级</span>
              <select
                value={className}
                onChange={(event) => setClassName(event.target.value as (typeof CLASS_OPTIONS)[number])}
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent"
              >
                {CLASS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">新 PIN 码</span>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent"
                placeholder="请输入 4-8 位数字 PIN"
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-2xl bg-ink px-4 py-4 text-base font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "设置中..." : "设置 PIN 并登录"}
            </button>
          </form>
        )}

        {message ? (
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              isSuccess ? "bg-mint text-ink" : "bg-red-50 text-red-600"
            }`}
          >
            {message}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm text-ink/65">
          <Link href="/" className="hover:text-ink">
            返回首页
          </Link>
          <span>登录后扫码签到</span>
        </div>
      </div>
    </div>
  );
}
