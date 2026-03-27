import { notFound } from "next/navigation";
import { DeleteSessionForm } from "@/components/delete-session-form";
import { SessionAutoRefresh } from "@/components/session-auto-refresh";
import { SessionQrCode } from "@/components/session-qr-code";
import { getLiveSessionData } from "@/lib/actions";
import { formatChinaDate, formatChinaDateTime } from "@/lib/time";

interface LiveSessionPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
}

function CountCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-[1.5rem] bg-paper p-5">
      <p className="text-sm text-ink/65">{title}</p>
      <p className="mt-3 font-display text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

export default async function LiveSessionPage({ params, searchParams }: LiveSessionPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const data = await getLiveSessionData(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {query.error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{query.error}</div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="rounded-[2rem] bg-white p-6 shadow-card">
          <p className="text-sm font-medium text-accent">学生扫码入口</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">实时签到二维码</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_132px] xl:grid-cols-1">
            <SessionQrCode sessionId={data.session.id} />
            <div className="flex min-h-[132px] flex-col items-center justify-center rounded-[1.75rem] bg-ink px-4 py-5 text-paper">
              <p className="text-sm text-paper/70">签到码</p>
              <p className="mt-2 font-display text-5xl font-bold tracking-[0.3em] text-paper sm:text-4xl xl:text-5xl">
                {data.session.sign_code}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-accent">实时页</p>
              <h2 className="text-2xl font-bold text-ink">
                {data.session.class_name} · {data.session.course_name}
              </h2>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <SessionAutoRefresh />
              {data.session.status === "active" ? (
                <DeleteSessionForm sessionId={data.session.id} />
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <CountCard title="已签到人数" value={data.signedCount} />
            <CountCard title="未签到人数" value={data.unsignedCount} />
          </div>

          <details className="mt-4 rounded-[1.5rem] bg-paper p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <span className="text-base font-semibold text-ink">场次信息</span>
              <span className="text-sm text-ink/60">点击展开</span>
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.5rem] bg-white p-5">
                <p className="text-sm text-ink/65">签到日期</p>
                <p className="mt-3 text-lg font-semibold text-ink">
                  {formatChinaDate(data.session.session_date)}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-white p-5">
                <p className="text-sm text-ink/65">创建时间</p>
                <p className="mt-3 text-lg font-semibold text-ink">
                  {formatChinaDateTime(data.session.created_at)}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-white p-5">
                <p className="text-sm text-ink/65">状态</p>
                <p className="mt-3 text-lg font-semibold text-ink">
                  {data.session.status === "active" ? "进行中" : "已结束"}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-white p-5">
                <p className="text-sm text-ink/65">时长</p>
                <p className="mt-3 text-lg font-semibold text-ink">
                  {data.session.duration_minutes} 分钟
                </p>
              </div>
            </div>
          </details>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-accent">已签到名单</p>
              <h3 className="text-xl font-bold text-ink">完成签到的学生</h3>
            </div>
            <span className="rounded-full bg-mint px-3 py-1 text-sm font-medium text-ink">
              {data.signedCount} 人
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {data.signedStudents.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-line bg-paper px-4 py-10 text-center text-sm text-ink/60">
                暂无学生签到
              </div>
            ) : (
              data.signedStudents.map((student) => (
                <div
                  key={`${student.id}-${student.sign_time}`}
                  className="rounded-[1.5rem] bg-paper px-4 py-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-ink">{student.name}</p>
                      <p className="text-sm text-ink/65">学号：{student.student_id}</p>
                    </div>
                    <p className="font-display text-sm font-medium text-ink">
                      {formatChinaDateTime(student.sign_time)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-accent">未签到名单</p>
              <h3 className="text-xl font-bold text-ink">仍未签到的学生</h3>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600">
              {data.unsignedCount} 人
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {data.unsignedStudents.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-line bg-paper px-4 py-10 text-center text-sm text-ink/60">
                当前班级学生已全部签到
              </div>
            ) : (
              data.unsignedStudents.map((student) => (
                <div key={student.id} className="rounded-[1.5rem] bg-paper px-4 py-4">
                  <p className="text-base font-semibold text-ink">{student.name}</p>
                  <p className="text-sm text-ink/65">学号：{student.student_id}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
