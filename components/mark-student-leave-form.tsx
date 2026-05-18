"use client";

import { useState } from "react";

interface MarkStudentLeaveFormProps {
  sessionId: string;
  studentId: string;
}

export function MarkStudentLeaveForm({ sessionId, studentId }: MarkStudentLeaveFormProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={`/api/admin/sessions/${sessionId}/leave`}
      method="post"
      className="w-full md:w-auto"
      onSubmit={() => {
        setSubmitting(true);
      }}
    >
      <input type="hidden" name="student_id" value={studentId} />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-amber-soft px-4 py-2 text-sm font-extrabold text-amber transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "处理中..." : "请假"}
      </button>
    </form>
  );
}
