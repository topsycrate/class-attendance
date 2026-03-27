import Link from "next/link";
import { CLASS_OPTIONS } from "@/lib/constants";
import { generateRandomSignCode, getRecentSessions } from "@/lib/actions";
import { formatSupabaseError } from "@/lib/supabase";
import { formatChinaDate, formatChinaDateTime } from "@/lib/time";

interface AdminSessionPageProps {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
}

export default async function AdminSessionPage({ searchParams }: AdminSessionPageProps) {
  const params = await searchParams;
  const defaultSignCode = generateRandomSignCode();
  let sessions: Awaited<ReturnType<typeof getRecentSessions>> = [];
  let loadError: string | null = null;

  try {
    sessions = await getRecentSessions();
  } catch (error) {
    loadError = formatSupabaseError(error);
  }

  return (
    <div className="space-y-4">
      {params.message ? (
        <div className="rounded-2xl bg-mint px-4 py-3 text-sm text-ink">{params.message}</div>
      ) : null}
      {params.error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{params.error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="rounded-[2rem] bg-white p-6 shadow-card">
          <div className="space-y-2">
            <p className="text-sm font-medium text-accent">新建签到</p>
            <h2 className="text-2xl font-bold text-ink">开始新的签到场次</h2>
            <p className="text-sm leading-6 text-ink/70">选择班级并创建签到。</p>
          </div>

          <form action="/api/admin/sessions" method="post" className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">班级</span>
              <select
                name="class_name"
                defaultValue="一班"
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent"
              >
                {CLASS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">签到码</span>
              <input
                name="sign_code"
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                defaultValue={defaultSignCode}
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent"
                placeholder="4 位数字"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">签到时长（分钟）</span>
              <input
                type="number"
                name="duration_minutes"
                min={1}
                max={240}
                defaultValue={15}
                className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent"
                required
              />
            </label>

            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-2xl bg-ink px-4 py-4 text-base font-semibold text-white transition hover:bg-ink/90"
            >
              创建并进入实时页
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-accent">最近场次</p>
              <h2 className="text-2xl font-bold text-ink">快速查看</h2>
            </div>
          </div>

          {loadError ? (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {loadError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            {sessions.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-line bg-paper px-5 py-10 text-center text-sm text-ink/60">
                暂无签到场次
              </div>
            ) : (
              sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/admin/session/${session.id}`}
                  className="rounded-[1.5rem] border border-line bg-paper p-5 transition hover:border-accent/40 hover:shadow-card"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-ink">
                        {session.class_name} · {session.course_name}
                      </h3>
                      <p className="text-sm text-ink/70">
                        日期：{formatChinaDate(session.session_date)} ｜ 创建时间：
                        {formatChinaDateTime(session.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-ink">
                        {session.duration_minutes} 分钟
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          session.status === "active"
                            ? "bg-mint text-ink"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {session.status === "active" ? "进行中" : "已结束"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
