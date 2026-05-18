"use client";

import { useState } from "react";

interface MarkStudentSignedFormProps {
  sessionId: string;
  studentId: string;
}

export function MarkStudentSignedForm({ sessionId, studentId }: MarkStudentSignedFormProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={`/api/admin/sessions/${sessionId}/sign`}
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
        className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-extrabold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "处理中..." : "补签"}
      </button>
    </form>
  );
}
