"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateDeviceId } from "@/lib/device-id";

export function DeviceIdPanel() {
  const [deviceId, setDeviceId] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  async function handleCopy() {
    if (!deviceId) {
      return;
    }

    await navigator.clipboard.writeText(deviceId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card backdrop-blur">
        <p className="text-sm font-medium text-accent">排查信息</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">当前浏览器标识</h1>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          该标识只用于签到记录排查，不会绑定学生账号。
        </p>
        <div className="mt-6 rounded-[1.5rem] bg-paper p-5">
          <p className="break-all font-mono text-sm text-ink">{deviceId || "正在生成..."}</p>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
          >
            {copied ? "已复制" : "复制标识"}
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-paper px-5 py-3 text-sm font-semibold text-ink transition hover:border-ink/30"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
