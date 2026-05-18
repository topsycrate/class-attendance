"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { formatChinaDate, formatChinaDateTime } from "@/lib/time";
import type { SignContextResult, VerifySignResult } from "@/lib/types";

interface SignFlowProps {
  sessionId?: string;
}

function getSignRedirectTarget(sessionId?: string) {
  return sessionId ? `/sign?session_id=${sessionId}` : "/sign";
}

function SignShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[390px] flex-col bg-paper px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-ink sm:justify-center">
      {children}
    </main>
  );
}

function StudentContextCard({
  studentName,
  className,
  courseName,
  sessionDate,
  statusLabel = "可签到",
}: {
  studentName: string;
  className: string;
  courseName: string;
  sessionDate: string;
  statusLabel?: string;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-accent">课堂签到</p>
          <h1 className="mt-2 break-words text-3xl font-black tracking-tight text-ink">
            {courseName}
          </h1>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-mint px-3 py-2 text-sm font-extrabold text-accent">
          <span className="h-2 w-2 rounded-full bg-accent" />
          {statusLabel}
        </span>
      </div>

      <div className="mt-5 rounded-lg bg-paper p-4">
        <p className="text-xs font-extrabold text-muted">当前学生</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-ink">{studentName}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white p-3">
            <p className="text-xs font-extrabold text-muted">班级</p>
            <p className="mt-1 text-base font-black text-ink">{className}</p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <p className="text-xs font-extrabold text-muted">日期</p>
            <p className="mt-1 text-base font-black text-ink">{formatChinaDate(sessionDate)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeLink() {
  return (
    <Link
      href="/"
      className="flex w-full items-center justify-center rounded-lg border border-line bg-white px-4 py-4 text-base font-extrabold text-ink transition hover:bg-paper"
    >
      返回首页
    </Link>
  );
}

export function SignFlow({ sessionId }: SignFlowProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [autoAttempted, setAutoAttempted] = useState(false);
  const [context, setContext] = useState<SignContextResult | null>(null);
  const [signResult, setSignResult] = useState<VerifySignResult | null>(null);

  const redirectTarget = getSignRedirectTarget(sessionId);
  const loginHref = `/bind?redirect=${encodeURIComponent(redirectTarget)}`;

  useEffect(() => {
    setLoading(true);
    setSubmitting(false);
    setMessage(null);
    setAutoAttempted(false);
    setContext(null);
    setSignResult(null);

    async function load() {
      if (!sessionId) {
        setContext({
          success: false,
          code: "MISSING_SESSION",
          message: "缺少签到场次参数",
        });
        setLoading(false);
        return;
      }

      try {
        const deviceId = getOrCreateDeviceId();
        const response = await fetch(
          `/api/sign/session?session_id=${encodeURIComponent(sessionId)}&device_id=${encodeURIComponent(deviceId)}`,
          {
            cache: "no-store",
          },
        );
        const result = (await response.json()) as SignContextResult;

        if (!result.success && result.code === "NOT_AUTHENTICATED") {
          router.replace(loginHref);
          return;
        }

        setContext(result);
      } catch {
        setContext({
          success: false,
          code: "LOAD_FAILED",
          message: "页面加载失败，请稍后再试",
        });
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [loginHref, router, sessionId]);

  const submitSign = useCallback(async () => {
    if (!sessionId || submitting) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const deviceId = getOrCreateDeviceId();
      const response = await fetch("/api/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          device_id: deviceId,
        }),
      });
      const result = (await response.json()) as VerifySignResult;

      if (result.success) {
        setSignResult(result);
        return;
      }

      if (result.code === "NOT_AUTHENTICATED") {
        router.replace(loginHref);
        return;
      }

      if (result.code !== "SERVER_ERROR") {
        setContext(result);
        return;
      }

      setMessage(result.message);
    } catch {
      setMessage("签到失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }, [loginHref, router, sessionId, submitting]);

  useEffect(() => {
    if (!context?.success || context.status !== "ready" || signResult || autoAttempted) {
      return;
    }

    setAutoAttempted(true);
    void submitSign();
  }, [autoAttempted, context, signResult, submitSign]);

  if (loading) {
    return (
      <SignShell>
        <section className="mt-auto rounded-lg border border-line bg-white p-6 text-center shadow-card sm:mt-0">
          <p className="text-base font-extrabold text-ink">正在加载签到信息...</p>
          <p className="mt-2 text-sm font-medium text-muted">请保持当前页面打开</p>
        </section>
      </SignShell>
    );
  }

  if (!context || !context.success) {
    const needsLogin = context?.code === "NOT_AUTHENTICATED";

    return (
      <SignShell>
        <section className="mt-auto rounded-lg border border-line bg-white p-5 shadow-card sm:mt-0">
          <p className="text-sm font-extrabold text-accent">签到异常</p>
          <h1 className="mt-2 text-3xl font-black text-ink">
            {needsLogin ? "需要先登录" : "无法签到"}
          </h1>
          <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-600">
            {context?.message ?? "签到信息无效"}
          </p>
          <div className="mt-5 grid gap-3">
            <Link
              href={needsLogin ? loginHref : "/bind"}
              className="flex w-full items-center justify-center rounded-lg bg-ink px-4 py-4 text-base font-extrabold text-white transition hover:bg-ink/90"
            >
              {needsLogin ? "前往登录" : "查看账号状态"}
            </Link>
            <HomeLink />
          </div>
        </section>
      </SignShell>
    );
  }

  if (context.status === "already_signed" && !signResult) {
    return (
      <SignShell>
        <div className="mt-auto space-y-4 sm:mt-0">
          <section className="rounded-lg border border-line bg-white p-5 shadow-card">
            <p className="text-sm font-extrabold text-accent">签到结果</p>
            <h1 className="mt-2 text-3xl font-black text-ink">你已完成签到</h1>
            <div className="mt-5 rounded-lg bg-paper p-4">
              <p className="text-xs font-extrabold text-muted">当前学生</p>
              <p className="mt-2 text-2xl font-black text-ink">{context.studentName}</p>
            </div>
            <p className="mt-4 rounded-lg bg-mint px-4 py-3 text-base font-extrabold text-ink">
              {formatChinaDateTime(context.signTime)}
            </p>
          </section>
          <HomeLink />
        </div>
      </SignShell>
    );
  }

  if (signResult?.success) {
    const isAlreadySigned = signResult.status === "already_signed";

    return (
      <SignShell>
        <div className="space-y-4">
          {context.status === "ready" ? (
            <StudentContextCard
              studentName={signResult.studentName}
              className={context.className}
              courseName={context.courseName}
              sessionDate={context.sessionDate}
              statusLabel="已签到"
            />
          ) : null}
          <section className="rounded-lg bg-mint p-5 shadow-card">
            <p className="text-sm font-extrabold text-accent">签到结果</p>
            <h2 className="mt-3 text-3xl font-black text-ink">
              {isAlreadySigned ? "你已完成签到" : "签到成功"}
            </h2>
            <p className="mt-3 text-base font-extrabold text-muted">
              {formatChinaDateTime(signResult.signTime)}
            </p>
          </section>
          <HomeLink />
        </div>
      </SignShell>
    );
  }

  if (context.status !== "ready") {
    return null;
  }

  return (
    <SignShell>
      <div className="flex min-h-[calc(100dvh-2rem)] flex-col gap-4">
        <StudentContextCard
          studentName={context.studentName}
          className={context.className}
          courseName={context.courseName}
          sessionDate={context.sessionDate}
        />

        <section className="rounded-lg bg-sidebar p-5 text-white shadow-card">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-2xl">
            ⌗
          </div>
          <h2 className="mt-5 text-3xl font-black">{message ? "签到失败" : "已识别签到场次"}</h2>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-200">
            {submitting
              ? "正在提交签到，请稍候..."
              : "保持当前浏览器登录，系统会自动提交签到。提交失败时可以手动重试。"}
          </p>
          <div className="mt-5 space-y-3 text-sm font-extrabold">
            <p className="flex items-center gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300 text-xs text-emerald-300">
                ✓
              </span>
              账号已登录
            </p>
            <p className="flex items-center gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300 text-xs text-emerald-300">
                ✓
              </span>
              场次有效
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-teal-100 bg-mint p-4">
          <p className="text-base font-black text-ink">签到成功后显示时间</p>
          <p className="mt-1 text-sm font-bold text-muted">系统提交后会立即更新结果</p>
        </section>

        <div className="mt-auto grid gap-3">
          {message ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {message}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void submitSign()}
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-lg bg-ink px-4 py-4 text-base font-extrabold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "签到中..." : message ? "重新签到" : "手动重试"}
          </button>
          <HomeLink />
        </div>
      </div>
    </SignShell>
  );
}
