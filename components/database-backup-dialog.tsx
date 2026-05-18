"use client";

import { useRef, useState } from "react";

export function DatabaseBackupDialog() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-paper"
      >
        备份与恢复
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-2xl rounded-[2rem] p-0 shadow-card backdrop:bg-ink/35"
      >
        <div className="rounded-[2rem] bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-accent">数据维护</p>
              <h2 className="mt-2 text-2xl font-bold text-ink">备份与恢复签到数据</h2>
              <p className="mt-2 text-sm text-ink/65">
                备份会下载当前 SQLite 数据库。恢复会覆盖当前数据，请只加载你确认无误的备份文件。
              </p>
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

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <section className="rounded-[1.5rem] border border-line bg-paper p-5">
              <p className="text-sm font-medium text-accent">下载备份</p>
              <h3 className="mt-2 text-xl font-bold text-ink">保存当前签到数据</h3>
              <p className="mt-2 text-sm text-ink/65">
                下载的文件是完整 SQLite 备份，可用于后续恢复到当前系统。
              </p>
              <a
                href="/api/admin/backups/download"
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
              >
                下载当前备份
              </a>
            </section>

            <section className="rounded-[1.5rem] border border-red-100 bg-red-50/50 p-5">
              <p className="text-sm font-medium text-red-600">加载备份</p>
              <h3 className="mt-2 text-xl font-bold text-ink">覆盖当前数据库</h3>
              <p className="mt-2 text-sm text-ink/65">
                系统会先自动保存一份恢复前快照，但加载后的数据会立即替换当前签到记录。
              </p>

              <form
                action="/api/admin/backups/restore"
                method="post"
                encType="multipart/form-data"
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  if (
                    !window.confirm("确认加载这个备份吗？当前签到数据会被覆盖，系统会先自动保存恢复前快照。")
                  ) {
                    event.preventDefault();
                    return;
                  }

                  setSubmitting(true);
                }}
              >
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink">选择备份文件</span>
                  <input
                    type="file"
                    name="backup_file"
                    accept=".sqlite,.sqlite3,.db,.backup"
                    required
                    className="block w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink file:mr-4 file:rounded-xl file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                  />
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    required
                    className="mt-1 h-4 w-4 rounded border-line text-ink"
                  />
                  <span>我确认要用该备份覆盖当前签到数据。</span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-red-200 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "加载中..." : "加载备份并覆盖当前数据"}
                </button>
              </form>
            </section>
          </div>
        </div>
      </dialog>
    </>
  );
}
