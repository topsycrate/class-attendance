import Link from "next/link";
import { DatabaseBackupDialog } from "@/components/database-backup-dialog";
import { DeleteStudentForm } from "@/components/delete-student-form";
import { ResetStudentPinForm } from "@/components/reset-student-pin-form";
import { StudentImportDialog } from "@/components/student-import-dialog";
import { CLASS_OPTIONS } from "@/lib/constants";
import { getStudentsManagementData } from "@/lib/actions";
import { formatChinaDateTime, formatPercent } from "@/lib/time";

interface StudentsPageProps {
  searchParams: Promise<{
    class_name?: string;
    message?: string;
    error?: string;
    errors?: string;
  }>;
}

const sampleText = `学号,姓名,班级,邮箱
2024001,张三,一班,
2024002,李四,二班,`;

function getRateBadgeClass(rate: number) {
  if (rate >= 0.9) {
    return "bg-mint text-ink";
  }

  if (rate >= 0.75) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-red-50 text-red-600";
}

function getPinBadgeClass(hasPin: boolean) {
  return hasPin ? "bg-sky-50 text-sky-700" : "bg-stone-100 text-stone-600";
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const params = await searchParams;
  const management = await getStudentsManagementData(params.class_name);

  return (
    <div className="space-y-6">
      {params.message ? (
        <div className="rounded-2xl bg-mint px-4 py-3 text-sm text-ink">{params.message}</div>
      ) : null}
      {params.error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{params.error}</div>
      ) : null}
      {params.errors ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{params.errors}</div>
      ) : null}

      <section className="rounded-[1.75rem] bg-white p-4 shadow-card sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">学生管理</p>
            <h2 className="text-xl font-bold text-ink sm:text-2xl">共 {management.total} 人</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              当前筛选显示 {management.filtered_total} 人，列表默认按学号排序。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            <StudentImportDialog defaultValue={sampleText} />
            <DatabaseBackupDialog />
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/students"
                className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-medium transition sm:rounded-2xl sm:px-4 sm:text-sm ${
                  management.selected_class === "all"
                    ? "bg-ink text-white"
                    : "border border-line bg-paper text-ink hover:bg-white"
                }`}
              >
                全部
              </Link>
              {CLASS_OPTIONS.map((item) => (
                <Link
                  key={item}
                  href={`/admin/students?class_name=${encodeURIComponent(item)}`}
                  className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-medium transition sm:rounded-2xl sm:px-4 sm:text-sm ${
                    management.selected_class === item
                      ? "bg-ink text-white"
                      : "border border-line bg-paper text-ink hover:bg-white"
                  }`}
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-white p-4 shadow-card sm:rounded-[2rem] sm:p-6">
        <div>
          <p className="text-sm font-medium text-accent">学生列表</p>
          <h3 className="text-xl font-bold text-ink sm:text-2xl">
            {management.selected_class === "all" ? "全部学生" : `${management.selected_class} 学生`}
          </h3>
        </div>

        <div className="mt-5 space-y-3 sm:mt-6 sm:space-y-4">
          {management.students.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-line bg-paper px-4 py-10 text-center text-sm text-ink/60">
              当前筛选暂无学生数据
            </div>
          ) : (
            management.students.map((student) => {
              return (
                <div
                  key={student.id}
                  className="rounded-[1.5rem] border border-line bg-paper px-4 py-4 sm:px-5 sm:py-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink sm:text-base">
                          {student.name} · {student.student_id}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getPinBadgeClass(
                            student.has_pin,
                          )}`}
                        >
                          {student.has_pin ? "PIN 已设置" : "未设 PIN"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-mint px-3 py-1 text-xs font-semibold text-ink">
                          签到 {student.sign_count}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                          缺勤 {student.absent_count}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getRateBadgeClass(
                            student.attendance_rate,
                          )}`}
                        >
                          出勤率 {formatPercent(student.attendance_rate)}
                        </span>
                      </div>

                      <div className="grid gap-2 text-xs leading-6 text-ink/65 sm:text-sm">
                        <p>
                          班级：{student.class_name || "未设置"}
                          {student.email ? ` ｜ ${student.email}` : ""}
                        </p>
                        <p>
                          PIN 状态：
                          {student.has_pin
                            ? `已设置${student.pin_set_at ? ` ｜ 设置时间：${formatChinaDateTime(student.pin_set_at)}` : ""}`
                            : "未设置"}
                        </p>
                        <p>签到限制：不绑定设备；同一设备每场只能签到一次</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ResetStudentPinForm
                        studentId={student.id}
                        classNameFilter={management.selected_class}
                        disabled={!student.has_pin}
                      />
                      <DeleteStudentForm
                        studentId={student.id}
                        classNameFilter={management.selected_class}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
