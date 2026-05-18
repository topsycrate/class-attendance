import { redirect } from "next/navigation";
import { CLASS_OPTIONS } from "@/lib/constants";
import { getCurrentActiveSession } from "@/lib/actions";

interface AdminSessionPageProps {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
}

export default async function AdminSessionPage({ searchParams }: AdminSessionPageProps) {
  const params = await searchParams;
  const activeSession = await getCurrentActiveSession();

  if (activeSession) {
    redirect(`/admin/session/${activeSession.id}`);
  }

  return (
    <div className="space-y-4">
      {params.message ? (
        <div className="rounded-lg bg-mint px-4 py-3 text-sm font-semibold text-ink">{params.message}</div>
      ) : null}
      {params.error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{params.error}</div>
      ) : null}

      <section className="rounded-lg bg-sidebar p-4 text-white shadow-card md:mx-auto md:max-w-xl md:p-6">
        <div className="space-y-2">
          <p className="text-sm font-extrabold text-mint">发布签到</p>
          <h2 className="text-3xl font-black tracking-tight">开始新的签到场次</h2>
          <p className="text-sm font-semibold leading-6 text-slate-300">
            创建后会直接进入当前签到页，学生扫码即可自动签到。
          </p>
        </div>

        <form action="/api/admin/sessions" method="post" className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-extrabold text-slate-300">班级</span>
            <select
              name="class_name"
              defaultValue="一班"
              className="w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-base font-extrabold text-white outline-none transition focus:border-mint"
            >
              {CLASS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-extrabold text-slate-300">签到时长（分钟）</span>
            <input
              type="number"
              name="duration_minutes"
              min={1}
              max={240}
              defaultValue={15}
              className="w-full rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-base font-extrabold text-white outline-none transition focus:border-mint"
              required
            />
          </label>

          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-lg bg-accent px-4 py-4 text-base font-extrabold text-white transition hover:bg-accent/90"
          >
            创建并进入当前签到
          </button>
        </form>
      </section>
    </div>
  );
}
