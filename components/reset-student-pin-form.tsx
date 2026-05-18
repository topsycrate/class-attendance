"use client";

import { useState } from "react";

interface ResetStudentPinFormProps {
  studentId: string;
  classNameFilter?: string;
  disabled?: boolean;
}

export function ResetStudentPinForm({
  studentId,
  classNameFilter,
  disabled,
}: ResetStudentPinFormProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={`/api/admin/students/${studentId}/reset-pin`}
      method="post"
      onSubmit={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }

        if (!window.confirm("确认重置该学生的 PIN 吗？重置后学生需要重新设置 PIN。")) {
          event.preventDefault();
          return;
        }

        setSubmitting(true);
      }}
    >
      {classNameFilter ? <input type="hidden" name="class_name" value={classNameFilter} /> : null}
      <button
        type="submit"
        disabled={disabled || submitting}
        className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-3 sm:py-2 sm:text-sm"
      >
        {disabled ? "未设 PIN" : submitting ? "重置中..." : "重置 PIN"}
      </button>
    </form>
  );
}
