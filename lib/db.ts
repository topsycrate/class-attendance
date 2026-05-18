import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import DatabaseConstructor from "better-sqlite3";
import { CHINA_TIMEZONE } from "@/lib/constants";

type SqliteDatabase = InstanceType<typeof DatabaseConstructor>;

const DEFAULT_DATABASE_PATH = path.join(process.cwd(), "data", "attendance.sqlite");
const REQUIRED_BACKUP_TABLES = [
  "attendance_records",
  "attendance_sessions",
  "device_bindings",
  "students",
] as const;

const ATTENDANCE_RECORDS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    session_ref TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_ref TEXT REFERENCES students(id) ON DELETE SET NULL,
    student_id_snapshot TEXT NOT NULL,
    student_name_snapshot TEXT NOT NULL,
    student_class_name_snapshot TEXT,
    status TEXT NOT NULL DEFAULT 'signed' CHECK(status IN ('signed', 'leave')),
    sign_time TEXT NOT NULL,
    device_id TEXT NOT NULL,
    UNIQUE(session_ref, student_ref),
    UNIQUE(session_ref, student_id_snapshot)
  );
`;

const ATTENDANCE_RECORDS_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_attendance_records_session_ref
    ON attendance_records(session_ref);

  CREATE INDEX IF NOT EXISTS idx_attendance_records_student_ref
    ON attendance_records(student_ref);

  CREATE INDEX IF NOT EXISTS idx_attendance_records_sign_time
    ON attendance_records(sign_time);
`;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    email TEXT,
    student_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    class_name TEXT,
    pin_hash TEXT,
    pin_set_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS device_bindings (
    id TEXT PRIMARY KEY,
    student_ref TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL UNIQUE,
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance_sessions (
    id TEXT PRIMARY KEY,
    class_name TEXT NOT NULL,
    course_name TEXT NOT NULL DEFAULT '英语听力',
    session_date TEXT NOT NULL,
    sign_code TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closed')),
    created_at TEXT NOT NULL
  );

  ${ATTENDANCE_RECORDS_TABLE_SQL}

  CREATE INDEX IF NOT EXISTS idx_students_class_name
    ON students(class_name);

  CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class_date
    ON attendance_sessions(class_name, session_date);

  CREATE INDEX IF NOT EXISTS idx_attendance_sessions_created_at
    ON attendance_sessions(created_at DESC);

  ${ATTENDANCE_RECORDS_INDEXES_SQL}
`;

interface SqliteErrorLike {
  code?: string;
  message: string;
}

interface TableInfoRow {
  name: string;
  notnull: number;
}

interface ForeignKeyRow {
  from: string;
  on_delete: string;
}

interface SqliteIntegrityCheckRow {
  integrity_check?: string;
  quick_check?: string;
}

interface SqliteTableRow {
  name: string;
}

export interface DatabaseBackupFile {
  buffer: Buffer;
  filename: string;
}

export interface RestoreDatabaseBackupResult {
  rollbackFilename: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __attendanceDb: SqliteDatabase | undefined;
  // eslint-disable-next-line no-var
  var __attendanceDbPath: string | undefined;
}

function normalizeDatabasePath(input?: string) {
  const value = input?.trim();
  return value ? value : DEFAULT_DATABASE_PATH;
}

export function getDatabasePath() {
  return normalizeDatabasePath(process.env.DATABASE_PATH);
}

function requireFileBackedDatabasePath(databasePath: string) {
  if (databasePath === ":memory:") {
    throw new Error("内存数据库不支持备份或恢复");
  }

  return databasePath;
}

function buildDatabaseTimestamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: CHINA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  const second = parts.find((part) => part.type === "second")?.value;

  if (!year || !month || !day || !hour || !minute || !second) {
    throw new Error("无法生成备份时间戳");
  }

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function buildDatabaseFilename(prefix: string, date = new Date()) {
  return `${prefix}-${buildDatabaseTimestamp(date)}.sqlite`;
}

function removeFileIfExists(filePath: string) {
  fs.rmSync(filePath, { force: true });
}

function removeSqliteSidecars(databasePath: string) {
  removeFileIfExists(`${databasePath}-wal`);
  removeFileIfExists(`${databasePath}-shm`);
}

function getIntegrityCheckResult(database: SqliteDatabase) {
  const row = database.prepare(`PRAGMA quick_check`).get() as SqliteIntegrityCheckRow | undefined;
  return row ? Object.values(row)[0] : undefined;
}

function validateBackupDatabaseFile(databasePath: string) {
  const stat = fs.statSync(databasePath, { throwIfNoEntry: false });

  if (!stat?.isFile() || stat.size === 0) {
    throw new Error("备份文件为空或不存在");
  }

  const database = new DatabaseConstructor(databasePath, {
    readonly: true,
    fileMustExist: true,
  });

  try {
    const integrityCheckResult = getIntegrityCheckResult(database);

    if (integrityCheckResult !== "ok") {
      throw new Error("备份文件校验失败");
    }

    const tables = new Set(
      (
        database
          .prepare(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
          )
          .all() as SqliteTableRow[]
      ).map((row) => row.name),
    );
    const missingTables = REQUIRED_BACKUP_TABLES.filter((table) => !tables.has(table));

    if (missingTables.length > 0) {
      throw new Error(`备份文件不完整，缺少 ${missingTables.join("、")} 表`);
    }
  } finally {
    database.close();
  }
}

function restoreDatabaseFromSnapshot(databasePath: string, snapshotPath: string) {
  closeDb();
  removeSqliteSidecars(databasePath);
  removeFileIfExists(databasePath);
  fs.copyFileSync(snapshotPath, databasePath);
  getDb();
}

export async function createDatabaseBackupFile(): Promise<DatabaseBackupFile> {
  requireFileBackedDatabasePath(getDatabasePath());

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attendance-backup-"));
  const backupPath = path.join(tempDir, "attendance.sqlite");

  try {
    await getDb().backup(backupPath);

    return {
      buffer: fs.readFileSync(backupPath),
      filename: buildDatabaseFilename("attendance-backup"),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function restoreDatabaseBackup(
  buffer: Buffer | Uint8Array,
): Promise<RestoreDatabaseBackupResult> {
  const databasePath = requireFileBackedDatabasePath(getDatabasePath());

  if (buffer.byteLength === 0) {
    throw new Error("备份文件为空");
  }

  const databaseDir = path.dirname(databasePath);
  const restoreToken = buildDatabaseTimestamp();
  const rollbackFilename = buildDatabaseFilename("attendance-rollback");
  const rollbackPath = path.join(databaseDir, rollbackFilename);
  const stagedPath = path.join(databaseDir, `${path.basename(databasePath)}.restore-${restoreToken}.tmp`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "attendance-restore-"));
  const uploadedBackupPath = path.join(tempDir, "uploaded-backup.sqlite");
  let rollbackCreated = false;

  fs.mkdirSync(databaseDir, { recursive: true });

  try {
    fs.writeFileSync(uploadedBackupPath, buffer);
    validateBackupDatabaseFile(uploadedBackupPath);

    await getDb().backup(rollbackPath);
    rollbackCreated = true;

    fs.copyFileSync(uploadedBackupPath, stagedPath);

    try {
      closeDb();
      removeSqliteSidecars(databasePath);
      removeFileIfExists(databasePath);
      fs.renameSync(stagedPath, databasePath);
      getDb();
    } catch (error) {
      removeFileIfExists(stagedPath);

      if (rollbackCreated) {
        try {
          restoreDatabaseFromSnapshot(databasePath, rollbackPath);
        } catch (rollbackError) {
          const restoreMessage = formatDatabaseError(error);
          const rollbackMessage = formatDatabaseError(rollbackError);
          throw new Error(`加载备份失败，且自动回滚失败：${restoreMessage}；${rollbackMessage}`);
        }

        throw new Error(`加载备份失败，已自动回滚恢复前数据：${formatDatabaseError(error)}`);
      }

      throw error;
    }

    return { rollbackFilename };
  } finally {
    removeFileIfExists(stagedPath);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function configureDatabase(database: SqliteDatabase, databasePath: string) {
  database.pragma("foreign_keys = ON");

  if (databasePath !== ":memory:") {
    database.pragma("journal_mode = WAL");
  }

  database.pragma("busy_timeout = 5000");
  database.exec(SCHEMA_SQL);
  migrateStudentsTable(database);
  migrateDeviceBindingsTable(database);
  migrateAttendanceRecordsTable(database);
  database.exec(ATTENDANCE_RECORDS_INDEXES_SQL);
}

function migrateStudentsTable(database: SqliteDatabase) {
  const columns = database.prepare(`PRAGMA table_info(students)`).all() as TableInfoRow[];

  if (columns.length === 0) {
    return;
  }

  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("pin_hash")) {
    database.exec(`ALTER TABLE students ADD COLUMN pin_hash TEXT`);
  }

  if (!columnNames.has("pin_set_at")) {
    database.exec(`ALTER TABLE students ADD COLUMN pin_set_at TEXT`);
  }
}

function migrateDeviceBindingsTable(database: SqliteDatabase) {
  const columns = database.prepare(`PRAGMA table_info(device_bindings)`).all() as TableInfoRow[];

  if (columns.length === 0) {
    return;
  }

  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("updated_at")) {
    database.exec(`ALTER TABLE device_bindings ADD COLUMN updated_at TEXT`);
  }

  database.exec(`
    UPDATE device_bindings
    SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at)
    WHERE updated_at IS NULL OR updated_at = ''
  `);
}

function migrateAttendanceRecordsTable(database: SqliteDatabase) {
  const columns = database
    .prepare(`PRAGMA table_info(attendance_records)`)
    .all() as TableInfoRow[];

  if (columns.length === 0) {
    return;
  }

  const columnNames = new Set(columns.map((column) => column.name));
  const studentRefColumn = columns.find((column) => column.name === "student_ref");
  const foreignKeys = database
    .prepare(`PRAGMA foreign_key_list(attendance_records)`)
    .all() as ForeignKeyRow[];
  const studentRefForeignKey = foreignKeys.find((foreignKey) => foreignKey.from === "student_ref");
  const needsMigration =
    !columnNames.has("student_id_snapshot") ||
    !columnNames.has("student_name_snapshot") ||
    !columnNames.has("student_class_name_snapshot") ||
    !columnNames.has("status") ||
    !studentRefColumn ||
    studentRefColumn.notnull !== 0 ||
    !studentRefForeignKey ||
    studentRefForeignKey.on_delete.toUpperCase() !== "SET NULL";

  if (!needsMigration) {
    return;
  }

  database.pragma("foreign_keys = OFF");

  try {
    database.exec("BEGIN");
    database.exec(`ALTER TABLE attendance_records RENAME TO attendance_records_old`);
    database.exec(ATTENDANCE_RECORDS_TABLE_SQL);

    const legacyColumns = new Set(
      (
        database
          .prepare(`PRAGMA table_info(attendance_records_old)`)
          .all() as TableInfoRow[]
      ).map((column) => column.name),
    );
    const studentIdSnapshotSource = legacyColumns.has("student_id_snapshot")
      ? `COALESCE(r.student_id_snapshot, s.student_id, '')`
      : `COALESCE(s.student_id, '')`;
    const studentNameSnapshotSource = legacyColumns.has("student_name_snapshot")
      ? `COALESCE(r.student_name_snapshot, s.name, '')`
      : `COALESCE(s.name, '')`;
    const studentClassSnapshotSource = legacyColumns.has("student_class_name_snapshot")
      ? `COALESCE(r.student_class_name_snapshot, s.class_name)`
      : `s.class_name`;
    const statusSource = legacyColumns.has("status")
      ? `COALESCE(r.status, 'signed')`
      : `'signed'`;

    database.exec(`
      INSERT INTO attendance_records (
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
      SELECT
        r.id,
        r.session_ref,
        r.student_ref,
        ${studentIdSnapshotSource},
        ${studentNameSnapshotSource},
        ${studentClassSnapshotSource},
        ${statusSource},
        r.sign_time,
        r.device_id
      FROM attendance_records_old r
      LEFT JOIN students s ON s.id = r.student_ref
    `);

    database.exec(`DROP TABLE attendance_records_old`);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.pragma("foreign_keys = ON");
  }
}

export function getDb() {
  const databasePath = getDatabasePath();

  if (global.__attendanceDb && global.__attendanceDbPath === databasePath) {
    return global.__attendanceDb;
  }

  if (global.__attendanceDb) {
    global.__attendanceDb.close();
  }

  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseConstructor(databasePath);
  configureDatabase(database, databasePath);

  global.__attendanceDb = database;
  global.__attendanceDbPath = databasePath;

  return database;
}

export function closeDb() {
  global.__attendanceDb?.close();
  global.__attendanceDb = undefined;
  global.__attendanceDbPath = undefined;
}

export function resetDatabaseForTests() {
  closeDb();
}

function isSqliteError(error: unknown): error is SqliteErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  );
}

export function isUniqueConstraintError(error: unknown) {
  if (!isSqliteError(error)) {
    return false;
  }

  return (
    error.code === "SQLITE_CONSTRAINT_UNIQUE" ||
    error.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    error.message.includes("UNIQUE constraint failed")
  );
}

export function formatDatabaseError(error: unknown) {
  if (isUniqueConstraintError(error)) {
    return "数据已存在，不能重复提交";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (isSqliteError(error)) {
    return error.message;
  }

  return "服务器异常";
}
