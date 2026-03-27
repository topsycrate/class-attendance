import { getStudentsOverview } from "@/lib/actions";

interface StudentsImportPageProps {
  searchParams: Promise<{
    message?: string;
    error?: string;
    errors?: string;
  }>;
}

const sampleText = `学号,姓名,班级,邮箱
2024001,张三,一班,
2024002,李四,二班,`;

export default async function StudentsImportPage({ searchParams }: StudentsImportPageProps) {
  const [params, overview] = await Promise.all([searchParams, getStudentsOverview()]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[2rem] bg-white p-6 shadow-card">
        <p className="text-sm font-medium text-accent">学生导入</p>
        <h2 className="text-2xl font-bold text-ink">粘贴学生名单</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">每行一名学生，支持逗号或制表符。</p>

        <form action="/api/admin/students/import" method="post" className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-ink">格式</span>
            <textarea
              name="students_text"
              rows={14}
              defaultValue={sampleText}
              className="w-full rounded-[1.5rem] border border-line bg-paper px-4 py-4 font-mono text-sm outline-none transition focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-2xl bg-ink px-4 py-4 text-base font-semibold text-white transition hover:bg-ink/90"
          >
            导入学生
          </button>
        </form>

        {params.message ? (
          <div className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm text-ink">{params.message}</div>
        ) : null}
        {params.error ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{params.error}</div>
        ) : null}
        {params.errors ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{params.errors}</div>
        ) : null}
      </section>

      <section className="space-y-6">
        <div className="rounded-[2rem] bg-white p-6 shadow-card">
          <p className="text-sm font-medium text-accent">需要预录入的信息</p>
          <div className="mt-4 space-y-3 text-sm text-ink/75">
            <p>最少需要：学号、姓名。</p>
            <p>可选：班级、邮箱。</p>
            <p>其他表不用提前录入，系统会在绑定和签到时自动产生数据。</p>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-accent">当前学生</p>
              <h3 className="text-2xl font-bold text-ink">共 {overview.total} 人</h3>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {overview.students.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-line bg-paper px-4 py-10 text-center text-sm text-ink/60">
                暂无学生数据
              </div>
            ) : (
              overview.students.map((student) => (
                <div key={student.id} className="rounded-[1.5rem] bg-paper px-4 py-4">
                  <p className="text-base font-semibold text-ink">
                    {student.name} · {student.student_id}
                  </p>
                  <p className="mt-1 text-sm text-ink/65">
                    班级：{student.class_name || "未设置"}{student.email ? ` ｜ ${student.email}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
