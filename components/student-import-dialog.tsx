"use client";

import { useRef } from "react";

interface StudentImportDialogProps {
  defaultValue: string;
}

export function StudentImportDialog({ defaultValue }: StudentImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
      >
        导入学生
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-2xl rounded-[2rem] p-0 shadow-card backdrop:bg-ink/35"
      >
        <div className="rounded-[2rem] bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-accent">学生导入</p>
              <h2 className="mt-2 text-2xl font-bold text-ink">粘贴学生名单</h2>
            </div>
            <form method="dialog">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:bg-white"
              >
                关闭
              </button>
            </form>
          </div>

          <form action="/api/admin/students/import" method="post" className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">格式</span>
              <textarea
                name="students_text"
                rows={14}
                defaultValue={defaultValue}
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
        </div>
      </dialog>
    </>
  );
}
