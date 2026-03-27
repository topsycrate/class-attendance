"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CLASS_OPTIONS, DEVICE_ID_STORAGE_KEY } from "@/lib/constants";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { BindResult } from "@/lib/types";

interface BindFormProps {
  redirectTo?: string;
}

export function BindForm({ redirectTo }: BindFormProps) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [className, setClassName] = useState<(typeof CLASS_OPTIONS)[number]>("一班");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setIsSuccess(false);

    const deviceId = getOrCreateDeviceId();

    try {
      const response = await fetch("/api/bind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: studentId,
          name,
          class_name: className,
        }),
      });

      const result = (await response.json()) as BindResult;
      setMessage(result.message);
      setIsSuccess(result.success);

      if (result.success) {
        window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, result.device_id);

        if (safeRedirect) {
          window.setTimeout(() => {
            router.replace(safeRedirect);
          }, 700);
        }
      }
    } catch {
      setMessage("绑定失败，请稍后重试");
      setIsSuccess(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-4 sm:px-5 sm:py-10">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur sm:rounded-[2rem] sm:p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-accent">学生绑定</p>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">绑定设备</h1>
          <p className="text-sm leading-6 text-ink/70">填写学号、姓名、班级。</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-ink px-4 py-4 text-base font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "提交中..." : "完成绑定"}
          </button>
        </form>

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
          <span>完成后扫码签到</span>
        </div>
      </div>
    </div>
  );
}
