"use client";

import { useEffect, useState } from "react";
import { SessionQrCode } from "@/components/session-qr-code";
import { formatChinaDate } from "@/lib/time";
import type { PublicCurrentSessionResult } from "@/lib/types";

export function PublicCurrentSessionQr() {
  const [result, setResult] = useState<PublicCurrentSessionResult | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const response = await fetch("/api/public/current-session", {
          cache: "no-store",
        });
        const nextResult = (await response.json()) as PublicCurrentSessionResult;

        if (mounted) {
          setResult(nextResult);
        }
      } catch {
        if (mounted) {
          setResult({ active: false });
        }
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!result || !result.active) {
    return <main className="min-h-dvh bg-paper" />;
  }

  return (
    <main className="min-h-dvh bg-paper px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl gap-4 lg:grid-cols-[minmax(300px,430px)_minmax(0,1fr)] lg:items-stretch">
        <section className="flex flex-col items-center justify-center rounded-[2rem] bg-white px-6 py-8 text-center shadow-card sm:px-10 sm:py-12">
          <p className="text-sm font-medium text-accent">当前签到二维码</p>
          <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
            {result.session.class_name} · {result.session.course_name}
          </h1>
          <p className="mt-3 text-sm text-ink/65">{formatChinaDate(result.session.session_date)}</p>
          <div className="mt-8">
            <SessionQrCode sessionId={result.session.id} size={280} showUrl={false} />
          </div>
        </section>

        <section className="flex min-h-[420px] flex-col rounded-[2rem] bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-accent">未签到名单</p>
              <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">仍未签到</h2>
            </div>
            <span className="inline-flex min-w-16 items-center justify-center rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {result.unsignedCount} 人
            </span>
          </div>

          <div className="mt-5 flex-1 overflow-hidden rounded-[1.5rem] bg-paper">
            {result.unsignedStudents.length === 0 ? (
              <div className="flex h-full min-h-64 items-center justify-center px-6 text-center text-base font-medium text-ink/60">
                当前班级学生已全部完成签到或请假
              </div>
            ) : (
              <div className="grid max-h-[calc(100dvh-16rem)] gap-2 overflow-y-auto p-3 sm:p-4">
                {result.unsignedStudents.map((student, index) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-4 rounded-[1.25rem] bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-ink">{student.name}</p>
                      <p className="mt-1 text-sm text-ink/60">学号：{student.student_id}</p>
                    </div>
                    <span className="font-display text-lg font-bold text-ink/30">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="mt-4 text-sm text-ink/55">名单每 5 秒自动刷新。</p>
        </section>
      </div>
    </main>
  );
}
