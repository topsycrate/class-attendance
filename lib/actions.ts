import { CLASS_OPTIONS, COURSE_NAME } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getChinaDateString, getSessionExpireAt } from "@/lib/time";
import type {
  AttendanceRecord,
  AttendanceSessionRecord,
  BindResult,
  ClassName,
  DeviceStatusData,
  DeviceBindingRecord,
  SessionDateOption,
  SessionLiveData,
  SessionStatsData,
  SignContextResult,
  StudentImportResult,
  StudentOption,
  StudentRecord,
  StudentStatsData,
  StudentsOverviewData,
  VerifySignResult,
} from "@/lib/types";

const STUDENT_COLUMNS = "id, email, student_id, name, class_name";
const SESSION_COLUMNS =
  "id, class_name, course_name, session_date, sign_code, created_at, duration_minutes, status";
const BINDING_WITH_STUDENT_COLUMNS =
  "id, student_ref, device_id, created_at, student:students!device_bindings_student_ref_fkey(" +
  STUDENT_COLUMNS +
  ")";
const RECORD_WITH_STUDENT_COLUMNS =
  "id, session_ref, student_ref, sign_time, device_id, student:students!attendance_records_student_ref_fkey(" +
  STUDENT_COLUMNS +
  ")";

interface SupabaseErrorLike {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

function isClassName(value: string): value is ClassName {
  return (CLASS_OPTIONS as readonly string[]).includes(value);
}

function normalizeText(value: string) {
  return value.trim();
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

function isSupabaseError(error: unknown): error is SupabaseErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  );
}

function isUniqueConstraintError(error: unknown) {
  return isSupabaseError(error) && error.code === "23505";
}

function throwIfError(error: SupabaseErrorLike | null) {
  if (error) {
    throw error;
  }
}

function mapStudent(row: unknown): StudentRecord {
  const record = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};

  return {
    id: String(record.id ?? ""),
    email: typeof record.email === "string" ? record.email : undefined,
    student_id: String(record.student_id ?? ""),
    name: String(record.name ?? ""),
    class_name: typeof record.class_name === "string" ? record.class_name : "",
  };
}

function mapSession(row: unknown): AttendanceSessionRecord {
  const record = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};

  return {
    id: String(record.id ?? ""),
    class_name: String(record.class_name ?? "") as ClassName,
    course_name: String(record.course_name ?? ""),
    session_date: String(record.session_date ?? ""),
    sign_code: String(record.sign_code ?? ""),
    created_at: String(record.created_at ?? ""),
    duration_minutes: Number(record.duration_minutes ?? 0),
    status: String(record.status ?? "closed") as AttendanceSessionRecord["status"],
  };
}

function mapBinding(row: unknown): DeviceBindingRecord {
  const record = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};

  return {
    id: String(record.id ?? ""),
    student_ref: String(record.student_ref ?? ""),
    device_id: String(record.device_id ?? ""),
    created_at: String(record.created_at ?? ""),
    student:
      record.student && typeof record.student === "object"
        ? mapStudent(record.student as Record<string, unknown>)
        : null,
  };
}

function mapAttendance(row: unknown): AttendanceRecord {
  const record = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};

  return {
    id: String(record.id ?? ""),
    session_ref: String(record.session_ref ?? ""),
    student_ref: String(record.student_ref ?? ""),
    sign_time: String(record.sign_time ?? ""),
    device_id: String(record.device_id ?? ""),
    student:
      record.student && typeof record.student === "object"
        ? mapStudent(record.student as Record<string, unknown>)
        : null,
    session:
      record.session && typeof record.session === "object"
        ? mapSession(record.session as Record<string, unknown>)
        : null,
  };
}

async function getStudentByMatch(studentId: string, name: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_COLUMNS)
    .eq("student_id", studentId)
    .eq("name", name)
    .maybeSingle();

  throwIfError(error);
  return data ? mapStudent(data) : null;
}

async function getStudentByStudentId(studentId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_COLUMNS)
    .eq("student_id", studentId)
    .maybeSingle();

  throwIfError(error);
  return data ? mapStudent(data) : null;
}

async function getBindingByStudentRef(studentRef: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("device_bindings")
    .select(BINDING_WITH_STUDENT_COLUMNS)
    .eq("student_ref", studentRef)
    .maybeSingle();

  throwIfError(error);
  return data ? mapBinding(data) : null;
}

async function getBindingByDeviceId(deviceId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("device_bindings")
    .select(BINDING_WITH_STUDENT_COLUMNS)
    .eq("device_id", deviceId)
    .maybeSingle();

  throwIfError(error);
  return data ? mapBinding(data) : null;
}

