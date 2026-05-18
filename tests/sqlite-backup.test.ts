import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bindStudentDevice, getStudentsManagementData, importStudentsFromText } from "@/lib/actions";
import {
  createDatabaseBackupFile,
  resetDatabaseForTests,
  restoreDatabaseBackup,
} from "@/lib/db";

describe("sqlite backup and restore", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attendance-sqlite-backup-"));
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

  it("creates a downloadable backup and restores the prior dataset", async () => {
    await importStudentsFromText(["2026001,张三,一班", "2026002,李四,二班"].join("\n"));
    await bindStudentDevice({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      device_id: "device-a",
    });

    const beforeBackup = await getStudentsManagementData();
    const backup = await createDatabaseBackupFile();

    expect(backup.filename).toMatch(/^attendance-backup-\d{8}-\d{6}\.sqlite$/);
    expect(backup.buffer.subarray(0, 15).toString()).toBe("SQLite format 3");

    await importStudentsFromText("2026003,王五,一班");

    const mutated = await getStudentsManagementData();
    expect(mutated.total).toBe(3);

    const restoreResult = await restoreDatabaseBackup(backup.buffer);
    const restored = await getStudentsManagementData();

    expect(restored).toEqual(beforeBackup);
    expect(restoreResult.rollbackFilename).toMatch(/^attendance-rollback-\d{8}-\d{6}\.sqlite$/);
    expect(fs.existsSync(path.join(tempDir, restoreResult.rollbackFilename))).toBe(true);
  });

  it("rejects invalid backup files without changing current data", async () => {
    await importStudentsFromText("2026001,张三,一班");

    const beforeRestoreAttempt = await getStudentsManagementData();

    await expect(restoreDatabaseBackup(Buffer.from("not a sqlite database"))).rejects.toThrow();

    const afterRestoreAttempt = await getStudentsManagementData();
    expect(afterRestoreAttempt).toEqual(beforeRestoreAttempt);
  });
});
