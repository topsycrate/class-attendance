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

  return <p className="text-sm text-ink/60">每 5 秒自动刷新</p>;
}
