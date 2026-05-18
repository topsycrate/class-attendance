"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutForm } from "@/components/logout-form";

interface AdminShellProps {
  children: React.ReactNode;
}

const navItems = [
  {
    href: "/admin/session",
    label: "当前签到",
    shortLabel: "当前",
    description: "实时状态与补签",
    icon: "◎",
  },
  {
    href: "/admin/stats",
    label: "历史签到",
    shortLabel: "历史",
    description: "筛选、导出记录",
    icon: "↺",
  },
  {
    href: "/admin/students",
    label: "学生管理",
    shortLabel: "学生",
    description: "名单、PIN、备份",
    icon: "♙",
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-paper text-ink md:flex">
      <aside className="hidden min-h-dvh w-64 shrink-0 flex-col bg-sidebar px-5 py-6 text-white md:flex">
        <Link href="/admin/session" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-2xl font-bold text-accent">
            ✓
          </span>
          <span>
            <span className="block text-lg font-extrabold">课堂签到</span>
            <span className="block text-xs font-semibold text-slate-300">英语听力管理台</span>
          </span>
        </Link>

        <nav className="mt-11 space-y-3">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-3.5 transition ${
                  active
                    ? "bg-white text-ink"
                    : "bg-sidebar-soft text-slate-100 hover:bg-white/10"
                }`}
              >
                <span className={`text-2xl ${active ? "text-accent" : "text-slate-300"}`}>
                  {item.icon}
                </span>
                <span>
                  <span className="block text-sm font-extrabold">{item.label}</span>
                  <span className={`block text-xs font-semibold ${active ? "text-muted" : "text-slate-400"}`}>
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-lg border border-slate-700 bg-slate-950 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <p className="text-sm font-extrabold">本地服务正常</p>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-300">
            SQLite 数据库就绪，签到记录按本地时间写入。
          </p>
        </div>

        <div className="mt-4">
          <LogoutForm />
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-0">
        <main className="mx-auto w-full max-w-[1180px] px-4 py-5 md:px-6 md:py-6 xl:max-w-none xl:px-6">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-4 bottom-3 z-40 grid h-16 grid-cols-3 rounded-lg border border-line bg-white p-1 shadow-card md:hidden">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center rounded-lg text-xs font-extrabold ${
                active ? "bg-mint text-accent" : "text-muted"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="mt-1">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
