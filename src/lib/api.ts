import type {
  Class,
  Student,
  AttendanceSession,
  AttendanceRecord,
  StudentSummary,
  ExportRow,
  ExportSummaryRow,
} from '../types';
import { isTauriApp } from './platform';
import * as webDb from './db-web';

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export async function getClasses(): Promise<Class[]> {
  return isTauriApp() ? tauriInvoke('get_classes') : webDb.getClasses();
}

export async function createClass(name: string, section: string): Promise<Class> {
  return isTauriApp()
    ? tauriInvoke('create_class', { name, section })
    : webDb.createClass(name, section);
}

export async function updateClass(id: string, name: string, section: string): Promise<void> {
  return isTauriApp()
    ? tauriInvoke('update_class', { id, name, section })
    : webDb.updateClass(id, name, section);
}

export async function deleteClass(id: string): Promise<void> {
  return isTauriApp() ? tauriInvoke('delete_class', { id }) : webDb.deleteClass(id);
}

export async function getStudents(classId: string): Promise<Student[]> {
  return isTauriApp() ? tauriInvoke('get_students', { classId }) : webDb.getStudents(classId);
}

export async function createStudent(
  classId: string,
  name: string,
  rollNumber: string,
): Promise<Student> {
  return isTauriApp()
    ? tauriInvoke('create_student', { classId, name, rollNumber })
    : webDb.createStudent(classId, name, rollNumber);
}

export async function importStudents(
  classId: string,
  students: [string, string][],
): Promise<number> {
  return isTauriApp()
    ? tauriInvoke('import_students', { classId, students })
    : webDb.importStudents(classId, students);
}

export async function updateStudent(
  id: string,
  name: string,
  rollNumber: string,
): Promise<void> {
  return isTauriApp()
    ? tauriInvoke('update_student', { id, name, rollNumber })
    : webDb.updateStudent(id, name, rollNumber);
}

export async function deleteStudent(id: string): Promise<void> {
  return isTauriApp() ? tauriInvoke('delete_student', { id }) : webDb.deleteStudent(id);
}

export async function createAttendanceSession(
  classId: string,
  date: string,
): Promise<AttendanceSession> {
  return isTauriApp()
    ? tauriInvoke('create_attendance_session', { classId, date })
    : webDb.createAttendanceSession(classId, date);
}

export async function getOrCreateSession(
  classId: string,
  date: string,
): Promise<AttendanceSession> {
  return isTauriApp()
    ? tauriInvoke('get_or_create_session', { classId, date })
    : webDb.getOrCreateSession(classId, date);
}

export async function getAttendanceSessions(classId: string): Promise<AttendanceSession[]> {
  return isTauriApp()
    ? tauriInvoke('get_attendance_sessions', { classId })
    : webDb.getAttendanceSessions(classId);
}

export async function deleteAttendanceSession(id: string): Promise<void> {
  return isTauriApp()
    ? tauriInvoke('delete_attendance_session', { id })
    : webDb.deleteAttendanceSession(id);
}

export async function markAttendance(
  sessionId: string,
  studentId: string,
  status: string,
): Promise<void> {
  return isTauriApp()
    ? tauriInvoke('mark_attendance', { sessionId, studentId, status })
    : webDb.markAttendance(sessionId, studentId, status);
}

export async function markAllAbsent(
  sessionId: string,
  classId: string,
): Promise<void> {
  return isTauriApp()
    ? tauriInvoke('mark_all_absent', { sessionId, classId })
    : webDb.markAllAbsent(sessionId, classId);
}

export async function getAttendanceRecords(
  sessionId: string,
): Promise<AttendanceRecord[]> {
  return isTauriApp()
    ? tauriInvoke('get_attendance_records', { sessionId })
    : webDb.getAttendanceRecords(sessionId);
}

export async function getStudentSummary(classId: string): Promise<StudentSummary[]> {
  return isTauriApp()
    ? tauriInvoke('get_student_summary', { classId })
    : webDb.getStudentSummary(classId);
}

export async function getExportData(classId: string): Promise<ExportRow[]> {
  return isTauriApp()
    ? tauriInvoke('get_export_data', { classId })
    : webDb.getExportData(classId);
}

export async function getExportSummary(classId: string): Promise<ExportSummaryRow[]> {
  return isTauriApp()
    ? tauriInvoke('get_export_summary', { classId })
    : webDb.getExportSummary(classId);
}
