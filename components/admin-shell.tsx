import Link from "next/link";
import { LogoutForm } from "@/components/logout-form";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-dvh bg-paper px-3 py-4 sm:px-4 sm:py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] bg-ink px-5 py-5 text-paper shadow-card sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-paper/70">教师后台</p>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">课堂签到管理</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/admin/session"
                className="inline-flex items-center rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-paper transition hover:bg-white/15"
              >
                新建签到
              </Link>
              <Link
                href="/admin/stats"
                className="inline-flex items-center rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-paper transition hover:bg-white/15"
              >
                统计查询
              </Link>
              <Link
                href="/admin/students"
                className="inline-flex items-center rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-paper transition hover:bg-white/15"
              >
                学生导入
              </Link>
              <LogoutForm />
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
