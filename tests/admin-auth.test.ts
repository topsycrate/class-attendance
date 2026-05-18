import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createAttendanceSession } from "@/lib/actions";
import { POST as adminLoginPost } from "@/app/api/admin/login/route";
import { POST as createSessionPost } from "@/app/api/admin/sessions/route";
import { resetDatabaseForTests } from "@/lib/db";

const originalEnv = { ...process.env };

describe("admin auth security", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attendance-admin-auth-"));
    process.env = { ...originalEnv };
    process.env.ADMIN_PASSWORD = "top-secret";
    process.env.DATABASE_PATH = path.join(tempDir, "attendance.sqlite");
    resetDatabaseForTests();
  });

  afterEach(() => {
    resetDatabaseForTests();
    delete process.env.DATABASE_PATH;

    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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

  it("redirects successful admin login to the active session when one exists", async () => {
    const session = await createAttendanceSession({
      class_name: "一班",
      sign_code: "1234",
      duration_minutes: 15,
    });
    const formData = new FormData();
    formData.set("password", "top-secret");

    const response = await adminLoginPost(
      new Request("http://localhost/api/admin/login", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`http://localhost/admin/session/${session.id}`);
  });

  it("uses forwarded host headers for admin login redirects behind a reverse proxy", async () => {
    const formData = new FormData();
    formData.set("password", "top-secret");

    const response = await adminLoginPost(
      new Request("http://0.0.0.0:3000/api/admin/login", {
        method: "POST",
        body: formData,
        headers: {
          host: "0.0.0.0:3000",
          "x-forwarded-host": "sign.eisenglish.cn",
          "x-forwarded-proto": "https",
        },
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://sign.eisenglish.cn/admin/session");
  });
});
