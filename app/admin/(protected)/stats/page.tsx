import { SessionStatsSearchForm } from "@/components/session-stats-search-form";
import { StudentStatsSearchForm } from "@/components/student-stats-search-form";
import {
  getSessionDateOptions,
  getSessionStats,
  getStudentOptions,
  getStudentStats,
} from "@/lib/actions";
import { formatChinaDateTime, formatPercent } from "@/lib/time";

interface StatsPageProps {
  searchParams: Promise<{
    session_date?: string;
    session_class?: string;
    student_class?: string;
    student_id?: string;
  }>;
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[1.5rem] bg-paper p-5">
      <p className="text-sm text-ink/65">{title}</p>
      <p className="mt-3 font-display text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const params = await searchParams;
  const [studentOptions, sessionDateOptions] = await Promise.all([
    getStudentOptions().catch(() => []),
    getSessionDateOptions().catch(() => []),
  ]);
  const sessionQuery =
    params.session_date && params.session_class
      ? await getSessionStats({
          date: params.session_date,
          class_name: params.session_class,
        }).catch(() => null)
      : null;
  const studentQuery = params.student_id
    ? await getStudentStats({
        student_id: params.student_id,
        class_name: params.student_class,
      }).catch(() => null)
    : null;

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-white p-6 shadow-card">
          <p className="text-sm font-medium text-accent">按日期与班级查询</p>
          <h2 className="text-2xl font-bold text-ink">场次统计</h2>
          <SessionStatsSearchForm
            options={sessionDateOptions}
            initialClassName={params.session_class}
            initialDate={params.session_date}
            studentClass={params.student_class}
            studentId={params.student_id}
          />

          {sessionQuery ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Metric title="班级总人数" value={sessionQuery.total} />
                <Metric title="已签到" value={sessionQuery.signed} />
                <Metric title="缺勤" value={sessionQuery.absent} />
              </div>
              <p className="text-sm text-ink/65">
                匹配到 {sessionQuery.matchedSessions} 个场次，按当日该班所有场次合并统计。
              </p>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-[1.5rem] bg-paper p-5">
                  <h3 className="text-lg font-semibold text-ink">已签到名单</h3>
                  <div className="mt-4 space-y-3">
                    {sessionQuery.signedStudents.length === 0 ? (
                      <p className="text-sm text-ink/60">暂无签到记录</p>
                    ) : (
                      sessionQuery.signedStudents.map((student) => (
                        <div key={student.id} className="rounded-2xl bg-white px-4 py-3">
                          <p className="font-medium text-ink">{student.name}</p>
                          <p className="text-sm text-ink/65">学号：{student.student_id}</p>
                          <p className="text-sm text-ink/65">
                            签到时间：{formatChinaDateTime(student.sign_time)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-[1.5rem] bg-paper p-5">
                  <h3 className="text-lg font-semibold text-ink">缺勤名单</h3>
                  <div className="mt-4 space-y-3">
                    {sessionQuery.absentStudents.length === 0 ? (
                      <p className="text-sm text-ink/60">暂无缺勤学生</p>
                    ) : (
                      sessionQuery.absentStudents.map((student) => (
                        <div key={student.id} className="rounded-2xl bg-white px-4 py-3">
                          <p className="font-medium text-ink">{student.name}</p>
                          <p className="text-sm text-ink/65">学号：{student.student_id}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : params.session_date && params.session_class ? (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              场次统计查询失败，请检查日期和班级后重试
            </div>
          ) : null}
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-card">
          <p className="text-sm font-medium text-accent">先选班级，再选学生</p>
          <h2 className="text-2xl font-bold text-ink">学生统计</h2>
          <StudentStatsSearchForm
            students={studentOptions}
            initialClassName={params.student_class ?? studentQuery?.class_name}
            initialStudentId={params.student_id}
            sessionDate={params.session_date}
            sessionClass={params.session_class}
          />

          {params.student_id && !studentQuery ? (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              未找到该学生，或查询时发生错误
            </div>
          ) : null}

          {studentQuery ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-[1.5rem] bg-paper p-5">
                <p className="text-sm text-ink/65">学生信息</p>
                <p className="mt-2 text-xl font-semibold text-ink">
                  {studentQuery.name} · {studentQuery.student_id}
                </p>
                <p className="mt-1 text-sm text-ink/65">班级：{studentQuery.class_name}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric title="总场次" value={studentQuery.total_sessions} />
                <Metric title="出勤" value={studentQuery.present_count} />
                <Metric title="缺勤" value={studentQuery.absent_count} />
                <Metric title="出勤率" value={formatPercent(studentQuery.attendance_rate)} />
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