async function getAttendanceRecord(sessionRef: string, studentRef: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_records")
    .select(RECORD_WITH_STUDENT_COLUMNS)
    .eq("session_ref", sessionRef)
    .eq("student_ref", studentRef)
    .maybeSingle();

  throwIfError(error);
  return data ? mapAttendance(data) : null;
}

async function getSessionById(sessionId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .maybeSingle();

  throwIfError(error);
  return data ? mapSession(data) : null;
}

async function syncSessionStatus(session: AttendanceSessionRecord) {
  const duration = Number(session.duration_minutes) || 0;

  if (session.status !== "active" || duration <= 0) {
    return session;
  }

  const expireAt = getSessionExpireAt(session.created_at, duration);

  if (expireAt.getTime() > Date.now()) {
    return session;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .update({ status: "closed" })
    .eq("id", session.id)
    .select(SESSION_COLUMNS)
    .single();

  throwIfError(error);
  return mapSession(data);
}

async function resolveSigningContext(sessionId: string, deviceId: string) {
  const session = await getSessionById(sessionId);

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

  const normalizedSession = await syncSessionStatus(session);

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

  const binding = await getBindingByDeviceId(deviceId);

  if (!binding?.student) {
    return {
      kind: "error" as const,
      result: {
        success: false as const,
        code: "DEVICE_NOT_BOUND",
        message: "当前设备未绑定学生信息，请先完成绑定",
      },
    };
  }

  const student = binding.student;

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

  const existingRecord = await getAttendanceRecord(normalizedSession.id, student.id);

  if (existingRecord) {
    return {
      kind: "already_signed" as const,
      session: normalizedSession,
      student,
      record: existingRecord,
    };
  }

  return {
    kind: "ready" as const,
    session: normalizedSession,
    student,
    binding,
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

  if (!studentId || !name || !deviceId) {
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

  const existingDeviceBinding = await getBindingByDeviceId(deviceId);

  if (existingDeviceBinding?.student) {
    return {
      success: false,
      code: "DEVICE_ALREADY_BOUND",
      message: "当前设备已绑定其他学生，无法重复绑定",
    };
  }

  const student = await getStudentByMatch(studentId, name);

  if (!student) {
    return {
      success: false,
      code: "STUDENT_NOT_FOUND",
      message: "未找到匹配的学生，请检查学号和姓名是否正确",
    };
  }

  const existingStudentBinding = await getBindingByStudentRef(student.id);

  if (existingStudentBinding) {
    return {
      success: false,
      code: "STUDENT_ALREADY_BOUND",
      message: "该学生已绑定设备，如需更换设备请联系老师处理",
    };
  }

  const supabase = getSupabaseAdmin();
  const { error: updateError } = await supabase
    .from("students")
    .update({ class_name: className })
    .eq("id", student.id);

  throwIfError(updateError);

  const { error: createError } = await supabase.from("device_bindings").insert({
    student_ref: student.id,
    device_id: deviceId,
  });

  if (createError) {
    if (isUniqueConstraintError(createError)) {
      return {
        success: false,
        code: "BINDING_CONFLICT",
        message: "绑定记录已存在，请刷新页面后重试",
      };
    }

    throw createError;
  }

  return {
    success: true,
    message: "绑定成功",
    device_id: deviceId,
    student: {
      id: student.id,
      name: student.name,
      student_id: student.student_id,
      class_name: className,
    },
  };
}

export async function createAttendanceSession(input: {
  class_name: string;
  sign_code: string;
  duration_minutes: number;
}) {
  const className = normalizeText(input.class_name);
  const signCode = normalizeText(input.sign_code) || generateRandomSignCode();
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

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .insert({
      class_name: className,
      course_name: COURSE_NAME,
      session_date: getChinaDateString(),
      sign_code: signCode,
      duration_minutes: durationMinutes,
      status: "active",
    })
    .select(SESSION_COLUMNS)
    .single();

  throwIfError(error);
  return mapSession(data);
}

export async function getSignContext(input: {
  session_id: string;
  device_id: string;
}): Promise<SignContextResult> {
  const sessionId = normalizeText(input.session_id);
  const deviceId = normalizeText(input.device_id);

  if (!sessionId) {
    return {
      success: false,
      code: "MISSING_SESSION",
      message: "缺少签到场次参数",
    };
  }

  if (!deviceId) {
    return {
      success: false,
      code: "MISSING_DEVICE",
      message: "当前设备未绑定，请先完成绑定",
    };
  }

  const context = await resolveSigningContext(sessionId, deviceId);

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
  sign_code: string;
}): Promise<VerifySignResult> {
  const sessionId = normalizeText(input.session_id);
  const deviceId = normalizeText(input.device_id);
  const signCode = normalizeText(input.sign_code);

  if (!/^\d{4}$/.test(signCode)) {
    return {
      success: false,
      code: "INVALID_SIGN_CODE",
      message: "签到码必须为 4 位数字",
    };
  }

  const context = await resolveSigningContext(sessionId, deviceId);

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

  if (context.session.sign_code !== signCode) {
    return {
      success: false,
      code: "SIGN_CODE_MISMATCH",
      message: "签到码错误，请重新输入",
    };
  }

  const signTime = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("attendance_records").insert({
    session_ref: context.session.id,
    student_ref: context.student.id,
    sign_time: signTime,
    device_id: deviceId,
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      const existingRecord = await getAttendanceRecord(context.session.id, context.student.id);

      if (existingRecord) {
        return {
          success: true,
          status: "already_signed",
          studentName: context.student.name,
          signTime: existingRecord.sign_time,
          message: "你已完成签到",
        };
      }
    }

    throw error;
  }

  return {
    success: true,
    status: "success",
    studentName: context.student.name,
    signTime,
  };
}

export async function getLiveSessionData(sessionId: string): Promise<SessionLiveData | null> {
  const session = await getSessionById(sessionId);

  if (!session) {
    return null;
  }

  const normalizedSession = await syncSessionStatus(session);
  const supabase = getSupabaseAdmin();
  const [{ data: students, error: studentsError }, { data: records, error: recordsError }] =
    await Promise.all([
      supabase
        .from("students")
        .select(STUDENT_COLUMNS)
        .eq("class_name", normalizedSession.class_name)
        .order("student_id"),
      supabase
        .from("attendance_records")
        .select(RECORD_WITH_STUDENT_COLUMNS)
        .eq("session_ref", normalizedSession.id)
        .order("sign_time"),
    ]);

  throwIfError(studentsError);
  throwIfError(recordsError);

  const studentRows = (students ?? []).map((row) => mapStudent(row));
  const recordRows = (records ?? []).map((row) => mapAttendance(row));
  const signedStudents = recordRows
    .map((record) => {
      if (!record.student) {
        return null;
      }

      return {
        id: record.student.id,
        name: record.student.name,
        student_id: record.student.student_id,
        sign_time: record.sign_time,
      };
    })
    .filter(
      (student): student is { id: string; name: string; student_id: string; sign_time: string } =>
        Boolean(student),
    );

  const signedIds = new Set(signedStudents.map((student) => student.id));
  const unsignedStudents = studentRows
    .filter((student) => !signedIds.has(student.id))
    .map((student) => ({
      id: student.id,
      name: student.name,
      student_id: student.student_id,
    }));

  return {
    session: normalizedSession,
    signedCount: signedStudents.length,
    unsignedCount: unsignedStudents.length,
    signedStudents,
    unsignedStudents,
  };
}

export async function getRecentSessions() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(SESSION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(8);

  throwIfError(error);
  const items = (data ?? []).map((row) => mapSession(row));
  return Promise.all(items.map((item) => syncSessionStatus(item)));
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

  const supabase = getSupabaseAdmin();
  const [{ data: students, error: studentsError }, { data: sessions, error: sessionsError }] =
    await Promise.all([
      supabase.from("students").select(STUDENT_COLUMNS).eq("class_name", className).order("student_id"),
      supabase
        .from("attendance_sessions")
        .select(SESSION_COLUMNS)
        .eq("class_name", className)
        .eq("session_date", date)
        .order("created_at"),
    ]);

  throwIfError(studentsError);
  throwIfError(sessionsError);

  const studentRows = (students ?? []).map((row) => mapStudent(row));
  const sessionRows = (sessions ?? []).map((row) => mapSession(row));
  const sessionIds = sessionRows.map((session) => session.id);
  const signedMap = new Map<string, { id: string; name: string; student_id: string; sign_time: string }>();

  if (sessionIds.length > 0) {
    const { data: records, error: recordsError } = await supabase
      .from("attendance_records")
      .select(RECORD_WITH_STUDENT_COLUMNS)
      .in("session_ref", sessionIds)
      .order("sign_time");

    throwIfError(recordsError);

    for (const record of (records ?? []).map((row) => mapAttendance(row))) {
      if (!record.student || signedMap.has(record.student.id)) {
        continue;
      }

      signedMap.set(record.student.id, {
        id: record.student.id,
        name: record.student.name,
        student_id: record.student.student_id,
        sign_time: record.sign_time,
      });
    }
  }

  const signedStudents = Array.from(signedMap.values()).sort((a, b) =>
    a.student_id.localeCompare(b.student_id, "zh-CN"),
  );
  const signedIds = new Set(signedStudents.map((student) => student.id));
  const absentStudents = studentRows
    .filter((student) => !signedIds.has(student.id))
    .map((student) => ({
      id: student.id,
      name: student.name,
      student_id: student.student_id,
    }));

  return {
    date,
    class_name: className,
    total: studentRows.length,
    signed: signedStudents.length,
    absent: absentStudents.length,
    matchedSessions: sessionRows.length,
    signedStudents,
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

  const student = await getStudentByStudentId(studentId);

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

  const supabase = getSupabaseAdmin();
  const [{ data: sessions, error: sessionsError }, { data: records, error: recordsError }] =
    await Promise.all([
      supabase
        .from("attendance_sessions")
        .select(SESSION_COLUMNS)
        .eq("class_name", student.class_name)
        .order("created_at"),
      supabase
        .from("attendance_records")
        .select("id, session_ref, student_ref, sign_time, device_id")
        .eq("student_ref", student.id),
    ]);

  throwIfError(sessionsError);
  throwIfError(recordsError);

  const sessionRows = (sessions ?? []).map((row) => mapSession(row));
  const recordRows = (records ?? []).map((row) => mapAttendance(row));
  const sessionIds = new Set(sessionRows.map((session) => session.id));
  const presentIds = new Set(
    recordRows.map((record) => record.session_ref).filter((sessionRef) => sessionIds.has(sessionRef)),
  );
  const totalSessions = sessionRows.length;
  const presentCount = presentIds.size;
  const absentCount = Math.max(totalSessions - presentCount, 0);

  return {
    student_id: student.student_id,
    name: student.name,
    class_name: student.class_name,
    total_sessions: totalSessions,
    present_count: presentCount,
    absent_count: absentCount,
    attendance_rate: totalSessions > 0 ? presentCount / totalSessions : 0,
  };
}

export async function getStudentOptions(classNameInput?: string): Promise<StudentOption[]> {
  const className = normalizeText(classNameInput ?? "");
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("students")
    .select(STUDENT_COLUMNS)
    .order("class_name")
    .order("student_id");

  if (className && isClassName(className)) {
    query = query.eq("class_name", className);
  } else {
    query = query.in("class_name", [...CLASS_OPTIONS]);
  }

  const { data, error } = await query;

  throwIfError(error);

  return (data ?? [])
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
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("class_name, session_date")
    .in("class_name", [...CLASS_OPTIONS])
    .order("session_date", { ascending: false });

  throwIfError(error);

  const seen = new Set<string>();
  const options: SessionDateOption[] = [];

  for (const row of data ?? []) {
    const record = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
    const className = String(record.class_name ?? "");
    const sessionDate = String(record.session_date ?? "");

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

  const session = await getSessionById(sessionId);

  if (!session) {
    throw new Error("签到场次不存在");
  }

  const supabase = getSupabaseAdmin();
  const { error: recordsError } = await supabase
    .from("attendance_records")
    .delete()
    .eq("session_ref", session.id);

  throwIfError(recordsError);

  const { error: sessionError } = await supabase
    .from("attendance_sessions")
    .delete()
    .eq("id", session.id);

  throwIfError(sessionError);

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

  const binding = await getBindingByDeviceId(deviceId);

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

  const supabase = getSupabaseAdmin();
  const studentIds = Array.from(new Set(validRows.map((row) => row.student_id)));
  const { data: existingRows, error: existingError } = await supabase
    .from("students")
    .select(STUDENT_COLUMNS)
    .in("student_id", studentIds);

  throwIfError(existingError);

  const existingMap = new Map(
    (existingRows ?? []).map((row) => {
      const student = mapStudent(row);
      return [student.student_id, student];
    }),
  );

  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of validRows) {
    if (row.class_name && !isClassName(row.class_name)) {
      errors.push(`第 ${row.lineNumber} 行班级无效`);
      continue;
    }

    const existing = existingMap.get(row.student_id);

    if (!existing) {
      const { error } = await supabase.from("students").insert({
        student_id: row.student_id,
        name: row.name,
        class_name: row.class_name || null,
        email: row.email || null,
      });

      if (error) {
        errors.push(`第 ${row.lineNumber} 行导入失败`);
        continue;
      }

      inserted += 1;
      continue;
    }

    const payload: Record<string, string | null> = {
      name: row.name,
    };

    if (row.class_name) {
      payload.class_name = row.class_name;
    }

    if (row.email) {
      payload.email = row.email;
    }

    const { error } = await supabase.from("students").update(payload).eq("id", existing.id);

    if (error) {
      errors.push(`第 ${row.lineNumber} 行更新失败`);
      continue;
    }

    updated += 1;
  }

  return {
    inserted,
    updated,
    invalid: invalidRows.length,
    total: normalizedRows.length,
    errors,
  };
}

export async function getStudentsOverview(): Promise<StudentsOverviewData> {
  const supabase = getSupabaseAdmin();
  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase
      .from("students")
      .select(STUDENT_COLUMNS)
      .order("student_id")
      .limit(20),
  ]);

  throwIfError(countError);
  throwIfError(dataError);

  return {
    total: count ?? 0,
    students: (data ?? []).map((row) => mapStudent(row)),
  };
}
