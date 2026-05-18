"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { COURSE_NAME } from "@/lib/constants";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { StudentAuthStatusResult } from "@/lib/types";

function formatNow(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function HomeStatusPanel() {
  const [now, setNow] = useState("");
  const [status, setStatus] = useState<StudentAuthStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setNow(formatNow(new Date()));

    const timer = window.setInterval(() => {
      setNow(formatNow(new Date()));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    async function load() {
      getOrCreateDeviceId();

      try {
        const response = await fetch("/api/student/auth/status", { cache: "no-store" });
        const result = (await response.json()) as StudentAuthStatusResult;
        setStatus(result);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

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

  return (
    <section className="rounded-[1.75rem] bg-ink p-5 text-paper sm:p-6">
      <div className="grid gap-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-paper/70">当前时间</p>
          <p className="mt-1 text-lg font-bold sm:text-xl" suppressHydrationWarning>
            {now || "----/--/-- --:--:--"}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-paper/70">课程</p>
          <p className="mt-1 text-lg font-bold sm:text-xl">{COURSE_NAME}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-paper/70">学生状态</p>
          <div className="mt-2">
            {loading ? <p className="text-sm text-paper/70">正在读取登录状态</p> : null}
            {!loading && status?.authenticated ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-lg font-bold text-paper">{status.student.name}</p>
                  <p className="text-sm text-paper/70">学号：{status.student.student_id}</p>
                  <p className="text-sm text-paper/70">班级：{status.student.class_name || "未设置"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/bind"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-paper transition hover:bg-white/15"
                  >
                    账号信息
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={loggingOut}
                    className="inline-flex items-center justify-center rounded-2xl bg-white px-3 py-2 text-sm font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loggingOut ? "退出中..." : "退出登录"}
                  </button>
                </div>
              </div>
            ) : null}
            {!loading && !status?.authenticated ? (
              <Link
                href="/bind"
                className="inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
              >
                去登录
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
