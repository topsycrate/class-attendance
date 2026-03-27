"use client";

import { useEffect, useMemo, useState } from "react";
import { CLASS_OPTIONS } from "@/lib/constants";
import type { ClassName, StudentOption } from "@/lib/types";

interface StudentStatsSearchFormProps {
  students: StudentOption[];
  initialClassName?: string;
  initialStudentId?: string;
  sessionDate?: string;
  sessionClass?: string;
}

function resolveInitialClass(
  initialClassName: string | undefined,
  students: StudentOption[],
): ClassName {
  if (initialClassName && CLASS_OPTIONS.includes(initialClassName as ClassName)) {
    return initialClassName as ClassName;
  }

  const firstAvailableClass = CLASS_OPTIONS.find((className) =>
    students.some((student) => student.class_name === className),
  );

  return firstAvailableClass ?? "一班";
}

export function StudentStatsSearchForm({
  students,
  initialClassName,
  initialStudentId,
  sessionDate,
  sessionClass,
}: StudentStatsSearchFormProps) {
  const groupedStudents = useMemo(
    () =>
      CLASS_OPTIONS.reduce<Record<ClassName, StudentOption[]>>(
        (result, className) => ({
          ...result,
          [className]: students.filter((student) => student.class_name === className),
        }),
        {
          一班: [],
          二班: [],
        },
      ),
    [students],
  );
  const [selectedClass, setSelectedClass] = useState<ClassName>(() =>
    resolveInitialClass(initialClassName, students),
  );
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId ?? "");
  const studentOptions = groupedStudents[selectedClass];

  useEffect(() => {
    if (studentOptions.some((student) => student.student_id === selectedStudentId)) {
      return;
    }

    setSelectedStudentId(studentOptions[0]?.student_id ?? "");
  }, [selectedClass, selectedStudentId, studentOptions]);

  return (
    <form method="get" className="mt-6 space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink">班级</span>
        <select
          name="student_class"
          value={selectedClass}
          onChange={(event) => setSelectedClass(event.target.value as ClassName)}
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
        <span className="text-sm font-medium text-ink">学生</span>
        <select
          name="student_id"
          value={selectedStudentId}
          onChange={(event) => setSelectedStudentId(event.target.value)}
          disabled={studentOptions.length === 0}
          className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {studentOptions.length === 0 ? (
            <option value="">当前班级暂无学生</option>
          ) : null}
          {studentOptions.map((student) => (
            <option key={student.id} value={student.student_id}>
              {student.student_id} · {student.name}
            </option>
          ))}
        </select>
      </label>

      {sessionDate ? <input type="hidden" name="session_date" value={sessionDate} /> : null}
      {sessionClass ? <input type="hidden" name="session_class" value={sessionClass} /> : null}

      <button
        type="submit"
        disabled={!selectedStudentId}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-ink px-4 py-4 text-base font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        查询学生统计
      </button>
    </form>
  );
}
