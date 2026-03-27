export function LogoutForm() {
  return (
    <form action="/api/admin/logout" method="post">
      <button
        type="submit"
        className="inline-flex items-center rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-paper transition hover:bg-white/15"
      >
        退出登录
      </button>
    </form>
  );
}
