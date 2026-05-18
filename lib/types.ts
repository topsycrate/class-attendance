import { CLASS_OPTIONS } from "@/lib/constants";

export type ClassName = (typeof CLASS_OPTIONS)[number];
export type SessionStatus = "active" | "closed";
export type AttendanceStatus = "signed" | "leave";

export interface StudentRecord {
  id: string;
  email?: string;
  student_id: string;
  name: string;
  class_name: string;
  has_pin?: boolean;
  pin_set_at?: string;
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
  updated_at: string;
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
  student_ref: string | null;
  sign_time: string;
  device_id: string;
  status: AttendanceStatus;
  student?: StudentRecord | null;
  session?: AttendanceSessionRecord | null;
}

export interface SignedStudentView {
  id: string;
  name: string;
  student_id: string;
  sign_time: string;
}

export interface LeaveStudentView {
  id: string;
  name: string;
  student_id: string;
  leave_time: string;
}

export interface UnsignedStudentView {
  id: string;
  name: string;
  student_id: string;
}

export interface SessionLiveData {
  session: AttendanceSessionRecord;
  signedCount: number;
  leaveCount: number;
  unsignedCount: number;
  signedStudents: SignedStudentView[];
  leaveStudents: LeaveStudentView[];
  unsignedStudents: UnsignedStudentView[];
}

export interface StudentAuthStudent {
  id: string;
  student_id: string;
  name: string;
  class_name: string;
}

export type StudentAuthResult =
  | {
      success: true;
      message: string;
      student: StudentAuthStudent;
      deviceRestricted: false;
      hasPin: boolean;
      pinSetAt?: string;
    }
  | {
      success: false;
      code: string;
      message: string;
    };

export type StudentPinSetupResult = StudentAuthResult;
export type StudentLoginResult = StudentAuthResult;

export type StudentAuthStatusResult =
  | {
      authenticated: false;
      device_id: string;
      deviceRestricted: false;
    }
  | {
      authenticated: true;
      device_id: string;
      deviceRestricted: boolean;
      message?: string;
      hasPin: boolean;
      pinSetAt?: string;
      student: StudentAuthStudent;
    };

export type PublicCurrentSessionResult =
  | {
      active: false;
    }
  | {
      active: true;
      session: Pick<
        AttendanceSessionRecord,
        "id" | "class_name" | "course_name" | "session_date" | "status"
      >;
      unsignedCount: number;
      unsignedStudents: UnsignedStudentView[];
    };

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
  leave: number;
  absent: number;
  matchedSessions: number;
  signedStudents: SignedStudentView[];
  leaveStudents: LeaveStudentView[];
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

export type StudentListFilter = ClassName | "all";

export interface StudentManagementItem {
  id: string;
  student_id: string;
  name: string;
  class_name: string;
  email?: string;
  has_pin: boolean;
  pin_set_at?: string;
  is_bound: boolean;
  device_id?: string;
  binding_created_at?: string;
  binding_updated_at?: string;
  sign_count: number;
  absent_count: number;
  attendance_rate: number;
}

export interface StudentsManagementData {
  total: number;
  filtered_total: number;
  selected_class: StudentListFilter;
  students: StudentManagementItem[];
}

export interface StudentsOverviewData {
  total: number;
  students: Pick<StudentRecord, "id" | "student_id" | "name" | "class_name" | "email">[];
}

export interface HistoricalSessionSummary {
  id: string;
  class_name: ClassName;
  course_name: string;
  session_date: string;
  sign_code: string;
  created_at: string;
  duration_minutes: number;
  status: SessionStatus;
  signed_count: number;
  leave_count: number;
  absent_count: number;
}

export interface HistoricalSessionsData {
  selected_date: string;
  date_options: string[];
  sessions: HistoricalSessionSummary[];
}
