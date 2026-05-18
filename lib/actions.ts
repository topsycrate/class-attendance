import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import {
  CLASS_OPTIONS,
  COURSE_NAME,
  STUDENT_PIN_MAX_LENGTH,
  STUDENT_PIN_MIN_LENGTH,
} from "@/lib/constants";
import { getDb, isUniqueConstraintError } from "@/lib/db";
import { formatChinaDateTime, getChinaDateString, getSessionExpireAt } from "@/lib/time";
import type {
  AttendanceStatus,
  AttendanceRecord,
  AttendanceSessionRecord,
  BindResult,
  ClassName,
  DeviceStatusData,
  DeviceBindingRecord,
  HistoricalSessionSummary,
  HistoricalSessionsData,
  LeaveStudentView,
  PublicCurrentSessionResult,
  SessionDateOption,
  SessionLiveData,
  SessionStatsData,
  SignContextResult,
  StudentAuthResult,
  StudentAuthStudent,
  StudentAuthStatusResult,
  StudentLoginResult,
  StudentImportResult,
  StudentListFilter,
  StudentManagementItem,
  StudentOption,
  StudentPinSetupResult,
  StudentRecord,
  StudentStatsData,
  StudentsManagementData,
  StudentsOverviewData,
  VerifySignResult,
} from "@/lib/types";

interface StudentRow {
  id: string;
  email: string | null;
  student_id: string;
  name: string;
  class_name: string | null;
  pin_hash: string | null;
  pin_set_at: string | null;
}

interface SessionRow {
  id: string;
  class_name: string;
  course_name: string;
  session_date: string;
  sign_code: string;
  created_at: string;
  duration_minutes: number;
  status: string;
}

interface StudentJoinColumns {
  student_record_id: string | null;
  student_email: string | null;
  student_student_id: string | null;
  student_name: string | null;
  student_class_name: string | null;
}

interface AttendanceSnapshotColumns {
  student_snapshot_student_id: string;
  student_snapshot_name: string;
  student_snapshot_class_name: string | null;
}

interface BindingRow extends StudentJoinColumns {
  id: string;
  student_ref: string;
  device_id: string;
  updated_at: string;
  created_at: string;
}

interface AttendanceRow extends StudentJoinColumns, AttendanceSnapshotColumns {
  id: string;
  session_ref: string;
  student_ref: string | null;
  status: AttendanceStatus;
  sign_time: string;
  device_id: string;
}

interface ManagedStudentRow extends StudentRow {
  binding_id: string | null;
  binding_device_id: string | null;
  binding_created_at: string | null;
  binding_updated_at: string | null;
  sign_count?: number | null;
  leave_count?: number | null;
  total_sessions?: number | null;
}

type StudentAuthErrorResult = Extract<StudentAuthResult, { success: false }>;

type ResolveSigningContextResult =
  | {
      kind: "error";
      result: Extract<SignContextResult, { success: false }>;
    }
  | {
      kind: "already_signed";
      session: AttendanceSessionRecord;
      student: StudentRecord;
      record: AttendanceRecord;
    }
  | {
      kind: "ready";
      session: AttendanceSessionRecord;
      student: StudentRecord;
    };

const ATTENDANCE_SELECT_COLUMNS = `
         r.id,
         r.session_ref,
         r.student_ref,
         r.status,
         r.sign_time,
         r.device_id,
         s.id AS student_record_id,
         s.email AS student_email,
         s.student_id AS student_student_id,
         s.name AS student_name,
         s.class_name AS student_class_name,
         r.student_id_snapshot AS student_snapshot_student_id,
         r.student_name_snapshot AS student_snapshot_name,
         r.student_class_name_snapshot AS student_snapshot_class_name
`;

function toAttendanceStatus(value: string | null | undefined): AttendanceStatus {
  return value === "leave" ? "leave" : "signed";
}

function isClassName(value: string): value is ClassName {
  return (CLASS_OPTIONS as readonly string[]).includes(value);
}

function normalizeText(value: string) {
  return value.trim();
}

function normalizeStudentListFilter(value?: string): StudentListFilter {
  const normalized = normalizeText(value ?? "");
  return isClassName(normalized) ? normalized : "all";
}

