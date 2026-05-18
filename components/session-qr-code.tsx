"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface SessionQrCodeProps {
  sessionId: string;
  size?: number;
  showUrl?: boolean;
}

export function SessionQrCode({
  sessionId,
  size = 240,
  showUrl = true,
}: SessionQrCodeProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/sign?session_id=${sessionId}`);
  }, [sessionId]);

  if (!url) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-paper text-sm font-semibold text-muted"
        style={{ height: size, width: size }}
      >
        正在生成二维码...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-line bg-paper p-4">
        <QRCodeSVG value={url} size={size} marginSize={4} bgColor="#F0EEE8" fgColor="#18212F" />
      </div>
      {showUrl ? (
        <div className="max-w-sm rounded-lg bg-paper px-4 py-3 text-sm font-semibold text-muted">
          扫码地址：<span className="break-all font-medium text-ink">{url}</span>
        </div>
      ) : null}
    </div>
  );
}
