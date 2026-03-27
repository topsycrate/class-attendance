"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface SessionQrCodeProps {
  sessionId: string;
}

export function SessionQrCode({ sessionId }: SessionQrCodeProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/sign?session_id=${sessionId}`);
  }, [sessionId]);

  if (!url) {
    return (
      <div className="flex h-[240px] w-[240px] items-center justify-center rounded-[1.75rem] bg-paper text-sm text-ink/60">
        正在生成二维码...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-[1.75rem] bg-white p-4 shadow-card">
        <QRCodeSVG value={url} size={240} marginSize={4} bgColor="#FFFFFF" fgColor="#102434" />
      </div>
      <div className="max-w-sm rounded-2xl bg-paper px-4 py-3 text-sm text-ink/70">
        扫码地址：<span className="break-all font-medium text-ink">{url}</span>
      </div>
    </div>
  );
}
