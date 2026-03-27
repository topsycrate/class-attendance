import type { Metadata } from "next";
import "@/app/globals.css";
import { DeviceCookieSync } from "@/components/device-cookie-sync";

export const metadata: Metadata = {
  title: "课堂签到系统",
  description: "英语听力课堂签到",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans text-ink antialiased">
        <DeviceCookieSync />
        {children}
      </body>
    </html>
  );
}