function normalizeSessionDateFilter(value?: string) {
  const normalized = normalizeText(value ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function isPinCode(value: string) {
  return new RegExp(`^\\d{${STUDENT_PIN_MIN_LENGTH},${STUDENT_PIN_MAX_LENGTH}}$`).test(value);
}

function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPin(pin: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(pin, salt, 64).toString("hex");

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
}

export function generateRandomSignCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function splitStudentLine(line: string) {
  if (line.includes("\t")) {
    return line.split("\t").map((item) => item.trim());
  }

  return line
    .split(/[,\uff0c]/)
    .map((item) => item.trim());
}

function mapStudent(row: StudentRow): StudentRecord {
  return {
    id: row.id,
    email: row.email ?? undefined,
    student_id: row.student_id,
    name: row.name,
    class_name: row.class_name ?? "",
    has_pin: Boolean(row.pin_hash),
    pin_set_at: row.pin_set_at ?? undefined,
  };
}

function mapSession(row: SessionRow): AttendanceSessionRecord {
  return {
    id: row.id,
    class_name: row.class_name as ClassName,
    course_name: row.course_name,
    session_date: row.session_date,
    sign_code: row.sign_code,
    created_at: row.created_at,
    duration_minutes: Number(row.duration_minutes ?? 0),
    status: String(row.status ?? "closed") as AttendanceSessionRecord["status"],
  };
}

function mapJoinedStudent(row: StudentJoinColumns): StudentRecord | null {
  if (!row.student_record_id) {
    return null;
  }

  return {
    id: row.student_record_id,
    email: row.student_email ?? undefined,
    student_id: row.student_student_id ?? "",
    name: row.student_name ?? "",
    class_name: row.student_class_name ?? "",
  };
}

function mapAttendanceStudent(row: AttendanceRow): StudentRecord | null {
  const joinedStudent = mapJoinedStudent(row);

  if (joinedStudent) {
    return joinedStudent;
  }

  if (!row.student_snapshot_student_id || !row.student_snapshot_name) {
    return null;
  }

  return {
    id: row.student_ref ?? `archived:${row.id}`,
    student_id: row.student_snapshot_student_id,
    name: row.student_snapshot_name,
    class_name: row.student_snapshot_class_name ?? "",
  };
}

function mapBinding(row: BindingRow): DeviceBindingRecord {
  return {
    id: row.id,
    student_ref: row.student_ref,
    device_id: row.device_id,
    updated_at: row.updated_at,
    created_at: row.created_at,
    student: mapJoinedStudent(row),
  };
}

function mapManagedStudent(row: ManagedStudentRow): StudentManagementItem {
  const signCount = Number(row.sign_count ?? 0);
  const leaveCount = Number(row.leave_count ?? 0);
  const totalSessions = Number(row.total_sessions ?? 0);
  const absentCount = Math.max(totalSessions - signCount - leaveCount, 0);
  const attendanceDenominator = Math.max(totalSessions - leaveCount, 0);

  return {
    id: row.id,
    student_id: row.student_id,
    name: row.name,
    class_name: row.class_name ?? "",
    email: row.email ?? undefined,
    has_pin: Boolean(row.pin_hash),
    pin_set_at: row.pin_set_at ?? undefined,
    is_bound: Boolean(row.binding_id),
    device_id: row.binding_device_id ?? undefined,
    binding_created_at: row.binding_created_at ?? undefined,
    binding_updated_at: row.binding_updated_at ?? undefined,
    sign_count: signCount,
    absent_count: absentCount,
    attendance_rate: attendanceDenominator > 0 ? signCount / attendanceDenominator : 0,
  };
}

function mapAttendance(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    session_ref: row.session_ref,
    student_ref: row.student_ref ?? null,
    sign_time: row.sign_time,
    device_id: row.device_id,
    status: toAttendanceStatus(row.status),
    student: mapAttendanceStudent(row),
    session: null,
  };
}

function toStudentAuthStudent(student: StudentRecord): StudentAuthStudent {
  return {
    id: student.id,
    student_id: student.student_id,
    name: student.name,
    class_name: student.class_name,
  };
}

function getStudentRowByStudentId(studentId: string) {
  return getDb()
    .prepare(
      `SELECT id, email, student_id, name, class_name, pin_hash, pin_set_at
       FROM students
       WHERE student_id = ?
       LIMIT 1`,
    )
    .get(studentId) as StudentRow | undefined;
}

function getStudentRowById(studentRecordId: string) {
  return getDb()
    .prepare(
      `SELECT id, email, student_id, name, class_name, pin_hash, pin_set_at
       FROM students
       WHERE id = ?
       LIMIT 1`,
    )
    .get(studentRecordId) as StudentRow | undefined;
}

function getStudentByMatch(studentId: string, name: string) {
  const row = getDb()
    .prepare(
      `SELECT id, email, student_id, name, class_name, pin_hash, pin_set_at
       FROM students
       WHERE student_id = ? AND name = ?
       LIMIT 1`,
    )
    .get(studentId, name) as StudentRow | undefined;

  return row ? mapStudent(row) : null;
}

function getStudentByStudentId(studentId: string) {
  const row = getStudentRowByStudentId(studentId);

  return row ? mapStudent(row) : null;
}

function getStudentById(studentRecordId: string) {
  const row = getStudentRowById(studentRecordId);

  return row ? mapStudent(row) : null;
}

function getBindingByStudentRef(studentRef: string) {
  const row = getDb()
    .prepare(
      `SELECT
         b.id,
         b.student_ref,
         b.device_id,
         b.updated_at,
         b.created_at,
         s.id AS student_record_id,
         s.email AS student_email,
         s.student_id AS student_student_id,
         s.name AS student_name,
         s.class_name AS student_class_name
       FROM device_bindings b
       LEFT JOIN students s ON s.id = b.student_ref
       WHERE b.student_ref = ?
       LIMIT 1`,
    )
    .get(studentRef) as BindingRow | undefined;

  return row ? mapBinding(row) : null;
}

function getBindingByDeviceId(deviceId: string) {
  const row = getDb()
    .prepare(
      `SELECT
         b.id,
         b.student_ref,
         b.device_id,
         b.updated_at,
         b.created_at,
         s.id AS student_record_id,
         s.email AS student_email,
         s.student_id AS student_student_id,
         s.name AS student_name,
         s.class_name AS student_class_name
       FROM device_bindings b
       LEFT JOIN students s ON s.id = b.student_ref
       WHERE b.device_id = ?
       LIMIT 1`,
    )
    .get(deviceId) as BindingRow | undefined;

  return row ? mapBinding(row) : null;
}

function getAttendanceRecord(sessionRef: string, student: Pick<StudentRecord, "id" | "student_id">) {
  const row = getDb()
    .prepare(
      `SELECT
${ATTENDANCE_SELECT_COLUMNS}
       FROM attendance_records r
       LEFT JOIN students s ON s.id = r.student_ref
       WHERE r.session_ref = ? AND (r.student_ref = ? OR r.student_id_snapshot = ?)
       LIMIT 1`,
    )
    .get(sessionRef, student.id, student.student_id) as AttendanceRow | undefined;

  return row ? mapAttendance(row) : null;
}

function getSignedAttendanceRecordByDevice(sessionRef: string, deviceId: string) {
  const normalizedDeviceId = normalizeText(deviceId);

  if (!normalizedDeviceId) {
    return null;
  }

  const row = getDb()
    .prepare(
      `SELECT
${ATTENDANCE_SELECT_COLUMNS}
       FROM attendance_records r
       LEFT JOIN students s ON s.id = r.student_ref
       WHERE r.session_ref = ? AND r.device_id = ? AND r.status = 'signed'
       LIMIT 1`,
    )
    .get(sessionRef, normalizedDeviceId) as AttendanceRow | undefined;

  return row ? mapAttendance(row) : null;
}

function getSessionById(sessionId: string) {
  const row = getDb()
    .prepare(
      `SELECT id, class_name, course_name, session_date, sign_code, created_at, duration_minutes, status
       FROM attendance_sessions
       WHERE id = ?
       LIMIT 1`,
    )
    .get(sessionId) as SessionRow | undefined;

  return row ? mapSession(row) : null;
}

function syncSessionStatus(session: AttendanceSessionRecord): AttendanceSessionRecord {
  const duration = Number(session.duration_minutes) || 0;

  if (session.status !== "active" || duration <= 0) {
    return session;
  }

  const expireAt = getSessionExpireAt(session.created_at, duration);

  if (expireAt.getTime() > Date.now()) {
    return session;
  }

  getDb()
    .prepare(
      `UPDATE attendance_sessions
       SET status = 'closed'
       WHERE id = ? AND status = 'active'`,
    )
    .run(session.id);

  return {
    ...session,
    status: "closed",
  };
}

function getStudentsByClass(className: string) {
  return (
    getDb()
      .prepare(
        `SELECT id, email, student_id, name, class_name, pin_hash, pin_set_at
         FROM students
         WHERE class_name = ?
         ORDER BY student_id`,
      )
      .all(className) as StudentRow[]
  ).map((row) => mapStudent(row));
}

function getAttendanceRowsForSession(sessionRef: string) {
  return (
    getDb()
      .prepare(
        `SELECT
${ATTENDANCE_SELECT_COLUMNS}
         FROM attendance_records r
         LEFT JOIN students s ON s.id = r.student_ref
         WHERE r.session_ref = ?
         ORDER BY r.sign_time`,
      )
      .all(sessionRef) as AttendanceRow[]
  ).map((row) => mapAttendance(row));
}

function buildSessionLiveBuckets(session: AttendanceSessionRecord) {
  const studentRows = getStudentsByClass(session.class_name);
  const recordRows = getAttendanceRowsForSession(session.id);
  const signedStudents = recordRows
    .flatMap((record) => {
      if (record.status !== "signed" || !record.student) {
        return [];
      }

      return [
        {
          id: record.student.id,
          name: record.student.name,
          student_id: record.student.student_id,
          sign_time: record.sign_time,
        },
      ];
    });
  const leaveStudents = recordRows
    .flatMap((record) => {
      if (record.status !== "leave" || !record.student) {
        return [];
      }

      return [
        {
          id: record.student.id,
          name: record.student.name,
          student_id: record.student.student_id,
          leave_time: record.sign_time,
        },
      ];
    });
  const excludedStudentIds = new Set(
    [...signedStudents, ...leaveStudents].map((student) => student.student_id),
  );
  const unsignedStudents = studentRows
    .filter((student) => !excludedStudentIds.has(student.student_id))
    .map((student) => ({
      id: student.id,
      name: student.name,
      student_id: student.student_id,
    }));

  return {
    signedStudents,
    leaveStudents,
    unsignedStudents,
  };
}

export async function getCurrentActiveSession(): Promise<AttendanceSessionRecord | null> {
  const rows = getDb()
    .prepare(
      `SELECT id, class_name, course_name, session_date, sign_code, created_at, duration_minutes, status
       FROM attendance_sessions
       WHERE status = 'active'
       ORDER BY created_at DESC`,
    )
    .all() as SessionRow[];

  for (const row of rows) {
    const session = syncSessionStatus(mapSession(row));

    if (session.status === "active") {
      return session;
    }
  }

  return null;
}

function buildAuthSuccessResult(
  student: StudentRecord,
  message: string,
): Extract<StudentAuthResult, { success: true }> {
  return {
    success: true,
    message,
    student: toStudentAuthStudent(student),
    deviceRestricted: false,
    hasPin: Boolean(student.has_pin),
    pinSetAt: student.pin_set_at,
  };
}

function getAuthenticatedStudent(studentId: string) {
  const row = getStudentRowById(studentId);

  if (!row || !row.pin_hash) {
    return null;
  }

  return {
    row,
    student: mapStudent(row),
  };
}

function resolveSigningContext(
  sessionId: string,
  options: {
    student_id?: string;
    device_id: string;
  },
): ResolveSigningContextResult {
  const session = getSessionById(sessionId);
  const deviceId = normalizeText(options.device_id);
  const studentId = normalizeText(options.student_id ?? "");

  if (!session) {
    return {
      kind: "error" as const,
      result: {
        success: false as const,
        code: "SESSION_NOT_FOUND",
        message: "签到场次不存在",
      },
    };
  }

  const normalizedSession = syncSessionStatus(session);

  if (normalizedSession.status !== "active") {
    return {
      kind: "error" as const,
      result: {
        success: false as const,
        code: "SESSION_CLOSED",
        message: "本次签到已结束",
      },
    };
  }

  if (!studentId) {
    return {
      kind: "error",
      result: {
        success: false,
        code: "NOT_AUTHENTICATED",
        message: "请先登录学生账号",
      },
    };
  }

  const authenticatedStudent = getAuthenticatedStudent(studentId);

  if (!authenticatedStudent) {
    return {
      kind: "error" as const,
      result: {
        success: false as const,
        code: "NOT_AUTHENTICATED",
        message: "请先登录学生账号",
      },
    };
  }

  const student = authenticatedStudent.student;

  if (!isClassName(student.class_name) || student.class_name !== normalizedSession.class_name) {
    return {
      kind: "error" as const,
      result: {
        success: false as const,
        code: "CLASS_MISMATCH",
        message: "你的班级与当前签到班级不匹配",
      },
    };
  }

  const existingRecord = getAttendanceRecord(normalizedSession.id, student);

  if (existingRecord?.status === "signed") {
    return {
      kind: "already_signed" as const,
      session: normalizedSession,
      student,
      record: existingRecord,
    };
  }

  if (getSignedAttendanceRecordByDevice(normalizedSession.id, deviceId)) {
    return {
      kind: "error" as const,
      result: {
        success: false as const,
        code: "DEVICE_ALREADY_SIGNED",
        message: "当前设备已完成本场签到，不能重复签到",
      },
    };
  }

  return {
    kind: "ready" as const,
    session: normalizedSession,
    student,
  };
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  return text;
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")).join("\r\n");
}

function getStudentAuthErrorResult(code: string, message: string): StudentAuthErrorResult {
  return {
    success: false,
    code,
    message,
  };
}

function getNormalizedPin(pinInput: string) {
  const pin = normalizeText(pinInput);

  if (!pin) {
    return {
      ok: false as const,
      result: getStudentAuthErrorResult("MISSING_PIN", "请输入 PIN 码"),
    };
  }

  if (!isPinCode(pin)) {
    return {
      ok: false as const,
      result: getStudentAuthErrorResult(
        "INVALID_PIN",
        `PIN 码需为 ${STUDENT_PIN_MIN_LENGTH} 到 ${STUDENT_PIN_MAX_LENGTH} 位数字`,
      ),
    };
  }

  return {
    ok: true as const,
    pin,
  };
}

export async function setupStudentPin(input: {
  student_id: string;
  name: string;
  class_name: string;
  pin: string;
  device_id: string;
}): Promise<StudentPinSetupResult> {
  const studentId = normalizeText(input.student_id);
  const name = normalizeText(input.name);
  const className = normalizeText(input.class_name);
  const pinValidation = getNormalizedPin(input.pin);

  if (!studentId || !name || !className) {
    return getStudentAuthErrorResult("INVALID_INPUT", "请完整填写学号、姓名、班级和 PIN 码");
  }

  if (!isClassName(className)) {
    return getStudentAuthErrorResult("INVALID_CLASS", "请选择正确的班级");
  }

  if (!pinValidation.ok) {
    return pinValidation.result;
  }

  const row = getStudentRowByStudentId(studentId);

  if (!row || normalizeText(row.name) !== name) {
    return getStudentAuthErrorResult("STUDENT_NOT_FOUND", "未找到匹配的学生，请检查学号和姓名");
  }

  if (row.class_name && row.class_name !== className) {
    return getStudentAuthErrorResult("CLASS_MISMATCH", "班级信息不匹配，请检查后重试");
  }

  if (row.pin_hash) {
    return getStudentAuthErrorResult("PIN_ALREADY_SET", "该账号已设置 PIN，请直接登录");
  }

  return getDb().transaction((): StudentPinSetupResult => {
    const now = new Date().toISOString();

    getDb()
      .prepare(
        `UPDATE students
         SET class_name = ?, pin_hash = ?, pin_set_at = ?
         WHERE id = ?`,
      )
      .run(className, hashPin(pinValidation.pin), now, row.id);

    const student = getStudentById(row.id);

    if (!student) {
      return getStudentAuthErrorResult("STUDENT_NOT_FOUND", "学生信息不存在");
    }

    return buildAuthSuccessResult(student, "设置 PIN 成功，已登录");
  })();
}

export async function loginStudent(input: {
  student_id: string;
  pin: string;
  device_id: string;
}): Promise<StudentLoginResult> {
  const studentId = normalizeText(input.student_id);
  const pinValidation = getNormalizedPin(input.pin);

  if (!studentId) {
    return getStudentAuthErrorResult("INVALID_INPUT", "请完整填写学号和 PIN 码");
  }

  if (!pinValidation.ok) {
    return pinValidation.result;
  }

  const row = getStudentRowByStudentId(studentId);

  if (!row?.pin_hash) {
    return getStudentAuthErrorResult("PIN_NOT_SET", "该账号尚未设置 PIN，请先完成首次设置");
  }

  if (!verifyPin(pinValidation.pin, row.pin_hash)) {
    return getStudentAuthErrorResult("INVALID_CREDENTIALS", "学号或 PIN 码错误");
  }

  const student = mapStudent(row);

  return buildAuthSuccessResult(student, "登录成功");
}

export async function getStudentAuthStatus(input: {
  student_id?: string | null;
  device_id: string;
}): Promise<StudentAuthStatusResult> {
  const studentId = normalizeText(input.student_id ?? "");
  const deviceId = normalizeText(input.device_id);

  if (!studentId) {
    return {
      authenticated: false,
      device_id: deviceId,
      deviceRestricted: false,
    };
  }

  const authenticatedStudent = getAuthenticatedStudent(studentId);

  if (!authenticatedStudent) {
    return {
      authenticated: false,
      device_id: deviceId,
      deviceRestricted: false,
    };
  }

  return {
    authenticated: true,
    device_id: deviceId,
    deviceRestricted: false,
    hasPin: Boolean(authenticatedStudent.student.has_pin),
    pinSetAt: authenticatedStudent.student.pin_set_at,
    student: toStudentAuthStudent(authenticatedStudent.student),
  };
}

export async function resetStudentPin(studentIdInput: string) {
  const studentId = normalizeText(studentIdInput);

  if (!studentId) {
    throw new Error("缺少学生信息");
  }

  const student = getStudentById(studentId);

  if (!student) {
    throw new Error("学生不存在");
  }

  const hadPin = Boolean(student.has_pin);

  getDb()
    .prepare(
      `UPDATE students
       SET pin_hash = NULL, pin_set_at = NULL
       WHERE id = ?`,
    )
    .run(student.id);

  return {
    student,
    hadPin,
  };
}

export async function getPublicCurrentSession(): Promise<PublicCurrentSessionResult> {
  const session = await getCurrentActiveSession();

  if (!session) {
    return {
      active: false,
    };
  }

  const { unsignedStudents } = buildSessionLiveBuckets(session);

  return {
    active: true,
    session: {
      id: session.id,
      class_name: session.class_name,
      course_name: session.course_name,
      session_date: session.session_date,
      status: session.status,
    },
    unsignedCount: unsignedStudents.length,
    unsignedStudents,
  };
}

export async function bindStudentDevice(input: {
  student_id: string;
  name: string;
  class_name: string;
  device_id: string;
}): Promise<BindResult> {
  const studentId = normalizeText(input.student_id);
  const name = normalizeText(input.name);
  const className = normalizeText(input.class_name);
  const deviceId = normalizeText(input.device_id);

  if (!studentId || !name) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "请完整填写学号、姓名和班级",
    };
  }

  if (!isClassName(className)) {
    return {
      success: false,
      code: "INVALID_CLASS",
      message: "请选择正确的班级",
    };
  }

  return getDb().transaction((): BindResult => {
    const student = getStudentByMatch(studentId, name);

    if (!student) {
      return {
        success: false,
        code: "STUDENT_NOT_FOUND",
        message: "未找到匹配的学生，请检查学号和姓名是否正确",
      };
    }

    getDb()
      .prepare(
        `UPDATE students
         SET class_name = ?
         WHERE id = ?`,
      )
      .run(className, student.id);

    return {
      success: true,
      message: "学生信息确认成功",
      device_id: deviceId,
      student: {
        id: student.id,
        name: student.name,
        student_id: student.student_id,
        class_name: className,
      },
    };
  })();
}

