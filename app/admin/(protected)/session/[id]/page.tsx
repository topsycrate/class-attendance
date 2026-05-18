import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteSessionForm } from "@/components/delete-session-form";
import { MarkStudentLeaveForm } from "@/components/mark-student-leave-form";
import { MarkStudentSignedForm } from "@/components/mark-student-signed-form";
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
    message?: string;
  }>;
}

function CountCard({
  title,
  value,
  toneClass,
}: {
  title: string;
  value: number;
  toneClass: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-2.5 md:p-5">
      <p className="text-sm font-extrabold text-muted">{title}</p>
      <p className={`mt-1 font-display text-3xl font-black md:mt-2 md:text-4xl ${toneClass}`}>{value}</p>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  count,
  badgeClassName,
}: {
  eyebrow: string;
  title: string;
  count: number;
  badgeClassName: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-extrabold text-accent">{eyebrow}</p>
        <h3 className="text-lg font-black text-ink md:text-xl">{title}</h3>
      </div>
      <span className={`inline-flex items-center rounded-lg px-3 py-1 text-sm font-extrabold ${badgeClassName}`}>
        {count} 人
      </span>
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

  const isActive = data.session.status === "active";

  return (
    <div className="space-y-4 md:space-y-6">
      {query.message ? (
        <div className="rounded-lg bg-mint px-4 py-3 text-sm font-semibold text-ink">
          {query.message}
        </div>
      ) : null}
      {query.error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {query.error}
        </div>
      ) : null}

      <section className="md:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold text-accent">教师端</p>
            <h1 className="text-3xl font-black tracking-tight text-ink">签到管理</h1>
          </div>
          <Link
            href="/admin/students"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-xl font-black shadow-sm"
            aria-label="学生管理"
          >
            ♙
          </Link>
        </div>
      </section>

      <section className="rounded-lg bg-sidebar p-3 text-white shadow-card md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-mint">{isActive ? "发布签到" : "历史签到"}</p>
            <h2 className="mt-2 text-2xl font-black">
              {data.session.class_name} · {data.session.course_name}
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-extrabold">
            <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-400" : "bg-slate-400"}`} />
            {isActive ? "进行中" : "已结束"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/15 bg-white/10 p-3">
            <p className="text-xs font-extrabold text-slate-300">班级</p>
            <p className="mt-1 text-base font-black">{data.session.class_name}</p>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 p-3">
            <p className="text-xs font-extrabold text-slate-300">时长</p>
            <p className="mt-1 text-base font-black">{data.session.duration_minutes} 分钟</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <Link
            href={isActive ? "/qr" : "/admin/session"}
            target={isActive ? "_blank" : undefined}
            className="flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-black text-white"
          >
            {isActive ? "打开二维码" : "新建签到"}
          </Link>
          <Link
            href="/admin/stats"
            className="flex h-11 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 text-sm font-black text-white"
          >
            历史
          </Link>
        </div>
      </section>

      <section className="hidden items-center justify-between gap-4 rounded-lg border border-line bg-white px-6 py-5 md:flex">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-muted">LIVE ATTENDANCE</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-ink">
            {data.session.class_name} · {data.session.course_name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {isActive ? <SessionAutoRefresh /> : null}
          <Link
            href="/admin/session"
            className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-extrabold text-white transition hover:bg-accent/90"
          >
            新建签到
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:items-start xl:gap-5">
        <div className="space-y-4 md:space-y-5">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <CountCard
              title={isActive ? "未签到" : "缺勤"}
              value={data.unsignedCount}
              toneClass="text-rose"
            />
            <CountCard title="请假" value={data.leaveCount} toneClass="text-amber" />
            <CountCard title="已签到" value={data.signedCount} toneClass="text-emerald-700" />
          </div>

          <div className="flex rounded-lg border border-line bg-white p-1 md:hidden">
            <span className="flex h-10 flex-1 items-center justify-center rounded-lg bg-ink text-sm font-black text-white">
              {isActive ? "未签到" : "缺勤"}
            </span>
            <span className="flex h-10 flex-1 items-center justify-center text-sm font-extrabold text-ink">
              请假
            </span>
            <span className="flex h-10 flex-1 items-center justify-center text-sm font-extrabold text-ink">
              已签到
            </span>
          </div>

          <section className="rounded-lg border border-line bg-white p-3 md:p-5">
            <SectionHeader
              eyebrow={isActive ? "未签到名单" : "缺勤名单"}
              title={isActive ? "仍未签到的学生" : "未签到也未请假的学生"}
              count={data.unsignedCount}
              badgeClassName="bg-red-50 text-rose"
            />

            <div className="mt-4 overflow-hidden rounded-lg border border-line">
              <div className="hidden h-12 grid-cols-[220px_140px_160px_1fr] items-center bg-paper px-4 text-xs font-black text-muted md:grid">
                <span>学生</span>
                <span>班级</span>
                <span>状态</span>
                <span>操作</span>
              </div>

              {data.unsignedStudents.length === 0 ? (
                <div className="bg-paper px-4 py-10 text-center text-sm font-semibold text-muted">
                  {isActive ? "当前班级学生已全部完成签到或请假" : "当前场次暂无缺勤学生"}
                </div>
              ) : (
                data.unsignedStudents.map((student) => (
                  <div
                    key={student.id}
                    className="border-t border-line bg-white p-3 first:border-t-0 md:grid md:grid-cols-[220px_140px_160px_1fr] md:items-center md:gap-0 md:p-4"
                  >
                    <div>
                      <p className="text-base font-black text-ink md:text-base">{student.name}</p>
                      <p className="mt-1 text-sm font-bold text-muted md:text-xs">
                        {student.student_id}
                      </p>
                    </div>
                    <p className="mt-2 text-sm font-extrabold text-ink md:mt-0">
                      {data.session.class_name}
                    </p>
                    <div className="mt-2 md:mt-0">
                      <span className="inline-flex rounded-lg bg-red-50 px-3 py-2 text-sm font-black text-rose">
                        {isActive ? "未签到" : "缺勤"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 md:mt-0 md:flex md:flex-wrap">
                      <MarkStudentSignedForm sessionId={data.session.id} studentId={student.id} />
                      {isActive ? (
                        <MarkStudentLeaveForm sessionId={data.session.id} studentId={student.id} />
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-line bg-white p-4 md:p-5">
              <SectionHeader
                eyebrow="请假名单"
                title="已登记请假的学生"
                count={data.leaveCount}
                badgeClassName="bg-amber-soft text-amber"
              />
              <div className="mt-4 space-y-2">
                {data.leaveStudents.length === 0 ? (
                  <div className="rounded-lg bg-paper px-4 py-8 text-center text-sm font-semibold text-muted">
                    暂无请假记录
                  </div>
                ) : (
                  data.leaveStudents.map((student) => (
                    <div key={`${student.id}-${student.leave_time}`} className="rounded-lg bg-paper p-3">
                      <p className="font-black text-ink">{student.name}</p>
                      <p className="mt-1 text-xs font-bold text-muted">
                        {student.student_id} · {formatChinaDateTime(student.leave_time)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-4 md:p-5">
              <SectionHeader
                eyebrow="已签到名单"
                title="完成签到的学生"
                count={data.signedCount}
                badgeClassName="bg-mint text-ink"
              />
              <div className="mt-4 space-y-2">
                {data.signedStudents.length === 0 ? (
                  <div className="rounded-lg bg-paper px-4 py-8 text-center text-sm font-semibold text-muted">
                    暂无学生签到
                  </div>
                ) : (
                  data.signedStudents.slice(0, 6).map((student) => (
                    <div key={`${student.id}-${student.sign_time}`} className="rounded-lg bg-paper p-3">
                      <p className="font-black text-ink">{student.name}</p>
                      <p className="mt-1 text-xs font-bold text-muted">
                        {student.student_id} · {formatChinaDateTime(student.sign_time)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-line bg-white p-5">
            {isActive ? (
              <>
                <p className="text-sm font-black text-accent">学生扫码入口</p>
                <h2 className="mt-2 text-2xl font-black text-ink">实时签到二维码</h2>
                <div className="mt-5 flex justify-center md:block md:text-center">
                  <SessionQrCode sessionId={data.session.id} size={220} showUrl={false} />
                </div>
                <p className="mt-4 text-sm font-semibold leading-6 text-muted">
                  投屏时可打开 /qr，学生登录后扫码自动签到。
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-black text-accent">历史签到</p>
                <h2 className="mt-2 text-2xl font-black text-ink">签到已结束</h2>
                <p className="mt-4 rounded-lg bg-paper p-4 text-sm font-semibold leading-6 text-muted">
                  已结束场次不再接受学生扫码签到，缺勤学生仍可由老师补签。
                </p>
              </>
            )}
          </section>

          <section className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-xl font-black text-ink">场次信息</h2>
            <dl className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm font-extrabold text-muted">日期</dt>
                <dd className="text-sm font-black text-ink">{formatChinaDate(data.session.session_date)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm font-extrabold text-muted">时长</dt>
                <dd className="text-sm font-black text-ink">{data.session.duration_minutes} 分钟</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm font-extrabold text-muted">状态</dt>
                <dd className={`text-sm font-black ${isActive ? "text-emerald-700" : "text-muted"}`}>
                  {isActive ? "进行中" : "已结束"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-sm font-extrabold text-muted">创建</dt>
                <dd className="text-right text-sm font-black text-ink">
                  {formatChinaDateTime(data.session.created_at)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg bg-sidebar p-5 text-white">
            <h2 className="text-xl font-black">快捷操作</h2>
            <div className="mt-4 grid gap-3">
              {isActive ? (
                <Link
                  href="/qr"
                  target="_blank"
                  className="flex h-11 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-sm font-black text-white"
                >
                  打开公开二维码
                </Link>
              ) : null}
              <DeleteSessionForm
                sessionId={data.session.id}
                redirectPath={isActive ? "/admin/session" : "/admin/stats"}
                sessionDateFilter={isActive ? undefined : data.session.session_date}
                buttonLabel={isActive ? "删除本场签到" : "删除历史签到"}
              />
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
