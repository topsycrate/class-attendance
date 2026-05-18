import Link from "next/link";
import { DeleteSessionForm } from "@/components/delete-session-form";
import { getHistoricalSessionsData } from "@/lib/actions";
import { formatChinaDate, formatChinaDateTime } from "@/lib/time";

interface StatsPageProps {
  searchParams: Promise<{
    error?: string;
    message?: string;
    session_date?: string;
  }>;
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "mint" | "amber" | "red";
}) {
  const styles =
    tone === "mint"
      ? "bg-mint text-ink"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-600";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${styles}`}>
      {label} {value}
    </span>
  );
}

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const params = await searchParams;
  const history = await getHistoricalSessionsData(params.session_date);

  return (
    <div className="space-y-6">
      {params.message ? (
        <div className="rounded-2xl bg-mint px-4 py-3 text-sm text-ink">{params.message}</div>
      ) : null}
      {params.error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{params.error}</div>
      ) : null}

      <section className="rounded-[2rem] bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">历史签到</p>
            <h2 className="text-2xl font-bold text-ink">全部已结束场次</h2>
            <p className="mt-2 text-sm text-ink/65">
              默认显示全部历史签到，可按日期筛选。日期列表只展示有签到记录的日期。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={
                history.selected_date
                  ? `/api/admin/exports/attendance?session_date=${encodeURIComponent(history.selected_date)}`
                  : "/api/admin/exports/attendance"
              }
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink transition hover:bg-white"
            >
              导出当前查询
            </a>
            <a
              href="/api/admin/exports/attendance/all"
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink transition hover:bg-white"
            >
              导出全部签到信息
            </a>
          </div>
        </div>

        <form method="get" className="mt-6 flex flex-col gap-4 md:flex-row md:items-end">
          <label className="block flex-1 space-y-2">
            <span className="text-sm font-medium text-ink">按日期筛选</span>
            <select
              name="session_date"
              defaultValue={history.selected_date}
              className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent"
            >
              <option value="">全部日期</option>
              {history.date_options.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
            >
              应用筛选
            </button>
            {history.selected_date ? (
              <Link
                href="/admin/stats"
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink transition hover:bg-white"
              >
                清除筛选
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] bg-white p-6 shadow-card">
        <div>
          <p className="text-sm font-medium text-accent">场次列表</p>
          <h3 className="text-2xl font-bold text-ink">
            {history.selected_date ? `${formatChinaDate(history.selected_date)} 的历史签到` : "全部历史签到"}
          </h3>
        </div>

        <div className="mt-6 space-y-4">
          {history.sessions.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-line bg-paper px-4 py-10 text-center text-sm text-ink/60">
              当前筛选下暂无历史签到记录
            </div>
          ) : (
            history.sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-[1.5rem] border border-line bg-paper p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-semibold text-ink">
                        {session.class_name} · {session.course_name}
                      </p>
                      <p className="mt-1 text-sm text-ink/65">
                        日期：{formatChinaDate(session.session_date)} ｜ 创建时间：
                        {formatChinaDateTime(session.created_at)} ｜ 时长：{session.duration_minutes} 分钟
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SummaryPill label="已签到" value={session.signed_count} tone="mint" />
                      <SummaryPill label="请假" value={session.leave_count} tone="amber" />
                      <SummaryPill label="缺勤" value={session.absent_count} tone="red" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/admin/session/${session.id}`}
                      className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper"
                    >
                      查看详情
                    </Link>
                    <DeleteSessionForm
                      sessionId={session.id}
                      redirectPath="/admin/stats"
                      sessionDateFilter={history.selected_date || undefined}
                      buttonLabel="删除记录"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
