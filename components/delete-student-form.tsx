"use client";

import { useState } from "react";

interface DeleteStudentFormProps {
  studentId: string;
  classNameFilter?: string;
}

export function DeleteStudentForm({ studentId, classNameFilter }: DeleteStudentFormProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={`/api/admin/students/${studentId}/delete`}
      method="post"
      onSubmit={(event) => {
        if (!window.confirm("确认删除该学生吗？删除后会清除学生档案，但保留历史签到记录。")) {
          event.preventDefault();
          return;
        }

        setSubmitting(true);
      }}
    >
      {classNameFilter ? <input type="hidden" name="class_name" value={classNameFilter} /> : null}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-3 sm:py-2 sm:text-sm"
      >
        {submitting ? "删除中..." : "删除学生"}
      </button>
    </form>
  );
}