export async function createAttendanceSession(input: {
  class_name: string;
  sign_code?: string;
  duration_minutes: number;
}) {
  const className = normalizeText(input.class_name);
  const signCode = normalizeText(input.sign_code ?? "") || generateRandomSignCode();
  const durationMinutes = Number(input.duration_minutes);

  if (!isClassName(className)) {
    throw new Error("请选择正确的班级");
  }

  if (!/^\d{4}$/.test(signCode)) {
    throw new Error("签到码必须为 4 位数字");
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 240) {
    throw new Error("签到时长必须在 1 到 240 分钟之间");
  }

  const activeSession = await getCurrentActiveSession();

  if (activeSession) {
    throw new Error("当前已有进行中的签到场次");
  }

  const session: AttendanceSessionRecord = {
    id: randomUUID(),
    class_name: className,
    course_name: COURSE_NAME,
    session_date: getChinaDateString(),
    sign_code: signCode,
    created_at: new Date().toISOString(),
    duration_minutes: durationMinutes,
    status: "active",
  };

  getDb()
    .prepare(
      `INSERT INTO attendance_sessions (
         id,
         class_name,
         course_name,
         session_date,
         sign_code,
         duration_minutes,
         status,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      session.id,
      session.class_name,
      session.course_name,
      session.session_date,
      session.sign_code,
      session.duration_minutes,
      session.status,
      session.created_at,
    );

  return session;
}

export async function getSignContext(input: {
  session_id: string;
  device_id: string;
  student_id?: string;
}): Promise<SignContextResult> {
  const sessionId = normalizeText(input.session_id);
  const deviceId = normalizeText(input.device_id);
  const studentId = normalizeText(input.student_id ?? "");

  if (!sessionId) {
    return {
      success: false,
      code: "MISSING_SESSION",
      message: "缺少签到场次参数",
    };
  }

  const context = resolveSigningContext(sessionId, {
    student_id: studentId,
    device_id: deviceId,
  });

  if (context.kind === "error") {
    return context.result;
  }

  if (context.kind === "already_signed") {
    return {
      success: true,
      status: "already_signed",
      studentName: context.student.name,
      signTime: context.record.sign_time,
      sessionStatus: context.session.status,
    };
  }

  return {
    success: true,
    status: "ready",
    studentName: context.student.name,
    className: context.session.class_name,
    courseName: context.session.course_name,
    sessionDate: context.session.session_date,
    sessionStatus: context.session.status,
  };
}

export async function verifyAndSign(input: {
  session_id: string;
  device_id: string;
  student_id?: string;
}): Promise<VerifySignResult> {
  const sessionId = normalizeText(input.session_id);
  const deviceId = normalizeText(input.device_id);
  const studentId = normalizeText(input.student_id ?? "");

  return getDb().transaction((): VerifySignResult => {
    const context = resolveSigningContext(sessionId, {
      student_id: studentId,
      device_id: deviceId,
    });

    if (context.kind === "error") {
      return context.result;
    }

    if (context.kind === "already_signed") {
      return {
        success: true,
        status: "already_signed",
        studentName: context.student.name,
        signTime: context.record.sign_time,
        message: "你已完成签到",
      };
    }

    const result = markStudentAttendanceSigned(context.session, context.student, deviceId);

    if (result.status === "already_signed") {
      return {
        success: true,
        status: "already_signed",
        studentName: context.student.name,
        signTime: result.signTime,
        message: "你已完成签到",
      };
    }

    return {
      success: true,
      status: "success",
      studentName: context.student.name,
      signTime: result.signTime,
    };
  })();
}

function markStudentAttendanceSigned(
  session: AttendanceSessionRecord,
  student: StudentRecord,
  deviceId: string,
) {
  const signTime = new Date().toISOString();
  const existingRecord = getAttendanceRecord(session.id, student);

  if (existingRecord?.status === "signed") {
    return {
      status: "already_signed" as const,
      signTime: existingRecord.sign_time,
    };
  }

  if (existingRecord?.status === "leave") {
    getDb()
      .prepare(
        `UPDATE attendance_records
         SET student_ref = ?, status = 'signed', sign_time = ?, device_id = ?
         WHERE id = ?`,
      )
      .run(student.id, signTime, deviceId, existingRecord.id);

    return {
      status: "success" as const,
      signTime,
    };
  }

  try {
    getDb()
      .prepare(
        `INSERT INTO attendance_records (
           id,
           session_ref,
           student_ref,
           student_id_snapshot,
           student_name_snapshot,
           student_class_name_snapshot,
           status,
           sign_time,
           device_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        session.id,
        student.id,
        student.student_id,
        student.name,
        student.class_name || null,
        "signed",
        signTime,
        deviceId,
      );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const nextRecord = getAttendanceRecord(session.id, student);

      if (nextRecord?.status === "signed") {
        return {
          status: "already_signed" as const,
          signTime: nextRecord.sign_time,
        };
      }

      if (nextRecord?.status === "leave") {
        getDb()
          .prepare(
            `UPDATE attendance_records
             SET student_ref = ?, status = 'signed', sign_time = ?, device_id = ?
             WHERE id = ?`,
          )
          .run(student.id, signTime, deviceId, nextRecord.id);

        return {
          status: "success" as const,
          signTime,
        };
      }
    }

    throw error;
  }

  return {
    status: "success" as const,
    signTime,
  };
}

