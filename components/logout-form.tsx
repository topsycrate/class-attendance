export function LogoutForm() {
  return (
    <form action="/api/admin/logout" method="post">
      <button
        type="submit"
        className="inline-flex items-center rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-paper transition hover:bg-white/15 sm:rounded-2xl sm:px-4 sm:text-sm"
      >
        退出登录
      </button>
    </form>
  );
}
