import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as adminLoginPost } from "@/app/api/admin/login/route";
import { POST as createSessionPost } from "@/app/api/admin/sessions/route";
import { getSupabaseAdmin } from "@/lib/supabase";

const originalEnv = { ...process.env };

describe("admin auth security", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ADMIN_PASSWORD = "top-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "public-key";
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("redirects unauthenticated admin writes to /admin/login", async () => {
    const request = new NextRequest("http://localhost/api/admin/sessions", {
      method: "POST",
    });

    const response = await createSessionPost(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
  });

  it("keeps failed admin login on /admin/login", async () => {
    const formData = new FormData();
    formData.set("password", "wrong-password");

    const response = await adminLoginPost(
      new Request("http://localhost/api/admin/login", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/admin/login?error=%E5%AF%86%E7%A0%81%E9%94%99%E8%AF%AF%EF%BC%8C%E8%AF%B7%E9%87%8D%E6%96%B0%E8%BE%93%E5%85%A5",
    );
  });

  it("requires a server-side supabase key for admin access", () => {
    expect(() => getSupabaseAdmin()).toThrow("缺少 SUPABASE_SECRET_KEY 或 SUPABASE_SERVICE_ROLE_KEY 配置");
  });
});