export async function markStudentOnLeave(input: {
  session_id: string;
  student_id: string;
}) {
  const sessionId = normalizeText(input.session_id);
  const studentId = normalizeText(input.student_id);

  if (!sessionId || !studentId) {
    throw new Error("缺少签到场次或学生信息");
  }

  return getDb().transaction(() => {
    const session = getSessionById(sessionId);

    if (!session) {
      throw new Error("签到场次不存在");
    }

    const normalizedSession = syncSessionStatus(session);

    if (normalizedSession.status !== "active") {
      throw new Error("本次签到已结束");
    }

    const student = getStudentById(studentId);

    if (!student) {
      throw new Error("学生不存在");
    }

    if (!isClassName(student.class_name) || student.class_name !== normalizedSession.class_name) {
      throw new Error("学生班级与当前签到班级不匹配");
    }

    const existingRecord = getAttendanceRecord(normalizedSession.id, student);

    if (existingRecord?.status === "signed") {
      return {
        session: normalizedSession,
        student,
        status: "already_signed" as const,
      };
    }

    if (existingRecord?.status === "leave") {
      return {
        session: normalizedSession,
        student,
        status: "already_on_leave" as const,
      };
    }

    try {
      getDb()
        .prepare(
          `INSERT INTO attendance_records (
             id,
             session_ref,
             student_ref,
             student_id_snapshot,
             student_name_snapshot,
             student_class_name_snapshot,
             status,
             sign_time,
             device_id
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          normalizedSession.id,
          student.id,
          student.student_id,
          student.name,
          student.class_name || null,
          "leave",
          new Date().toISOString(),
          "",
        );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const nextRecord = getAttendanceRecord(normalizedSession.id, student);

        if (nextRecord?.status === "signed") {
          return {
            session: normalizedSession,
            student,
            status: "already_signed" as const,
          };
        }

        if (nextRecord?.status === "leave") {
          return {
            session: normalizedSession,
            student,
            status: "already_on_leave" as const,
          };
        }
      }

      throw error;
    }

    return {
      session: normalizedSession,
      student,
      status: "marked" as const,
    };
  })();
}

export async function markStudentSignedManually(input: {
  session_id: string;
  student_id: string;
}) {
  const sessionId = normalizeText(input.session_id);
  const studentId = normalizeText(input.student_id);

  if (!sessionId || !studentId) {
    throw new Error("缺少签到场次或学生信息");
  }

  return getDb().transaction(() => {
    const session = getSessionById(sessionId);

    if (!session) {
      throw new Error("签到场次不存在");
    }

    const normalizedSession = syncSessionStatus(session);
    const student = getStudentById(studentId);

    if (!student) {
      throw new Error("学生不存在");
    }

    if (!isClassName(student.class_name) || student.class_name !== normalizedSession.class_name) {
      throw new Error("学生班级与当前签到班级不匹配");
    }

    const result = markStudentAttendanceSigned(normalizedSession, student, "");

    return {
      session: normalizedSession,
      student,
      status: result.status === "success" ? ("marked" as const) : ("already_signed" as const),
      signTime: result.signTime,
    };
  })();
}

export async function getLiveSessionData(sessionId: string): Promise<SessionLiveData | null> {
  const session = getSessionById(sessionId);

  if (!session) {
    return null;
  }

  const normalizedSession = syncSessionStatus(session);
  const { signedStudents, leaveStudents, unsignedStudents } =
    buildSessionLiveBuckets(normalizedSession);

  return {
    session: normalizedSession,
    signedCount: signedStudents.length,
    leaveCount: leaveStudents.length,
    unsignedCount: unsignedStudents.length,
    signedStudents,
    leaveStudents,
    unsignedStudents,
  };
}

export async function getRecentSessions() {
  const items = (
    getDb()
      .prepare(
        `SELECT id, class_name, course_name, session_date, sign_code, created_at, duration_minutes, status
         FROM attendance_sessions
         ORDER BY created_at DESC
         LIMIT 8`,
      )
      .all() as SessionRow[]
  ).map((row) => mapSession(row));

  return items.map((item) => syncSessionStatus(item));
}

export async function getHistoricalSessionsData(
  sessionDateInput?: string,
): Promise<HistoricalSessionsData> {
  const selectedDate = normalizeSessionDateFilter(sessionDateInput);

  await getCurrentActiveSession();

  const dateOptions = (
    getDb()
      .prepare(
        `SELECT DISTINCT sess.session_date
         FROM attendance_sessions sess
         INNER JOIN attendance_records r ON r.session_ref = sess.id
         WHERE sess.status = 'closed'
         ORDER BY sess.session_date DESC`,
      )
      .all() as Array<{ session_date: string }>
  ).map((row) => row.session_date);

  const sessions = (
    selectedDate
      ? (getDb()
          .prepare(
            `SELECT id, class_name, course_name, session_date, sign_code, created_at, duration_minutes, status
             FROM attendance_sessions
             WHERE status = 'closed' AND session_date = ?
             ORDER BY created_at DESC`,
          )
          .all(selectedDate) as SessionRow[])
      : (getDb()
          .prepare(
            `SELECT id, class_name, course_name, session_date, sign_code, created_at, duration_minutes, status
             FROM attendance_sessions
             WHERE status = 'closed'
             ORDER BY created_at DESC`,
          )
          .all() as SessionRow[])
  ).map((row) => mapSession(row));

  const summaries: HistoricalSessionSummary[] = sessions.map((session) => {
    const { signedStudents, leaveStudents, unsignedStudents } = buildSessionLiveBuckets(session);

    return {
      id: session.id,
      class_name: session.class_name,
      course_name: session.course_name,
      session_date: session.session_date,
      sign_code: session.sign_code,
      created_at: session.created_at,
      duration_minutes: session.duration_minutes,
      status: session.status,
      signed_count: signedStudents.length,
      leave_count: leaveStudents.length,
      absent_count: unsignedStudents.length,
    };
  });

  return {
    selected_date: selectedDate,
    date_options: dateOptions,
    sessions: summaries,
  };
}

export async function getSessionStats(input: {
  date: string;
  class_name: string;
}): Promise<SessionStatsData> {
  const date = normalizeText(input.date);
  const className = normalizeText(input.class_name);

  if (!date) {
    throw new Error("请选择日期");
  }

  if (!isClassName(className)) {
    throw new Error("请选择正确的班级");
  }

  const studentRows = (
    getDb()
      .prepare(
        `SELECT id, email, student_id, name, class_name, pin_hash, pin_set_at
         FROM students
         WHERE class_name = ?
         ORDER BY student_id`,
      )
      .all(className) as StudentRow[]
  ).map((row) => mapStudent(row));
  const sessionRows = (
    getDb()
      .prepare(
        `SELECT id, class_name, course_name, session_date, sign_code, created_at, duration_minutes, status
         FROM attendance_sessions
         WHERE class_name = ? AND session_date = ?
         ORDER BY created_at`,
      )
      .all(className, date) as SessionRow[]
  ).map((row) => syncSessionStatus(mapSession(row)));
  const sessionIds = sessionRows.map((session) => session.id);
  const signedMap = new Map<string, { id: string; name: string; student_id: string; sign_time: string }>();
  const leaveMap = new Map<string, LeaveStudentView>();
  const rosterStudentsByStudentId = new Map(
    studentRows.map((student) => [student.student_id, student] as const),
  );

  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => "?").join(", ");
    const records = getDb()
      .prepare(
        `SELECT
${ATTENDANCE_SELECT_COLUMNS}
         FROM attendance_records r
         LEFT JOIN students s ON s.id = r.student_ref
         WHERE r.session_ref IN (${placeholders})
         ORDER BY r.sign_time`,
      )
      .all(...sessionIds) as AttendanceRow[];

    for (const record of records.map((row) => mapAttendance(row))) {
      if (!record.student) {
        continue;
      }

      const currentStudent = rosterStudentsByStudentId.get(record.student.student_id);
      const viewId = currentStudent?.id ?? record.student.id;

      if (record.status === "signed") {
        leaveMap.delete(record.student.student_id);

        if (!signedMap.has(record.student.student_id)) {
          signedMap.set(record.student.student_id, {
            id: viewId,
            name: record.student.name,
            student_id: record.student.student_id,
            sign_time: record.sign_time,
          });
        }

        continue;
      }

      if (!signedMap.has(record.student.student_id) && !leaveMap.has(record.student.student_id)) {
        leaveMap.set(record.student.student_id, {
          id: viewId,
          name: record.student.name,
          student_id: record.student.student_id,
          leave_time: record.sign_time,
        });
      }
    }
  }

  const signedStudents = Array.from(signedMap.values()).sort((a, b) =>
    a.student_id.localeCompare(b.student_id, "zh-CN"),
  );
  const leaveStudents = Array.from(leaveMap.values()).sort((a, b) =>
    a.student_id.localeCompare(b.student_id, "zh-CN"),
  );
  const excludedStudentIds = new Set([
    ...signedStudents.map((student) => student.student_id),
    ...leaveStudents.map((student) => student.student_id),
  ]);
  const absentStudents = studentRows
    .filter((student) => !excludedStudentIds.has(student.student_id))
    .map((student) => ({
      id: student.id,
      name: student.name,
      student_id: student.student_id,
    }));
  const archivedSignedOrLeaveCount = [...signedStudents, ...leaveStudents].filter(
    (student) => !rosterStudentsByStudentId.has(student.student_id),
  ).length;

  return {
    date,
    class_name: className,
    total: studentRows.length + archivedSignedOrLeaveCount,
    signed: signedStudents.length,
    leave: leaveStudents.length,
    absent: absentStudents.length,
    matchedSessions: sessionRows.length,
    signedStudents,
    leaveStudents,
    absentStudents,
  };
}

export async function getStudentStats(input: {
  student_id: string;
  class_name?: string;
}): Promise<StudentStatsData | null> {
  const studentId = normalizeText(input.student_id);
  const className = normalizeText(input.class_name ?? "");

  if (!studentId) {
    throw new Error("请输入学号");
  }

  const student = getStudentByStudentId(studentId);

  if (!student) {
    return null;
  }

  if (className && (!isClassName(className) || student.class_name !== className)) {
    return null;
  }

  if (!isClassName(student.class_name)) {
    return {
      student_id: student.student_id,
      name: student.name,
      class_name: student.class_name || "未绑定班级",
      total_sessions: 0,
      present_count: 0,
      absent_count: 0,
      attendance_rate: 0,
    };
  }

  const sessionRows = (
    getDb()
      .prepare(
        `SELECT id, class_name, course_name, session_date, sign_code, created_at, duration_minutes, status
         FROM attendance_sessions
         WHERE class_name = ? AND status = 'closed'
         ORDER BY created_at`,
      )
      .all(student.class_name) as SessionRow[]
  ).map((row) => mapSession(row));
  const recordRows = (
    getDb()
      .prepare(
        `SELECT
           r.id,
           r.session_ref,
           r.student_ref,
           r.status,
           r.sign_time,
           r.device_id,
           NULL AS student_record_id,
           NULL AS student_email,
           NULL AS student_student_id,
           NULL AS student_name,
           NULL AS student_class_name,
           r.student_id_snapshot AS student_snapshot_student_id,
           r.student_name_snapshot AS student_snapshot_name,
           r.student_class_name_snapshot AS student_snapshot_class_name
         FROM attendance_records r
         WHERE r.student_ref = ?`,
      )
      .all(student.id) as AttendanceRow[]
  ).map((row) => mapAttendance(row));
  const sessionIds = new Set(sessionRows.map((session) => session.id));
  const presentIds = new Set(
    recordRows
      .filter((record) => record.status === "signed")
      .map((record) => record.session_ref)
      .filter((sessionRef) => sessionIds.has(sessionRef)),
  );
  const leaveIds = new Set(
    recordRows
      .filter((record) => record.status === "leave")
      .map((record) => record.session_ref)
      .filter((sessionRef) => sessionIds.has(sessionRef)),
  );
  const totalSessions = sessionRows.length;
  const presentCount = presentIds.size;
  const leaveCount = leaveIds.size;
  const absentCount = Math.max(totalSessions - presentCount - leaveCount, 0);
  const attendanceDenominator = Math.max(totalSessions - leaveCount, 0);

  return {
    student_id: student.student_id,
    name: student.name,
    class_name: student.class_name,
    total_sessions: totalSessions,
    present_count: presentCount,
    absent_count: absentCount,
    attendance_rate: attendanceDenominator > 0 ? presentCount / attendanceDenominator : 0,
  };
}

export async function getStudentOptions(classNameInput?: string): Promise<StudentOption[]> {
  const className = normalizeText(classNameInput ?? "");
  let rows: StudentRow[];

  if (className && isClassName(className)) {
    rows = getDb()
      .prepare(
        `SELECT id, email, student_id, name, class_name, pin_hash, pin_set_at
         FROM students
         WHERE class_name = ?
         ORDER BY class_name, student_id`,
      )
      .all(className) as StudentRow[];
  } else {
    const placeholders = CLASS_OPTIONS.map(() => "?").join(", ");
    rows = getDb()
      .prepare(
        `SELECT id, email, student_id, name, class_name, pin_hash, pin_set_at
         FROM students
         WHERE class_name IN (${placeholders})
         ORDER BY class_name, student_id`,
      )
      .all(...CLASS_OPTIONS) as StudentRow[];
  }

  return rows
    .map((row) => mapStudent(row))
    .filter((student): student is StudentRecord & { class_name: ClassName } =>
      isClassName(student.class_name),
    )
    .map((student) => ({
      id: student.id,
      student_id: student.student_id,
      name: student.name,
      class_name: student.class_name,
    }));
}

export async function getSessionDateOptions(): Promise<SessionDateOption[]> {
  const placeholders = CLASS_OPTIONS.map(() => "?").join(", ");
  const data = getDb()
    .prepare(
      `SELECT class_name, session_date
       FROM attendance_sessions
       WHERE class_name IN (${placeholders})
       ORDER BY session_date DESC, created_at DESC`,
    )
    .all(...CLASS_OPTIONS) as Array<{
    class_name: string;
    session_date: string;
  }>;

  const seen = new Set<string>();
  const options: SessionDateOption[] = [];

  for (const row of data) {
    const className = row.class_name;
    const sessionDate = row.session_date;

    if (!isClassName(className) || !sessionDate) {
      continue;
    }

    const key = `${className}:${sessionDate}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    options.push({
      class_name: className,
      session_date: sessionDate,
    });
  }

  return options;
}

export async function deleteAttendanceSession(sessionIdInput: string) {
  const sessionId = normalizeText(sessionIdInput);

  if (!sessionId) {
    throw new Error("缺少签到场次");
  }

  const session = getSessionById(sessionId);

  if (!session) {
    throw new Error("签到场次不存在");
  }

  getDb().transaction(() => {
    getDb()
      .prepare(
        `DELETE FROM attendance_records
         WHERE session_ref = ?`,
      )
      .run(session.id);

    getDb()
      .prepare(
        `DELETE FROM attendance_sessions
         WHERE id = ?`,
      )
      .run(session.id);
  })();

  return session;
}

export async function getDeviceStatus(deviceIdInput: string): Promise<DeviceStatusData> {
  const deviceId = normalizeText(deviceIdInput);

  if (!deviceId) {
    return {
      device_id: "",
      is_bound: false,
    };
  }

  const binding = getBindingByDeviceId(deviceId);

  return {
    device_id: deviceId,
    is_bound: Boolean(binding?.student),
    student: binding?.student
      ? {
          id: binding.student.id,
          student_id: binding.student.student_id,
          name: binding.student.name,
          class_name: binding.student.class_name,
        }
      : undefined,
  };
}

export async function importStudentsFromText(rawText: string): Promise<StudentImportResult> {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("请先粘贴学生名单");
  }

  const normalizedRows = lines
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => {
      const lower = line.toLowerCase();
      return !(
        lower.startsWith("student_id") ||
        lower.startsWith("学号") ||
        lower.startsWith("姓名")
      );
    })
    .map(({ line, index }) => {
      const columns = splitStudentLine(line).filter(Boolean);
      const studentId = columns[0] ? normalizeText(columns[0]) : "";
      const name = columns[1] ? normalizeText(columns[1]) : "";
      const className = columns[2] ? normalizeText(columns[2]) : "";
      const email = columns[3] ? normalizeText(columns[3]) : "";

      return {
        lineNumber: index,
        student_id: studentId,
        name,
        class_name: className,
        email,
      };
    });

  const validRows = normalizedRows.filter((row) => row.student_id && row.name);
  const invalidRows = normalizedRows.filter((row) => !row.student_id || !row.name);

  if (validRows.length === 0) {
    throw new Error("没有可导入的数据，至少需要学号和姓名");
  }

  const studentIds = Array.from(new Set(validRows.map((row) => row.student_id)));
  const placeholders = studentIds.map(() => "?").join(", ");
  const existingRows =
    studentIds.length > 0
      ? (getDb()
          .prepare(
            `SELECT id, email, student_id, name, class_name, pin_hash, pin_set_at
             FROM students
             WHERE student_id IN (${placeholders})`,
          )
          .all(...studentIds) as StudentRow[])
      : [];
  const existingMap = new Map(existingRows.map((row) => {
    const student = mapStudent(row);
    return [student.student_id, student] as const;
  }));

  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  getDb().transaction(() => {
    for (const row of validRows) {
      if (row.class_name && !isClassName(row.class_name)) {
        errors.push(`第 ${row.lineNumber} 行班级无效`);
        continue;
      }

      const existing = existingMap.get(row.student_id);

      if (!existing) {
        try {
          const student: StudentRecord = {
            id: randomUUID(),
            student_id: row.student_id,
            name: row.name,
            class_name: row.class_name || "",
            email: row.email || undefined,
          };

          getDb()
            .prepare(
              `INSERT INTO students (id, email, student_id, name, class_name, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(
              student.id,
              student.email ?? null,
              student.student_id,
              student.name,
              student.class_name || null,
              new Date().toISOString(),
            );

          existingMap.set(student.student_id, student);
          inserted += 1;
        } catch {
          errors.push(`第 ${row.lineNumber} 行导入失败`);
        }

        continue;
      }

      try {
        const nextStudent: StudentRecord = {
          ...existing,
          name: row.name,
          class_name: row.class_name || existing.class_name,
          email: row.email || existing.email,
        };

        getDb()
          .prepare(
            `UPDATE students
             SET name = ?, class_name = ?, email = ?
             WHERE id = ?`,
          )
          .run(
            nextStudent.name,
            nextStudent.class_name || null,
            nextStudent.email ?? null,
            existing.id,
          );

        existingMap.set(nextStudent.student_id, nextStudent);
        updated += 1;
      } catch {
        errors.push(`第 ${row.lineNumber} 行更新失败`);
      }
    }
  })();

  return {
    inserted,
    updated,
    invalid: invalidRows.length,
    total: normalizedRows.length,
    errors,
  };
}

export async function getStudentsManagementData(
  classNameInput?: string,
): Promise<StudentsManagementData> {
  const selectedClass = normalizeStudentListFilter(classNameInput);
  const countRow = getDb()
    .prepare(
      `SELECT COUNT(*) AS total
       FROM students`,
    )
    .get() as { total: number };

  let rows: ManagedStudentRow[];

  if (selectedClass === "all") {
    rows = getDb()
      .prepare(
        `SELECT
           s.id,
           s.email,
           s.student_id,
           s.name,
           s.class_name,
           s.pin_hash,
           s.pin_set_at,
           b.id AS binding_id,
           b.device_id AS binding_device_id,
           b.created_at AS binding_created_at,
           b.updated_at AS binding_updated_at
         FROM students s
         LEFT JOIN device_bindings b ON b.student_ref = s.id
         ORDER BY s.student_id, s.class_name, s.name`,
      )
      .all() as ManagedStudentRow[];
  } else {
    rows = getDb()
      .prepare(
        `SELECT
           s.id,
           s.email,
           s.student_id,
           s.name,
           s.class_name,
           s.pin_hash,
           s.pin_set_at,
           b.id AS binding_id,
           b.device_id AS binding_device_id,
           b.created_at AS binding_created_at,
           b.updated_at AS binding_updated_at
         FROM students s
         LEFT JOIN device_bindings b ON b.student_ref = s.id
         WHERE s.class_name = ?
         ORDER BY s.student_id, s.name`,
      )
      .all(selectedClass) as ManagedStudentRow[];
  }

  const presentClasses = Array.from(
    new Set(rows.map((row) => row.class_name ?? "").filter((className) => isClassName(className))),
  ) as ClassName[];
  const totalSessionsByClass = new Map<string, number>();

  if (presentClasses.length > 0) {
    const classPlaceholders = presentClasses.map(() => "?").join(", ");
    const sessionRows = getDb()
      .prepare(
        `SELECT class_name, COUNT(*) AS total_sessions
         FROM attendance_sessions
         WHERE status = 'closed' AND class_name IN (${classPlaceholders})
         GROUP BY class_name`,
      )
      .all(...presentClasses) as Array<{
      class_name: string;
      total_sessions: number;
    }>;

    for (const row of sessionRows) {
      totalSessionsByClass.set(row.class_name, Number(row.total_sessions ?? 0));
    }
  }

  const studentIds = Array.from(new Set(rows.map((row) => row.student_id)));
  const attendanceCounts = new Map<string, { signed: number; leave: number }>();

  if (presentClasses.length > 0 && studentIds.length > 0) {
    const classPlaceholders = presentClasses.map(() => "?").join(", ");
    const studentPlaceholders = studentIds.map(() => "?").join(", ");
    const attendanceRows = getDb()
      .prepare(
        `SELECT
           r.student_id_snapshot AS student_id,
           sess.class_name,
           r.status,
           COUNT(*) AS total_records
         FROM attendance_records r
         INNER JOIN attendance_sessions sess ON sess.id = r.session_ref
         WHERE sess.status = 'closed'
           AND sess.class_name IN (${classPlaceholders})
           AND r.student_id_snapshot IN (${studentPlaceholders})
         GROUP BY r.student_id_snapshot, sess.class_name, r.status`,
      )
      .all(...presentClasses, ...studentIds) as Array<{
      student_id: string;
      class_name: string;
      status: string;
      total_records: number;
    }>;

    for (const row of attendanceRows) {
      const key = `${row.class_name}:${row.student_id}`;
      const current = attendanceCounts.get(key) ?? { signed: 0, leave: 0 };

      if (toAttendanceStatus(row.status) === "leave") {
        current.leave += Number(row.total_records ?? 0);
      } else {
        current.signed += Number(row.total_records ?? 0);
      }

      attendanceCounts.set(key, current);
    }
  }

  const rowsWithStats = rows.map((row) => {
    const className = row.class_name ?? "";
    const counts = attendanceCounts.get(`${className}:${row.student_id}`) ?? {
      signed: 0,
      leave: 0,
    };

    return {
      ...row,
      sign_count: counts.signed,
      leave_count: counts.leave,
      total_sessions: totalSessionsByClass.get(className) ?? 0,
    };
  });

  return {
    total: countRow.total ?? 0,
    filtered_total: rowsWithStats.length,
    selected_class: selectedClass,
    students: rowsWithStats.map((row) => mapManagedStudent(row)),
  };
}

export async function resetStudentBinding(studentIdInput: string) {
  const studentId = normalizeText(studentIdInput);

  if (!studentId) {
    throw new Error("缺少学生信息");
  }

  const student = getStudentById(studentId);

  if (!student) {
    throw new Error("学生不存在");
  }

  const binding = getBindingByStudentRef(student.id);

  getDb()
    .prepare(
      `DELETE FROM device_bindings
       WHERE student_ref = ?`,
    )
    .run(student.id);

  return {
    student,
    hadBinding: Boolean(binding),
  };
}

export async function deleteStudent(studentIdInput: string) {
  const studentId = normalizeText(studentIdInput);

  if (!studentId) {
    throw new Error("缺少学生信息");
  }

  const student = getStudentById(studentId);

  if (!student) {
    throw new Error("学生不存在");
  }

  return getDb().transaction(() => {
    getDb()
      .prepare(
        `DELETE FROM device_bindings
         WHERE student_ref = ?`,
      )
      .run(student.id);

    getDb()
      .prepare(
        `UPDATE attendance_records
         SET student_ref = NULL
         WHERE student_ref = ?`,
      )
      .run(student.id);

    getDb()
      .prepare(
        `DELETE FROM students
         WHERE id = ?`,
      )
      .run(student.id);

    return student;
  })();
}

function formatAttendanceStatus(status: AttendanceStatus) {
  return status === "leave" ? "请假" : "已签到";
}

export async function exportSessionAttendanceCsv(input: { date?: string }) {
  const date = normalizeSessionDateFilter(input.date);
  const rows = (
    date
      ? getDb()
          .prepare(
            `SELECT
               r.id AS record_id,
               r.sign_time,
               r.device_id,
               r.status,
               COALESCE(s.student_id, r.student_id_snapshot) AS student_id,
               COALESCE(s.name, r.student_name_snapshot) AS student_name,
               COALESCE(s.class_name, r.student_class_name_snapshot, sess.class_name) AS class_name,
               sess.id AS session_id,
               sess.session_date,
               sess.course_name
             FROM attendance_records r
             LEFT JOIN students s ON s.id = r.student_ref
             INNER JOIN attendance_sessions sess ON sess.id = r.session_ref
             WHERE sess.status = 'closed' AND sess.session_date = ?
             ORDER BY sess.created_at DESC, r.sign_time DESC, student_id`,
          )
          .all(date)
      : getDb()
          .prepare(
            `SELECT
               r.id AS record_id,
               r.sign_time,
               r.device_id,
               r.status,
               COALESCE(s.student_id, r.student_id_snapshot) AS student_id,
               COALESCE(s.name, r.student_name_snapshot) AS student_name,
               COALESCE(s.class_name, r.student_class_name_snapshot, sess.class_name) AS class_name,
               sess.id AS session_id,
               sess.session_date,
               sess.course_name
             FROM attendance_records r
             LEFT JOIN students s ON s.id = r.student_ref
             INNER JOIN attendance_sessions sess ON sess.id = r.session_ref
             WHERE sess.status = 'closed'
             ORDER BY sess.created_at DESC, r.sign_time DESC, student_id`,
          )
          .all()
  ) as Array<{
    record_id: string;
    sign_time: string;
    device_id: string;
    status: string;
    student_id: string;
    student_name: string;
    class_name: string | null;
    session_id: string;
    session_date: string;
    course_name: string;
  }>;

  return buildCsv([
    ["操作时间", "日期", "班级", "课程", "签到状态", "学号", "姓名", "设备ID", "场次ID", "签到记录ID"],
    ...rows.map((row) => [
      formatChinaDateTime(row.sign_time),
      row.session_date,
      row.class_name ?? "",
      row.course_name,
      formatAttendanceStatus(toAttendanceStatus(row.status)),
      row.student_id,
      row.student_name,
      row.device_id,
      row.session_id,
      row.record_id,
    ]),
  ]);
}

export async function exportAllAttendanceCsv() {
  const rows = getDb()
    .prepare(
      `SELECT
         r.id AS record_id,
         r.sign_time,
         r.device_id,
         r.status,
         COALESCE(s.student_id, r.student_id_snapshot) AS student_id,
         COALESCE(s.name, r.student_name_snapshot) AS student_name,
         COALESCE(s.class_name, r.student_class_name_snapshot) AS class_name,
         sess.id AS session_id,
         sess.session_date,
         sess.course_name,
         sess.status AS session_status
       FROM attendance_records r
       LEFT JOIN students s ON s.id = r.student_ref
       INNER JOIN attendance_sessions sess ON sess.id = r.session_ref
       ORDER BY r.sign_time DESC, student_id`,
    )
    .all() as Array<{
    record_id: string;
    sign_time: string;
    device_id: string;
    status: string;
    student_id: string;
    student_name: string;
    class_name: string | null;
    session_id: string;
    session_date: string;
    course_name: string;
    session_status: string;
  }>;

  return buildCsv([
    ["操作时间", "日期", "班级", "课程", "签到状态", "场次状态", "学号", "姓名", "设备ID", "场次ID", "签到记录ID"],
    ...rows.map((row) => [
      formatChinaDateTime(row.sign_time),
      row.session_date,
      row.class_name ?? "",
      row.course_name,
      formatAttendanceStatus(toAttendanceStatus(row.status)),
      row.session_status === "active" ? "进行中" : "已结束",
      row.student_id,
      row.student_name,
      row.device_id,
      row.session_id,
      row.record_id,
    ]),
  ]);
}

export async function getStudentsOverview(): Promise<StudentsOverviewData> {
  const countRow = getDb()
    .prepare(
      `SELECT COUNT(*) AS total
       FROM students`,
    )
    .get() as { total: number };
  const data = getDb()
    .prepare(
      `SELECT id, email, student_id, name, class_name, pin_hash, pin_set_at
       FROM students
       ORDER BY student_id
       LIMIT 20`,
    )
    .all() as StudentRow[];

  return {
    total: countRow.total ?? 0,
    students: data.map((row) => mapStudent(row)),
  };
}
