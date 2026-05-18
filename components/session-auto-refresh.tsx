"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SessionAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [router]);

  return (
    <p className="inline-flex items-center rounded-lg bg-mint px-3 py-2 text-sm font-extrabold text-accent">
      5 秒自动刷新
    </p>
  );
}
