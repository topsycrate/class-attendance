"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NumericKeypad } from "@/components/NumericKeypad";
import { PinInput } from "@/components/PinInput";
import { DEVICE_ID_STORAGE_KEY } from "@/lib/constants";
import { formatChinaDate, formatChinaDateTime } from "@/lib/time";
import type { SignContextResult, VerifySignResult } from "@/lib/types";

interface SignFlowProps {
  sessionId?: string;
}

export function SignFlow({ sessionId }: SignFlowProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [context, setContext] = useState<SignContextResult | null>(null);
  const [signResult, setSignResult] = useState<VerifySignResult | null>(null);

  useEffect(() => {
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

      const deviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);

      if (!deviceId) {
        router.replace(`/bind?redirect=${encodeURIComponent(`/sign?session_id=${sessionId}`)}`);
        return;
      }

      try {
        const response = await fetch(`/api/sign/session?session_id=${encodeURIComponent(sessionId)}`);
        const result = (await response.json()) as SignContextResult;
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
  }, [router, sessionId]);

  async function submitSign(currentCode: string) {
    if (!sessionId || submitting) {
      return;
    }

    if (currentCode.length !== 4) {
      setMessage("请输入 4 位签到码");
      return;
    }

    const deviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);

    if (!deviceId) {
      router.replace(`/bind?redirect=${encodeURIComponent(`/sign?session_id=${sessionId}`)}`);
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          sign_code: currentCode,
        }),
      });
      const result = (await response.json()) as VerifySignResult;

      if (result.success) {
        setSignResult(result);
        setCode("");
        return;
      }

      setMessage(result.message);
      setCode("");
    } catch {
      setMessage("签到失败，请稍后重试");
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (code.length === 4 && context?.success && context.status === "ready" && !signResult) {
      void submitSign(code);
    }
  }, [code, context, signResult]);

  function handleDigit(digit: string) {
    setMessage(null);
    setCode((current) => (current.length >= 4 ? current : `${current}${digit}`));
  }

  function handleDelete() {
    setCode((current) => current.slice(0, -1));
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm items-center justify-center px-4 py-4 sm:px-5 sm:py-10">
        <div className="w-full rounded-[1.75rem] border border-white/70 bg-white/85 p-6 text-center shadow-card backdrop-blur sm:rounded-[2rem] sm:p-8">
          <p className="text-base font-medium text-ink">正在加载签到信息...</p>
        </div>
      </div>
    );
  }

  if (!context || !context.success) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-4 sm:px-5 sm:py-10">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:rounded-[2rem] sm:p-8">
          <p className="text-sm font-medium text-accent">签到异常</p>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">无法签到</h1>
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {context?.message ?? "签到信息无效"}
          </p>
          <div className="mt-6">
            <Link href="/bind" className="text-sm font-medium text-ink underline underline-offset-4">
              前往绑定页面
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (context.status === "already_signed" && !signResult) {
    const result = {
      success: true,
      status: "already_signed",
      studentName: context.studentName,
      signTime: context.signTime,
      message: "你已完成签到",
    };

    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-4 sm:px-5 sm:py-10">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:rounded-[2rem] sm:p-8">
          <p className="text-sm font-medium text-accent">签到结果</p>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">你已完成签到</h1>
          <div className="mt-6 space-y-3 rounded-[1.5rem] bg-paper p-5">
            <p className="text-sm text-ink/70">学生姓名</p>
            <p className="text-xl font-semibold text-ink">{result.studentName}</p>
            <p className="text-sm text-ink/70">签到时间</p>
            <p className="font-display text-lg font-semibold text-ink">
              {formatChinaDateTime(result.signTime)}
            </p>
          </div>
          <div className="mt-6">
            <Link href="/" className="text-sm font-medium text-ink underline underline-offset-4">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (signResult?.success) {
    const isAlreadySigned = signResult.status === "already_signed";

    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-4 sm:px-5 sm:py-10">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:rounded-[2rem] sm:p-8">
          <p className="text-sm font-medium text-accent">签到结果</p>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
            {isAlreadySigned ? "你已完成签到" : "签到成功"}
          </h1>
          <div className="mt-6 space-y-3 rounded-[1.5rem] bg-paper p-5">
            <p className="text-sm text-ink/70">学生姓名</p>
            <p className="text-xl font-semibold text-ink">{signResult.studentName}</p>
            <p className="text-sm text-ink/70">签到时间</p>
            <p className="font-display text-lg font-semibold text-ink">
              {formatChinaDateTime(signResult.signTime)}
            </p>
          </div>
          <div className="mt-6">
            <Link href="/" className="text-sm font-medium text-ink underline underline-offset-4">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (context.status !== "ready") {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-5 sm:py-8">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur sm:rounded-[2rem] sm:p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-accent">课堂签到</p>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">输入 4 位签到码</h1>
          <div className="rounded-2xl bg-paper px-4 py-3 text-sm leading-6 text-ink/75">
            <p>学生：{context.studentName}</p>
            <p>班级：{context.className}</p>
            <p>课程：{context.courseName}</p>
            <p>日期：{formatChinaDate(context.sessionDate)}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <PinInput value={code} />
          <NumericKeypad
            disabled={submitting}
            onDigit={handleDigit}
            onDelete={handleDelete}
            onSubmit={() => void submitSign(code)}
          />
          <p className="text-center text-xs text-ink/60">点击数字输入签到码</p>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{message}</div>
        ) : null}

        <div className="mt-5 text-center text-sm text-ink/65">
          {submitting ? "正在验证..." : "输满 4 位会自动校验"}
        </div>
      </div>
    </div>
  );
}
