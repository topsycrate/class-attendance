import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";

interface AdminLoginPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  if (await isAdminAuthenticated()) {
    redirect("/admin/session");
  }

  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-card backdrop-blur">
        <p className="text-sm font-medium text-accent">教师后台</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">管理员登录</h1>
        <form action="/api/admin/login" method="post" className="mt-5 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-ink">后台密码</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none transition focus:border-accent"
              placeholder="请输入管理员密码"
            />
          </label>
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-2xl bg-ink px-4 py-4 text-base font-semibold text-white transition hover:bg-ink/90"
          >
            登录后台
          </button>
        </form>

        {params.error ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {params.error}
          </div>
        ) : null}

        <div className="mt-5">
          <Link href="/" className="text-sm font-medium text-ink underline underline-offset-4">
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
