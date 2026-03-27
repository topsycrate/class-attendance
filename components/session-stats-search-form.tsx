"use client";

import { useEffect, useMemo, useState } from "react";
import { CLASS_OPTIONS } from "@/lib/constants";
import type { ClassName, SessionDateOption } from "@/lib/types";

interface SessionStatsSearchFormProps {
  options: SessionDateOption[];
  initialClassName?: string;
  initialDate?: string;
  studentClass?: string;
  studentId?: string;
}

function resolveInitialClass(
  initialClassName: string | undefined,
  options: SessionDateOption[],
): ClassName {
  if (initialClassName && CLASS_OPTIONS.includes(initialClassName as ClassName)) {
    return initialClassName as ClassName;
  }

  const firstAvailableClass = CLASS_OPTIONS.find((className) =>
    options.some((option) => option.class_name === className),
  );

  return firstAvailableClass ?? "一班";
}

export function SessionStatsSearchForm({
  options,
  initialClassName,
  initialDate,
  studentClass,
  studentId,
}: SessionStatsSearchFormProps) {
  const groupedOptions = useMemo(
    () =>
      CLASS_OPTIONS.reduce<Record<ClassName, SessionDateOption[]>>(
        (result, className) => ({
          ...result,
          [className]: options.filter((option) => option.class_name === className),
        }),
        {
          一班: [],
          二班: [],
        },
      ),
    [options],
  );
  const [selectedClass, setSelectedClass] = useState<ClassName>(() =>
    resolveInitialClass(initialClassName, options),
  );
  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const dateOptions = groupedOptions[selectedClass];

  useEffect(() => {
    if (dateOptions.some((option) => option.session_date === selectedDate)) {
      return;
    }

    setSelectedDate(dateOptions[0]?.session_date ?? "");
  }, [dateOptions, selectedClass, selectedDate]);

  return (
    <form method="get" className="mt-6 grid gap-4 md:grid-cols-2">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink">班级</span>
        <select
          name="session_class"
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
        <span className="text-sm font-medium text-ink">日期</span>
        <select
          name="session_date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          disabled={dateOptions.length === 0}
          className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {dateOptions.length === 0 ? <option value="">当前班级暂无签到日期</option> : null}
          {dateOptions.map((option) => (
            <option key={`${option.class_name}-${option.session_date}`} value={option.session_date}>
              {option.session_date}
            </option>
          ))}
        </select>
      </label>

      {studentId ? <input type="hidden" name="student_id" value={studentId} /> : null}
      {studentClass ? <input type="hidden" name="student_class" value={studentClass} /> : null}

      <button
        type="submit"
        disabled={!selectedDate}
        className="md:col-span-2 inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-4 text-base font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        查询场次统计
      </button>
    </form>
  );
}
