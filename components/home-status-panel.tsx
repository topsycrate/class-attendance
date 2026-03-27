"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { COURSE_NAME } from "@/lib/constants";
import { getOrCreateDeviceId } from "@/lib/device-id";

interface DeviceStatusResponse {
  device_id: string;
  is_bound: boolean;
  student?: {
    id: string;
    student_id: string;
    name: string;
    class_name: string;
  };
}

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
  const [status, setStatus] = useState<DeviceStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
        const response = await fetch("/api/device/status", { cache: "no-store" });
        const result = (await response.json()) as DeviceStatusResponse;
        setStatus(result);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const studentBlock = useMemo(() => {
    if (loading) {
      return <p className="text-sm text-paper/70">正在读取设备信息</p>;
    }

    if (status?.student) {
      return (
        <div className="space-y-1">
          <p className="text-lg font-bold text-paper">{status.student.name}</p>
          <p className="text-sm text-paper/70">学号：{status.student.student_id}</p>
          <p className="text-sm text-paper/70">班级：{status.student.class_name || "未设置"}</p>
        </div>
      );
    }

    return (
      <Link
        href="/bind"
        className="inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
      >
        去绑定
      </Link>
    );
  }, [loading, status]);

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
          <p className="text-sm text-paper/70">学生信息</p>
          <div className="mt-2">{studentBlock}</div>
        </div>
      </div>
    </section>
  );
}
