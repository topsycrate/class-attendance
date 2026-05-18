"use client";

import { useState } from "react";

interface DeleteSessionFormProps {
  sessionId: string;
  redirectPath?: string;
  sessionDateFilter?: string;
  buttonLabel?: string;
}

export function DeleteSessionForm({
  sessionId,
  redirectPath,
  sessionDateFilter,
  buttonLabel,
}: DeleteSessionFormProps) {
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
      {redirectPath ? <input type="hidden" name="redirect_path" value={redirectPath} /> : null}
      {sessionDateFilter ? (
        <input type="hidden" name="session_date" value={sessionDateFilter} />
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-extrabold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "删除中..." : buttonLabel ?? "删除本场签到"}
      </button>
    </form>
  );
}
