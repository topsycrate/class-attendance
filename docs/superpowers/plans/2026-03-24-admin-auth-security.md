# Admin Auth Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后台认证切换为独立登录会话，移除设备白名单/entry 旁路，并把学生 `device_id` 信任边界收口到同源 cookie。

**Architecture:** 保持现有 Next.js App Router 与 Supabase server-side access 架构不变，把认证判断集中在 `lib/auth.ts` 与后台 route/page，学生设备标识解析集中在 API route 层。浏览器继续保存学生设备 ID，但服务端优先使用 cookie，并要求 Supabase 管理客户端必须拿到服务端密钥。

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase, Vitest

---

### Task 1: 建立测试基线

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/admin-auth.test.ts`
- Create: `tests/device-id-routes.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 写失败测试**

```ts
it("rejects legacy admin-entry access paths", () => {
  expect(hasAdminEntryAccess).toBeUndefined();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run tests/admin-auth.test.ts`
Expected: FAIL，因为测试命令或目标行为尚未存在

- [ ] **Step 3: 补最小测试配置**

```ts
export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: 重新运行测试**

Run: `npm test -- --run tests/admin-auth.test.ts`
Expected: FAIL，且失败原因转为真实业务断言

- [ ] **Step 5: 提交**

```bash
git add package.json vitest.config.ts tests
git commit -m "test: add security regression coverage"
```

### Task 2: 收口后台认证入口

**Files:**
- Modify: `lib/auth.ts`
- Modify: `lib/constants.ts`
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/(protected)/layout.tsx`
- Modify: `app/api/admin/login/route.ts`
- Modify: `app/api/admin/logout/route.ts`
- Modify: `app/api/admin/sessions/route.ts`
- Modify: `app/api/admin/students/import/route.ts`
- Modify: `app/api/admin/sessions/[id]/delete/route.ts`
- Delete: `app/api/admin/entry/route.ts`
- Test: `tests/admin-auth.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
it("redirects unauthenticated admin traffic to /admin/login", async () => {
  const response = await POST(new NextRequest("http://localhost/api/admin/sessions"));
  expect(response.headers.get("location")).toContain("/admin/login");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run tests/admin-auth.test.ts`
Expected: FAIL，当前代码仍允许旧入口或重定向到 `/admin`

- [ ] **Step 3: 写最小实现**

```ts
export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run tests/admin-auth.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/auth.ts lib/constants.ts app/admin app/api/admin tests/admin-auth.test.ts
git commit -m "feat: tighten admin authentication flow"
```

### Task 3: 收口学生 device_id 信任边界

**Files:**
- Modify: `app/api/device/status/route.ts`
- Modify: `app/api/bind/route.ts`
- Modify: `app/api/sign/route.ts`
- Modify: `app/api/sign/session/route.ts`
- Modify: `components/home-status-panel.tsx`
- Modify: `components/sign-flow.tsx`
- Modify: `components/bind-form.tsx`
- Modify: `lib/actions.ts`
- Test: `tests/device-id-routes.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
it("prefers device_id from cookie over query string", async () => {
  const request = new NextRequest("http://localhost/api/device/status?device_id=query-id", {
    headers: { cookie: "attendance_device_id=cookie-id" },
  });
  expect(await GET(request)).toMatchObject({ device_id: "cookie-id" });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run tests/device-id-routes.test.ts`
Expected: FAIL，当前实现优先读取 query/body

- [ ] **Step 3: 写最小实现**

```ts
const deviceId =
  request.cookies.get(DEVICE_ID_COOKIE_NAME)?.value ??
  request.nextUrl.searchParams.get("device_id") ??
  "";
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run tests/device-id-routes.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add app/api components lib/actions.ts tests/device-id-routes.test.ts
git commit -m "feat: trust device cookie for student flows"
```

### Task 4: 更新文档与数据库权限脚本

**Files:**
- Modify: `README.md`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: 写失败检查**

```ts
expect(readme).not.toContain("ADMIN_DEVICE_UUIDS");
```

- [ ] **Step 2: 手动核对当前文档与 SQL**

Run: `rg -n "ADMIN_DEVICE_UUIDS|ADMIN_ENTRY_|disable row level security|grant select, insert" README.md supabase/schema.sql`
Expected: 仍能搜到旧配置/旧权限

- [ ] **Step 3: 写最小实现**

```sql
alter table public.students enable row level security;
revoke all on public.students from anon, authenticated;
```

- [ ] **Step 4: 重新核对**

Run: `rg -n "ADMIN_DEVICE_UUIDS|ADMIN_ENTRY_|disable row level security|grant select, insert" README.md supabase/schema.sql`
Expected: README 中不再包含旧后台旁路；SQL 改为启用 RLS 并移除前端直接写权限

- [ ] **Step 5: 提交**

```bash
git add README.md supabase/schema.sql
git commit -m "docs: document tightened admin and database access"
```
