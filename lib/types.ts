import { CLASS_OPTIONS } from "@/lib/constants";

export type ClassName = (typeof CLASS_OPTIONS)[number];
export type SessionStatus = "active" | "closed";

export interface StudentRecord {
  id: string;
  email?: string;
  student_id: string;
  name: string;
  class_name: string;
}

export interface StudentOption {
  id: string;
  student_id: string;
  name: string;
  class_name: ClassName;
}

export interface SessionDateOption {
  class_name: ClassName;
  session_date: string;
}

export interface DeviceBindingRecord {
  id: string;
  student_ref: string;
  device_id: string;
  created_at: string;
  student?: StudentRecord | null;
}

export interface AttendanceSessionRecord {
  id: string;
  class_name: ClassName;
  course_name: string;
  session_date: string;
  sign_code: string;
  created_at: string;
  duration_minutes: number;
  status: SessionStatus;
}

export interface AttendanceRecord {
  id: string;
  session_ref: string;
  student_ref: string;
  sign_time: string;
  device_id: string;
  student?: StudentRecord | null;
  session?: AttendanceSessionRecord | null;
}

export interface SignedStudentView {
  id: string;
  name: string;
  student_id: string;
  sign_time: string;
}

export interface UnsignedStudentView {
  id: string;
  name: string;
  student_id: string;
}

export interface SessionLiveData {
  session: AttendanceSessionRecord;
  signedCount: number;
  unsignedCount: number;
  signedStudents: SignedStudentView[];
  unsignedStudents: UnsignedStudentView[];
}

export type BindResult =
  | {
      success: true;
      message: string;
      device_id: string;
      student: Pick<StudentRecord, "id" | "name" | "student_id" | "class_name">;
    }
  | {
      success: false;
      code: string;
      message: string;
    };

export type SignContextResult =
  | {
      success: true;
      status: "ready";
      studentName: string;
      className: ClassName;
      courseName: string;
      sessionDate: string;
      sessionStatus: SessionStatus;
    }
  | {
      success: true;
      status: "already_signed";
      studentName: string;
      signTime: string;
      sessionStatus: SessionStatus;
    }
  | {
      success: false;
      code: string;
      message: string;
    };

export type VerifySignResult =
  | {
      success: true;
      status: "success";
      studentName: string;
      signTime: string;
    }
  | {
      success: true;
      status: "already_signed";
      studentName: string;
      signTime: string;
      message: string;
    }
  | {
      success: false;
      code: string;
      message: string;
    };

export interface SessionStatsData {
  date: string;
  class_name: ClassName;
  total: number;
  signed: number;
  absent: number;
  matchedSessions: number;
  signedStudents: SignedStudentView[];
  absentStudents: UnsignedStudentView[];
}

export interface StudentStatsData {
  student_id: string;
  name: string;
  class_name: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  attendance_rate: number;
}

export interface DeviceStatusData {
  device_id: string;
  is_bound: boolean;
  student?: {
    id: string;
    student_id: string;
    name: string;
    class_name: string;
  };
}

export interface StudentImportResult {
  inserted: number;
  updated: number;
  invalid: number;
  total: number;
  errors: string[];
}

export interface StudentsOverviewData {
  total: number;
  students: Pick<StudentRecord, "id" | "student_id" | "name" | "class_name" | "email">[];
}
