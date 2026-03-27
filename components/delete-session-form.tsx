"use client";

import { useState } from "react";

interface DeleteSessionFormProps {
  sessionId: string;
}

export function DeleteSessionForm({ sessionId }: DeleteSessionFormProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={`/api/admin/sessions/${sessionId}/delete`}
      method="post"
      onSubmit={(event) => {
        if (!window.confirm("确认删除当前签到场次吗？")) {
          event.preventDefault();
          return;
        }

        setSubmitting(true);
      }}
    >
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "删除中..." : "删除本场签到"}
      </button>
    </form>
  );
}
