import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import DatabaseConstructor from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bindStudentDevice,
  createAttendanceSession,
  deleteStudent,
  exportAllAttendanceCsv,
  exportSessionAttendanceCsv,
  getCurrentActiveSession,
  getHistoricalSessionsData,
  getLiveSessionData,
  getPublicCurrentSession,
  getStudentAuthStatus,
  getStudentsManagementData,
  getSessionStats,
  getSignContext,
  getStudentStats,
  importStudentsFromText,
  loginStudent,
  markStudentOnLeave,
  markStudentSignedManually,
  resetStudentBinding,
  resetStudentPin,
  setupStudentPin,
  verifyAndSign,
} from "@/lib/actions";
import { getDb, resetDatabaseForTests } from "@/lib/db";

describe("sqlite actions", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attendance-sqlite-"));
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

  it("initializes the sqlite schema on first open", () => {
    const tables = (
      getDb()
        .prepare(
          `SELECT name
           FROM sqlite_master
           WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        )
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    expect(tables).toEqual([
      "attendance_records",
      "attendance_sessions",
      "device_bindings",
      "students",
    ]);

    const studentColumns = (
      getDb()
        .prepare(`PRAGMA table_info(students)`)
        .all() as Array<{ name: string }>
    ).map((column) => column.name);
    const bindingColumns = (
      getDb()
        .prepare(`PRAGMA table_info(device_bindings)`)
        .all() as Array<{ name: string }>
    ).map((column) => column.name);

    expect(studentColumns).toEqual(
      expect.arrayContaining(["pin_hash", "pin_set_at", "created_at"]),
    );
    expect(bindingColumns).toEqual(
      expect.arrayContaining(["updated_at", "created_at", "device_id"]),
    );
  });

  it("migrates legacy attendance records into snapshot-based history", () => {
    const databasePath = process.env.DATABASE_PATH!;
    const legacyDb = new DatabaseConstructor(databasePath);

    legacyDb.pragma("foreign_keys = ON");
    legacyDb.exec(`
      CREATE TABLE students (
        id TEXT PRIMARY KEY,
        email TEXT,
        student_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        class_name TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE device_bindings (
        id TEXT PRIMARY KEY,
        student_ref TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
        device_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE attendance_sessions (
        id TEXT PRIMARY KEY,
        class_name TEXT NOT NULL,
        course_name TEXT NOT NULL DEFAULT '英语听力',
        session_date TEXT NOT NULL,
        sign_code TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 15,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closed')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE attendance_records (
        id TEXT PRIMARY KEY,
        session_ref TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        student_ref TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        sign_time TEXT NOT NULL,
        device_id TEXT NOT NULL,
        UNIQUE(session_ref, student_ref)
      );
    `);
    legacyDb
      .prepare(
        `INSERT INTO students (id, email, student_id, name, class_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "student-1",
        "zs@example.com",
        "2026001",
        "张三",
        "一班",
        "2026-04-01T00:00:00.000Z",
      );
    legacyDb
      .prepare(
        `INSERT INTO attendance_sessions (
           id, class_name, course_name, session_date, sign_code, duration_minutes, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "session-1",
        "一班",
        "英语听力",
        "2026-04-01",
        "1234",
        15,
        "closed",
        "2026-04-01T00:00:00.000Z",
      );
    legacyDb
      .prepare(
        `INSERT INTO attendance_records (id, session_ref, student_ref, sign_time, device_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        "record-1",
        "session-1",
        "student-1",
        "2026-04-01T00:05:00.000Z",
        "device-a",
      );
    legacyDb.close();

    resetDatabaseForTests();

    const migratedRecord = getDb()
      .prepare(
        `SELECT
           student_ref,
           student_id_snapshot,
           student_name_snapshot,
           student_class_name_snapshot
         FROM attendance_records
         WHERE id = 'record-1'`,
      )
      .get() as {
      student_ref: string | null;
      student_id_snapshot: string;
      student_name_snapshot: string;
      student_class_name_snapshot: string | null;
    };
    const foreignKeys = getDb()
      .prepare(`PRAGMA foreign_key_list(attendance_records)`)
      .all() as Array<{ from: string; on_delete: string }>;

    expect(migratedRecord).toEqual({
      student_ref: "student-1",
      student_id_snapshot: "2026001",
      student_name_snapshot: "张三",
      student_class_name_snapshot: "一班",
    });
    expect(foreignKeys.find((key) => key.from === "student_ref")?.on_delete).toBe("SET NULL");
  });

  it("tracks inserted, updated, invalid, and error rows during import", async () => {
    const result = await importStudentsFromText(
      [
        "2026001,张三,一班,zs@example.com",
        "2026002,李四,三班",
        "2026001,张三丰,二班,new@example.com",
        "2026003",
      ].join("\n"),
    );

    expect(result).toEqual({
      inserted: 1,
      updated: 1,
      invalid: 1,
      total: 4,
      errors: ["第 2 行班级无效"],
    });

    const students = getDb()
      .prepare(
        `SELECT student_id, name, class_name, email
         FROM students
         ORDER BY student_id`,
      )
      .all() as Array<{
      student_id: string;
      name: string;
      class_name: string | null;
      email: string | null;
    }>;

    expect(students).toEqual([
      {
        student_id: "2026001",
        name: "张三丰",
        class_name: "二班",
        email: "new@example.com",
      },
    ]);
  });

  it("does not enforce device binding in the legacy bind flow", async () => {
    await importStudentsFromText(["2026001,张三,一班", "2026002,李四,一班"].join("\n"));

    const firstBinding = await bindStudentDevice({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      device_id: "device-a",
    });
    const sameDevice = await bindStudentDevice({
      student_id: "2026002",
      name: "李四",
      class_name: "一班",
      device_id: "device-a",
    });
    const sameStudent = await bindStudentDevice({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      device_id: "device-b",
    });
    const bindingCount = getDb()
      .prepare("SELECT COUNT(*) AS total FROM device_bindings")
      .get() as { total: number };

    expect(firstBinding).toMatchObject({ success: true });
    expect(sameDevice).toMatchObject({ success: true });
    expect(sameStudent).toMatchObject({ success: true });
    expect(bindingCount.total).toBe(0);
  });

  it("sets a PIN, persists student auth state, and can reset the PIN later", async () => {
    await importStudentsFromText("2026001,张三,一班");

    const setupResult = await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });

    expect(setupResult).toMatchObject({
      success: true,
      message: "设置 PIN 成功，已登录",
      deviceRestricted: false,
      student: {
        student_id: "2026001",
        name: "张三",
        class_name: "一班",
      },
    });
    expect(setupResult).not.toHaveProperty("boundDeviceId");

    const studentRow = getDb()
      .prepare(
        `SELECT id, pin_hash, pin_set_at
         FROM students
         WHERE student_id = '2026001'
         LIMIT 1`,
      )
      .get() as { id: string; pin_hash: string | null; pin_set_at: string | null };
    const authStatus = await getStudentAuthStatus({
      student_id: studentRow.id,
      device_id: "device-a",
    });
    const loginResult = await loginStudent({
      student_id: "2026001",
      pin: "1234",
      device_id: "device-a",
    });
    const resetResult = await resetStudentPin(studentRow.id);
    const loginAfterReset = await loginStudent({
      student_id: "2026001",
      pin: "1234",
      device_id: "device-a",
    });
    const bindingCount = getDb()
      .prepare("SELECT COUNT(*) AS total FROM device_bindings")
      .get() as { total: number };

    expect(studentRow.pin_hash).toBeTruthy();
    expect(studentRow.pin_set_at).toBeTruthy();
    expect(authStatus).toMatchObject({
      authenticated: true,
      deviceRestricted: false,
      student: {
        student_id: "2026001",
      },
    });
    expect(authStatus).not.toHaveProperty("boundDeviceId");
    expect(loginResult).toMatchObject({
      success: true,
      message: "登录成功",
      deviceRestricted: false,
    });
    expect(loginResult).not.toHaveProperty("boundDeviceId");
    expect(bindingCount.total).toBe(0);
    expect(resetResult.hadPin).toBe(true);
    expect(loginAfterReset).toEqual({
      success: false,
      code: "PIN_NOT_SET",
      message: "该账号尚未设置 PIN，请先完成首次设置",
    });
  });

  it("allows multiple students to set PINs from the same device", async () => {
    await importStudentsFromText(["2026001,张三,一班", "2026002,李四,一班"].join("\n"));
    await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });

    const conflictResult = await setupStudentPin({
      student_id: "2026002",
      name: "李四",
      class_name: "一班",
      pin: "5678",
      device_id: "device-a",
    });
    const loginResult = await loginStudent({
      student_id: "2026002",
      pin: "5678",
      device_id: "device-a",
    });
    const liSiRow = getDb()
      .prepare(
        `SELECT pin_hash, pin_set_at
         FROM students
         WHERE student_id = '2026002'
         LIMIT 1`,
      )
      .get() as { pin_hash: string | null; pin_set_at: string | null };

    expect(conflictResult).toMatchObject({
      success: true,
      deviceRestricted: false,
    });
    expect(loginResult).toMatchObject({
      success: true,
      deviceRestricted: false,
    });
    expect(liSiRow.pin_hash).toBeTruthy();
    expect(liSiRow.pin_set_at).toBeTruthy();
  });

  it("allows students to use a different device without a rebind lock", async () => {
    await importStudentsFromText("2026001,张三,一班");

    const setupResult = await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });
    const studentId = setupResult.success ? setupResult.student.id : "";
    const session = await createAttendanceSession({
      class_name: "一班",
      sign_code: "1234",
      duration_minutes: 15,
    });
    const lockedStatus = await getStudentAuthStatus({
      student_id: studentId,
      device_id: "device-b",
    });
    const lockedContext = await getSignContext({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-b",
    });
    const loginResult = await loginStudent({
      student_id: "2026001",
      pin: "1234",
      device_id: "device-b",
    });
    const reboundContext = await getSignContext({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-b",
    });
    const signResult = await verifyAndSign({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-b",
    });
    const bindingCount = getDb()
      .prepare("SELECT COUNT(*) AS total FROM device_bindings")
      .get() as { total: number };

    expect(lockedStatus).toMatchObject({
      authenticated: true,
      deviceRestricted: false,
    });
    expect(lockedStatus).not.toHaveProperty("boundDeviceId");
    expect(lockedContext).toMatchObject({
      success: true,
      status: "ready",
      studentName: "张三",
    });
    expect(loginResult).toMatchObject({
      success: true,
      message: "登录成功",
      deviceRestricted: false,
    });
    expect(loginResult).not.toHaveProperty("boundDeviceId");
    expect(reboundContext).toMatchObject({
      success: true,
      status: "ready",
      studentName: "张三",
    });
    expect(signResult).toMatchObject({
      success: true,
      status: "success",
      studentName: "张三",
    });
    expect(bindingCount.total).toBe(0);
  });

  it("keeps scan sign-in idempotent and exposes ready context before the first sign", async () => {
    await importStudentsFromText("2026001,张三,一班");
    const setupResult = await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });
    const studentId = setupResult.success ? setupResult.student.id : "";

    const session = await createAttendanceSession({
      class_name: "一班",
      duration_minutes: 15,
    });

    const context = await getSignContext({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-a",
    });
    const firstSign = await verifyAndSign({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-a",
    });
    const secondSign = await verifyAndSign({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-a",
    });

    expect(context).toEqual({
      success: true,
      status: "ready",
      studentName: "张三",
      className: "一班",
      courseName: "英语听力",
      sessionDate: session.session_date,
      sessionStatus: "active",
    });
    expect(firstSign).toMatchObject({
      success: true,
      status: "success",
    });

    if (!firstSign.success) {
      throw new Error("expected first sign-in to succeed");
    }

    expect(secondSign).toEqual({
      success: true,
      status: "already_signed",
      studentName: "张三",
      signTime: firstSign.signTime,
      message: "你已完成签到",
    });
  });

  it("rejects signing multiple students from the same device in one session", async () => {
    await importStudentsFromText(["2026001,张三,一班", "2026002,李四,一班"].join("\n"));
    const zhangSanSetup = await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });
    const liSiSetup = await setupStudentPin({
      student_id: "2026002",
      name: "李四",
      class_name: "一班",
      pin: "5678",
      device_id: "device-a",
    });
    const zhangSanId = zhangSanSetup.success ? zhangSanSetup.student.id : "";
    const liSiId = liSiSetup.success ? liSiSetup.student.id : "";
    const session = await createAttendanceSession({
      class_name: "一班",
      duration_minutes: 15,
    });

    const firstSign = await verifyAndSign({
      session_id: session.id,
      student_id: zhangSanId,
      device_id: "device-a",
    });
    const secondSign = await verifyAndSign({
      session_id: session.id,
      student_id: liSiId,
      device_id: "device-a",
    });
    const recordCount = getDb()
      .prepare("SELECT COUNT(*) AS total FROM attendance_records WHERE session_ref = ?")
      .get(session.id) as { total: number };

    expect(firstSign).toMatchObject({
      success: true,
      status: "success",
      studentName: "张三",
    });
    expect(secondSign).toEqual({
      success: false,
      code: "DEVICE_ALREADY_SIGNED",
      message: "当前设备已完成本场签到，不能重复签到",
    });
    expect(recordCount.total).toBe(1);
  });

  it("auto-closes expired sessions before sign-in", async () => {
    await importStudentsFromText("2026001,张三,一班");
    await bindStudentDevice({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      device_id: "device-a",
    });

    const session = await createAttendanceSession({
      class_name: "一班",
      duration_minutes: 1,
    });

    getDb()
      .prepare(
        `UPDATE attendance_sessions
         SET created_at = ?
         WHERE id = ?`,
      )
      .run("2000-01-01T00:00:00.000Z", session.id);

    const context = await getSignContext({
      session_id: session.id,
      device_id: "device-a",
    });
    const statusRow = getDb()
      .prepare(
        `SELECT status
         FROM attendance_sessions
         WHERE id = ?`,
      )
      .get(session.id) as { status: string };

    expect(context).toEqual({
      success: false,
      code: "SESSION_CLOSED",
      message: "本次签到已结束",
    });
    expect(statusRow.status).toBe("closed");
  });

  it("finds the current active session and stops returning it after expiry", async () => {
    const session = await createAttendanceSession({
      class_name: "一班",
      duration_minutes: 15,
    });

    expect(await getCurrentActiveSession()).toMatchObject({
      id: session.id,
      status: "active",
    });

    getDb()
      .prepare(
        `UPDATE attendance_sessions
         SET created_at = ?
         WHERE id = ?`,
      )
      .run("2000-01-01T00:00:00.000Z", session.id);

    expect(await getCurrentActiveSession()).toBeNull();
  });

  it("exposes the current active session for the public QR page", async () => {
    expect(await getPublicCurrentSession()).toEqual({
      active: false,
    });

    await importStudentsFromText(["2026001,张三,一班", "2026002,李四,一班"].join("\n"));
    const session = await createAttendanceSession({
      class_name: "一班",
      sign_code: "1234",
      duration_minutes: 15,
    });

    expect(await getPublicCurrentSession()).toEqual({
      active: true,
      session: {
        id: session.id,
        class_name: "一班",
        course_name: "英语听力",
        session_date: session.session_date,
        status: "active",
      },
      unsignedCount: 2,
      unsignedStudents: [
        {
          id: expect.any(String),
          name: "张三",
          student_id: "2026001",
        },
        {
          id: expect.any(String),
          name: "李四",
          student_id: "2026002",
        },
      ],
    });
  });

  it("computes session and student statistics from sqlite data", async () => {
    await importStudentsFromText(["2026001,张三,一班", "2026002,李四,一班"].join("\n"));
    const setupResult = await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });
    const studentId = setupResult.success ? setupResult.student.id : "";

    const session = await createAttendanceSession({
      class_name: "一班",
      sign_code: "1234",
      duration_minutes: 15,
    });

    await verifyAndSign({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-a",
    });
    getDb()
      .prepare(
        `UPDATE attendance_sessions
         SET status = 'closed'
         WHERE id = ?`,
      )
      .run(session.id);

    const sessionStats = await getSessionStats({
      date: session.session_date,
      class_name: "一班",
    });
    const studentStats = await getStudentStats({
      student_id: "2026001",
      class_name: "一班",
    });

    expect(sessionStats).toEqual({
      date: session.session_date,
      class_name: "一班",
      total: 2,
      signed: 1,
      leave: 0,
      absent: 1,
      matchedSessions: 1,
      signedStudents: [
        {
          id: expect.any(String),
          name: "张三",
          student_id: "2026001",
          sign_time: expect.any(String),
        },
      ],
      leaveStudents: [],
      absentStudents: [
        {
          id: expect.any(String),
          name: "李四",
          student_id: "2026002",
        },
      ],
    });
    expect(studentStats).toEqual({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      total_sessions: 1,
      present_count: 1,
      absent_count: 0,
      attendance_rate: 1,
    });
  });

  it("marks leave without counting it as absence", async () => {
    await importStudentsFromText(["2026001,张三,一班", "2026002,李四,一班"].join("\n"));
    const setupResult = await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });
    const studentId = setupResult.success ? setupResult.student.id : "";

    const session = await createAttendanceSession({
      class_name: "一班",
      sign_code: "1234",
      duration_minutes: 15,
    });
    const leaveStudentId = (
      getDb()
        .prepare(
          `SELECT id
           FROM students
           WHERE student_id = '2026002'
           LIMIT 1`,
        )
        .get() as { id: string }
    ).id;

    const leaveResult = await markStudentOnLeave({
      session_id: session.id,
      student_id: leaveStudentId,
    });
    const liveDataAfterLeave = await getLiveSessionData(session.id);

    expect(leaveResult.status).toBe("marked");
    expect(liveDataAfterLeave).toMatchObject({
      signedCount: 0,
      leaveCount: 1,
      unsignedCount: 1,
      leaveStudents: [
        {
          name: "李四",
          student_id: "2026002",
          leave_time: expect.any(String),
        },
      ],
    });

    const context = await getSignContext({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-a",
    });
    const signResult = await verifyAndSign({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-a",
    });

    expect(context).toMatchObject({
      success: true,
      status: "ready",
    });
    expect(signResult).toMatchObject({
      success: true,
      status: "success",
    });

    getDb()
      .prepare(
        `UPDATE attendance_sessions
         SET status = 'closed'
         WHERE id = ?`,
      )
      .run(session.id);

    const sessionStats = await getSessionStats({
      date: session.session_date,
      class_name: "一班",
    });

    expect(sessionStats).toEqual({
      date: session.session_date,
      class_name: "一班",
      total: 2,
      signed: 1,
      leave: 1,
      absent: 0,
      matchedSessions: 1,
      signedStudents: [
        {
          id: expect.any(String),
          name: "张三",
          student_id: "2026001",
          sign_time: expect.any(String),
        },
      ],
      leaveStudents: [
        {
          id: expect.any(String),
          name: "李四",
          student_id: "2026002",
          leave_time: expect.any(String),
        },
      ],
      absentStudents: [],
    });
  });

  it("filters students by class and exposes account state ordered by student id", async () => {
    await importStudentsFromText(
      ["2026002,李四,一班", "2026001,张三,一班", "2026003,王五,二班"].join("\n"),
    );
    const setupResult = await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });
    const studentId = setupResult.success ? setupResult.student.id : "";
    const session = await createAttendanceSession({
      class_name: "一班",
      sign_code: "1234",
      duration_minutes: 15,
    });
    await verifyAndSign({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-a",
    });
    getDb()
      .prepare(
        `UPDATE attendance_sessions
         SET status = 'closed'
         WHERE id = ?`,
      )
      .run(session.id);

    const data = await getStudentsManagementData("一班");

    expect(data.total).toBe(3);
    expect(data.filtered_total).toBe(2);
    expect(data.selected_class).toBe("一班");
    expect(data.students.map((student) => student.student_id)).toEqual(["2026001", "2026002"]);
    expect(data.students[0]).toMatchObject({
      name: "张三",
      has_pin: true,
      is_bound: false,
      sign_count: 1,
      absent_count: 0,
      attendance_rate: 1,
    });
    expect(data.students[1]).toMatchObject({
      name: "李四",
      is_bound: false,
      sign_count: 0,
      absent_count: 1,
      attendance_rate: 0,
    });
  });

  it("deletes students while preserving historical attendance without device bindings", async () => {
    await importStudentsFromText("2026001,张三,一班");
    const setupResult = await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });
    const studentId = setupResult.success ? setupResult.student.id : "";
    const session = await createAttendanceSession({
      class_name: "一班",
      sign_code: "1234",
      duration_minutes: 15,
    });
    await verifyAndSign({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-a",
    });

    const studentBeforeDelete = (
      await getStudentsManagementData("一班")
    ).students[0];

    const resetResult = await resetStudentBinding(studentBeforeDelete.id);

    expect(resetResult.hadBinding).toBe(false);
    expect((await getStudentsManagementData("一班")).students[0].is_bound).toBe(false);

    await deleteStudent(studentBeforeDelete.id);

    const remainingStudents = getDb()
      .prepare("SELECT COUNT(*) AS total FROM students")
      .get() as { total: number };
    const remainingBindings = getDb()
      .prepare("SELECT COUNT(*) AS total FROM device_bindings")
      .get() as { total: number };
    const remainingRecords = getDb()
      .prepare("SELECT COUNT(*) AS total FROM attendance_records")
      .get() as { total: number };
    const historicalRecord = getDb()
      .prepare(
        `SELECT student_ref, student_id_snapshot, student_name_snapshot
         FROM attendance_records
         LIMIT 1`,
      )
      .get() as {
      student_ref: string | null;
      student_id_snapshot: string;
      student_name_snapshot: string;
    };
    const sessionStats = await getSessionStats({
      date: session.session_date,
      class_name: "一班",
    });

    expect(remainingStudents.total).toBe(0);
    expect(remainingBindings.total).toBe(0);
    expect(remainingRecords.total).toBe(1);
    expect(historicalRecord).toEqual({
      student_ref: null,
      student_id_snapshot: "2026001",
      student_name_snapshot: "张三",
    });
    expect(sessionStats).toEqual({
      date: session.session_date,
      class_name: "一班",
      total: 1,
      signed: 1,
      leave: 0,
      absent: 0,
      matchedSessions: 1,
      signedStudents: [
        {
          id: expect.any(String),
          name: "张三",
          student_id: "2026001",
          sign_time: expect.any(String),
        },
      ],
      leaveStudents: [],
      absentStudents: [],
    });
  });

  it("lists historical sessions and only exposes signed dates in the filter options", async () => {
    await importStudentsFromText("2026001,张三,一班");
    const setupResult = await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });
    const studentId = setupResult.success ? setupResult.student.id : "";

    const historySession = await createAttendanceSession({
      class_name: "一班",
      sign_code: "1234",
      duration_minutes: 15,
    });
    await verifyAndSign({
      session_id: historySession.id,
      student_id: studentId,
      device_id: "device-a",
    });
    getDb()
      .prepare(
        `UPDATE attendance_sessions
         SET status = 'closed'
         WHERE id = ?`,
      )
      .run(historySession.id);

    const emptyHistorySession = await createAttendanceSession({
      class_name: "二班",
      sign_code: "5678",
      duration_minutes: 15,
    });
    getDb()
      .prepare(
        `UPDATE attendance_sessions
         SET status = 'closed', session_date = ?
         WHERE id = ?`,
      )
      .run("2026-03-31", emptyHistorySession.id);

    const history = await getHistoricalSessionsData();
    const filteredHistory = await getHistoricalSessionsData(historySession.session_date);
    const emptySummary = history.sessions.find((session) => session.id === emptyHistorySession.id);
    const signedSummary = history.sessions.find((session) => session.id === historySession.id);

    expect(history.date_options).toEqual([historySession.session_date]);
    expect(history.sessions).toHaveLength(2);
    expect(emptySummary).toMatchObject({
      id: emptyHistorySession.id,
      class_name: "二班",
      signed_count: 0,
      leave_count: 0,
      absent_count: 0,
    });
    expect(signedSummary).toMatchObject({
      id: historySession.id,
      class_name: "一班",
      signed_count: 1,
      leave_count: 0,
      absent_count: 0,
    });
    expect(filteredHistory.sessions).toHaveLength(1);
    expect(filteredHistory.sessions[0].id).toBe(historySession.id);
  });

  it("exports queried attendance and full attendance as csv", async () => {
    await importStudentsFromText(["2026001,张三,一班", "2026002,李四,一班"].join("\n"));
    const setupResult = await setupStudentPin({
      student_id: "2026001",
      name: "张三",
      class_name: "一班",
      pin: "1234",
      device_id: "device-a",
    });
    const studentId = setupResult.success ? setupResult.student.id : "";
    const session = await createAttendanceSession({
      class_name: "一班",
      sign_code: "1234",
      duration_minutes: 15,
    });
    await verifyAndSign({
      session_id: session.id,
      student_id: studentId,
      device_id: "device-a",
    });
    getDb()
      .prepare(
        `UPDATE attendance_sessions
         SET status = 'closed'
         WHERE id = ?`,
      )
      .run(session.id);

    await deleteStudent(studentId);

    const queryCsv = await exportSessionAttendanceCsv({
      date: session.session_date,
    });
    const allCsv = await exportAllAttendanceCsv();

    expect(queryCsv).toContain("操作时间,日期,班级,课程,签到状态,学号,姓名,设备ID,场次ID,签到记录ID");
    expect(queryCsv).toContain(`${session.session_date},一班,英语听力,已签到,2026001,张三,device-a,`);

    expect(allCsv).toContain("操作时间,日期,班级,课程,签到状态,场次状态,学号,姓名,设备ID,场次ID,签到记录ID");
    expect(allCsv).toContain(`${session.session_date},一班,英语听力,已签到,已结束,2026001,张三,device-a,`);
  });

  it("allows teachers to make up sign-ins for active and closed absences", async () => {
    await importStudentsFromText(["2026001,张三,一班", "2026002,李四,一班"].join("\n"));

    const students = getDb()
      .prepare(
        `SELECT id, student_id
         FROM students
         WHERE class_name = '一班'
         ORDER BY student_id`,
      )
      .all() as Array<{ id: string; student_id: string }>;
    const zhangSanId = students[0]?.id ?? "";
    const liSiId = students[1]?.id ?? "";
    const session = await createAttendanceSession({
      class_name: "一班",
      duration_minutes: 15,
    });

    const activeMakeUp = await markStudentSignedManually({
      session_id: session.id,
      student_id: liSiId,
    });
    const liveData = await getLiveSessionData(session.id);

    expect(activeMakeUp.status).toBe("marked");
    expect(liveData).toMatchObject({
      signedCount: 1,
      unsignedCount: 1,
      signedStudents: [
        {
          name: "李四",
          student_id: "2026002",
          sign_time: expect.any(String),
        },
      ],
    });

    getDb()
      .prepare(
        `UPDATE attendance_sessions
         SET status = 'closed'
         WHERE id = ?`,
      )
      .run(session.id);

    const closedMakeUp = await markStudentSignedManually({
      session_id: session.id,
      student_id: zhangSanId,
    });
    const sessionStats = await getSessionStats({
      date: session.session_date,
      class_name: "一班",
    });

    expect(closedMakeUp.status).toBe("marked");
    expect(sessionStats).toMatchObject({
      signed: 2,
      absent: 0,
      absentStudents: [],
    });
  });
});
