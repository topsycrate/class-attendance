import { HomeStatusPanel } from "@/components/home-status-panel";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-4 py-6 sm:px-6 md:py-16">
      <div className="grid gap-5 rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur sm:p-8 md:grid-cols-[1.2fr_0.8fr] md:p-12">
        <section className="space-y-5">
          <span className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-4 py-1 text-sm font-medium text-accent">
            英语听力签到系统
          </span>
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl md:text-5xl">
              课堂签到
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-ink/75 sm:text-base md:text-lg">
              查看右侧信息。未绑定先绑定，已绑定直接扫码签到。
            </p>
          </div>
        </section>
        <HomeStatusPanel />
      </div>
    </main>
  );
}
