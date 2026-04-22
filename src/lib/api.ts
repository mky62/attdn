import { invoke } from '@tauri-apps/api/core';
import type {
  Class,
  Student,
  AttendanceSession,
  AttendanceRecord,
  StudentSummary,
  ExportRow,
  ExportSummaryRow,
} from '../types';

// ── Classes ─────────────────────────────────────────────────────────────

export async function getClasses(): Promise<Class[]> {
  return invoke('get_classes');
}

export async function createClass(name: string, section: string): Promise<Class> {
  return invoke('create_class', { name, section });
}

export async function updateClass(id: string, name: string, section: string): Promise<void> {
  return invoke('update_class', { id, name, section });
}

export async function deleteClass(id: string): Promise<void> {
  return invoke('delete_class', { id });
}

// ── Students ───────────────────────────────────────────────────────────

export async function getStudents(classId: string): Promise<Student[]> {
  return invoke('get_students', { classId });
}

export async function createStudent(
  classId: string,
  name: string,
  rollNumber: string,
): Promise<Student> {
  return invoke('create_student', { classId, name, rollNumber });
}

export async function importStudents(
  classId: string,
  students: [string, string][],
): Promise<number> {
  return invoke('import_students', { classId, students });
}

export async function updateStudent(
  id: string,
  name: string,
  rollNumber: string,
): Promise<void> {
  return invoke('update_student', { id, name, rollNumber });
}

export async function deleteStudent(id: string): Promise<void> {
  return invoke('delete_student', { id });
}

// ── Attendance ──────────────────────────────────────────────────────────

export async function createAttendanceSession(
  classId: string,
  date: string,
): Promise<AttendanceSession> {
  return invoke('create_attendance_session', { classId, date });
}

export async function getOrCreateSession(
  classId: string,
  date: string,
): Promise<AttendanceSession> {
  return invoke('get_or_create_session', { classId, date });
}

export async function getAttendanceSessions(classId: string): Promise<AttendanceSession[]> {
  return invoke('get_attendance_sessions', { classId });
}

export async function deleteAttendanceSession(id: string): Promise<void> {
  return invoke('delete_attendance_session', { id });
}

export async function markAttendance(
  sessionId: string,
  studentId: string,
  status: string,
): Promise<void> {
  return invoke('mark_attendance', { sessionId, studentId, status });
}

export async function markAllAbsent(
  sessionId: string,
  classId: string,
): Promise<void> {
  return invoke('mark_all_absent', { sessionId, classId });
}

export async function getAttendanceRecords(
  sessionId: string,
): Promise<AttendanceRecord[]> {
  return invoke('get_attendance_records', { sessionId });
}

export async function getStudentSummary(classId: string): Promise<StudentSummary[]> {
  return invoke('get_student_summary', { classId });
}

// ── Export ──────────────────────────────────────────────────────────────

export async function getExportData(classId: string): Promise<ExportRow[]> {
  return invoke('get_export_data', { classId });
}

export async function getExportSummary(classId: string): Promise<ExportSummaryRow[]> {
  return invoke('get_export_summary', { classId });
}
