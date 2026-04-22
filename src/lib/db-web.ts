import type {
  AttendanceRecord,
  AttendanceSession,
  Class,
  ExportRow,
  ExportSummaryRow,
  Student,
  StudentSummary,
} from '../types';

interface StoredAttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: string;
}

interface WebDatabase {
  classes: Class[];
  students: Student[];
  sessions: AttendanceSession[];
  records: StoredAttendanceRecord[];
}

const DB_STORAGE_KEY = 'attdn.web-db';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  return crypto.randomUUID();
}

function emptyDb(): WebDatabase {
  return {
    classes: [],
    students: [],
    sessions: [],
    records: [],
  };
}

function readDb(): WebDatabase {
  try {
    const raw = window.localStorage.getItem(DB_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WebDatabase) : emptyDb();
  } catch {
    return emptyDb();
  }
}

function writeDb(db: WebDatabase): void {
  window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

function sortStudents(students: Student[]): Student[] {
  return [...students].sort((left, right) => {
    const rollCompare = left.roll_number.localeCompare(right.roll_number, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    return rollCompare || left.name.localeCompare(right.name);
  });
}

function sortSessions(sessions: AttendanceSession[]): AttendanceSession[] {
  return [...sessions].sort((left, right) => right.date.localeCompare(left.date));
}

function studentDetailsMap(db: WebDatabase): Map<string, Student> {
  return new Map(db.students.map((student) => [student.id, student]));
}

function sessionForClass(db: WebDatabase, classId: string): AttendanceSession[] {
  return db.sessions.filter((session) => session.class_id === classId);
}

export async function getClasses(): Promise<Class[]> {
  return sortByName(readDb().classes);
}

export async function createClass(name: string, section: string): Promise<Class> {
  const db = readDb();
  const createdClass: Class = {
    id: createId(),
    name,
    section,
    created_at: nowIso(),
  };
  db.classes.push(createdClass);
  writeDb(db);
  return createdClass;
}

export async function updateClass(id: string, name: string, section: string): Promise<void> {
  const db = readDb();
  const item = db.classes.find((current) => current.id === id);
  if (!item) return;
  item.name = name;
  item.section = section;
  writeDb(db);
}

export async function deleteClass(id: string): Promise<void> {
  const db = readDb();
  const studentIds = db.students.filter((student) => student.class_id === id).map((student) => student.id);
  const sessionIds = db.sessions.filter((session) => session.class_id === id).map((session) => session.id);

  db.classes = db.classes.filter((item) => item.id !== id);
  db.students = db.students.filter((student) => student.class_id !== id);
  db.sessions = db.sessions.filter((session) => session.class_id !== id);
  db.records = db.records.filter(
    (record) => !studentIds.includes(record.student_id) && !sessionIds.includes(record.session_id),
  );

  writeDb(db);
}

export async function getStudents(classId: string): Promise<Student[]> {
  const db = readDb();
  return sortStudents(db.students.filter((student) => student.class_id === classId));
}

export async function createStudent(classId: string, name: string, rollNumber: string): Promise<Student> {
  const db = readDb();
  const createdStudent: Student = {
    id: createId(),
    class_id: classId,
    name,
    roll_number: rollNumber,
    created_at: nowIso(),
  };
  db.students.push(createdStudent);
  writeDb(db);
  return createdStudent;
}

export async function importStudents(classId: string, students: [string, string][]): Promise<number> {
  const db = readDb();
  const createdAt = nowIso();
  students.forEach(([name, rollNumber]) => {
    db.students.push({
      id: createId(),
      class_id: classId,
      name,
      roll_number: rollNumber,
      created_at: createdAt,
    });
  });
  writeDb(db);
  return students.length;
}

export async function updateStudent(id: string, name: string, rollNumber: string): Promise<void> {
  const db = readDb();
  const student = db.students.find((item) => item.id === id);
  if (!student) return;
  student.name = name;
  student.roll_number = rollNumber;
  writeDb(db);
}

export async function deleteStudent(id: string): Promise<void> {
  const db = readDb();
  db.students = db.students.filter((student) => student.id !== id);
  db.records = db.records.filter((record) => record.student_id !== id);
  writeDb(db);
}

export async function createAttendanceSession(classId: string, date: string): Promise<AttendanceSession> {
  const db = readDb();
  const session: AttendanceSession = {
    id: createId(),
    class_id: classId,
    date,
    created_at: nowIso(),
  };
  db.sessions.push(session);
  writeDb(db);
  return session;
}

export async function getOrCreateSession(classId: string, date: string): Promise<AttendanceSession> {
  const db = readDb();
  const existing = db.sessions.find((session) => session.class_id === classId && session.date === date);
  if (existing) {
    return existing;
  }

  const session: AttendanceSession = {
    id: createId(),
    class_id: classId,
    date,
    created_at: nowIso(),
  };
  db.sessions.push(session);
  writeDb(db);
  return session;
}

export async function getAttendanceSessions(classId: string): Promise<AttendanceSession[]> {
  return sortSessions(sessionForClass(readDb(), classId));
}

export async function deleteAttendanceSession(id: string): Promise<void> {
  const db = readDb();
  db.sessions = db.sessions.filter((session) => session.id !== id);
  db.records = db.records.filter((record) => record.session_id !== id);
  writeDb(db);
}

export async function markAttendance(sessionId: string, studentId: string, status: string): Promise<void> {
  const db = readDb();
  const existing = db.records.find(
    (record) => record.session_id === sessionId && record.student_id === studentId,
  );

  if (existing) {
    existing.status = status;
  } else {
    db.records.push({
      id: createId(),
      session_id: sessionId,
      student_id: studentId,
      status,
    });
  }

  writeDb(db);
}

export async function markAllAbsent(sessionId: string, classId: string): Promise<void> {
  const db = readDb();
  const students = db.students.filter((student) => student.class_id === classId);

  students.forEach((student) => {
    const existing = db.records.find(
      (record) => record.session_id === sessionId && record.student_id === student.id,
    );

    if (existing) {
      existing.status = 'absent';
    } else {
      db.records.push({
        id: createId(),
        session_id: sessionId,
        student_id: student.id,
        status: 'absent',
      });
    }
  });

  writeDb(db);
}

export async function getAttendanceRecords(sessionId: string): Promise<AttendanceRecord[]> {
  const db = readDb();
  const studentsById = studentDetailsMap(db);

  const records = db.records
    .filter((record) => record.session_id === sessionId)
    .map((record) => {
      const student = studentsById.get(record.student_id);
      if (!student) {
        return null;
      }

      return {
        id: record.id,
        session_id: record.session_id,
        student_id: record.student_id,
        student_name: student.name,
        roll_number: student.roll_number,
        status: record.status,
      } satisfies AttendanceRecord;
    })
    .filter((record): record is AttendanceRecord => Boolean(record));

  return records.sort((left, right) => {
    const rollCompare = left.roll_number.localeCompare(right.roll_number, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    return rollCompare || left.student_name.localeCompare(right.student_name);
  });
}

export async function getStudentSummary(classId: string): Promise<StudentSummary[]> {
  const db = readDb();
  const students = sortStudents(db.students.filter((student) => student.class_id === classId));
  const sessions = sessionForClass(db, classId);

  return students.map((student) => {
    const presentCount = sessions.reduce((count, session) => {
      const record = db.records.find(
        (item) => item.session_id === session.id && item.student_id === student.id && item.status === 'present',
      );
      return count + (record ? 1 : 0);
    }, 0);

    return {
      student_id: student.id,
      student_name: student.name,
      roll_number: student.roll_number,
      total_sessions: sessions.length,
      present_count: presentCount,
    };
  });
}

export async function getExportData(classId: string): Promise<ExportRow[]> {
  const db = readDb();
  const students = sortStudents(db.students.filter((student) => student.class_id === classId));
  const sessions = [...sessionForClass(db, classId)].sort((left, right) => left.date.localeCompare(right.date));

  const rows: ExportRow[] = [];
  students.forEach((student) => {
    sessions.forEach((session) => {
      const record = db.records.find(
        (item) => item.session_id === session.id && item.student_id === student.id,
      );
      rows.push({
        roll_number: student.roll_number,
        student_name: student.name,
        date: session.date,
        status: record?.status ?? 'not_marked',
      });
    });
  });

  return rows;
}

export async function getExportSummary(classId: string): Promise<ExportSummaryRow[]> {
  const summaries = await getStudentSummary(classId);
  return summaries.map((summary) => ({
    roll_number: summary.roll_number,
    student_name: summary.student_name,
    total_sessions: summary.total_sessions,
    present_count: summary.present_count,
    percentage: summary.total_sessions > 0
      ? Math.round((summary.present_count / summary.total_sessions) * 1000) / 10
      : 0,
  }));
}
