import { describe, expect, it } from "vitest";
import { formatDatabaseError } from "@/lib/db";

describe("formatDatabaseError", () => {
  it("maps unique constraint errors to the duplicate-data message", () => {
    expect(
      formatDatabaseError({
        code: "SQLITE_CONSTRAINT_UNIQUE",
        message: "UNIQUE constraint failed: students.student_id",
      }),
    ).toBe("数据已存在，不能重复提交");
  });

  it("returns plain error messages for other failures", () => {
    expect(formatDatabaseError(new Error("数据库忙，请稍后重试"))).toBe("数据库忙，请稍后重试");
  });
});
