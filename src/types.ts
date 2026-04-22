export interface Class {
  id: string;
  name: string;
  section: string;
  created_at: string;
}

export interface Student {
  id: string;
  class_id: string;
  name: string;
  roll_number: string;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  date: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  status: string;
}

export interface StudentSummary {
  student_id: string;
  student_name: string;
  roll_number: string;
  total_sessions: number;
  present_count: number;
}

export interface ExportRow {
  roll_number: string;
  student_name: string;
  date: string;
  status: string;
}

export interface ExportSummaryRow {
  roll_number: string;
  student_name: string;
  total_sessions: number;
  present_count: number;
  percentage: number;
}
