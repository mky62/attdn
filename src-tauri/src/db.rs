use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

pub struct DbState(pub Mutex<Connection>);

fn get_conn(state: &State<DbState>) -> std::sync::MutexGuard<Connection> {
    state.0.lock().unwrap()
}

// ── Models ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Class {
    pub id: String,
    pub name: String,
    pub section: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Student {
    pub id: String,
    pub class_id: String,
    pub name: String,
    pub roll_number: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttendanceSession {
    pub id: String,
    pub class_id: String,
    pub date: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttendanceRecord {
    pub id: String,
    pub session_id: String,
    pub student_id: String,
    pub student_name: String,
    pub roll_number: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StudentSummary {
    pub student_id: String,
    pub student_name: String,
    pub roll_number: String,
    pub total_sessions: i64,
    pub present_count: i64,
}

// ── Init ────────────────────────────────────────────────────────────────

pub fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS classes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            section TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL,
            name TEXT NOT NULL,
            roll_number TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS attendance_sessions (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
            UNIQUE(class_id, date)
        );

        CREATE TABLE IF NOT EXISTS attendance_records (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('present', 'absent')),
            FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            UNIQUE(session_id, student_id)
        );

        CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_class ON attendance_sessions(class_id);
        CREATE INDEX IF NOT EXISTS idx_records_session ON attendance_records(session_id);
        CREATE INDEX IF NOT EXISTS idx_records_student ON attendance_records(student_id);
        "
    )
}

// ── Class Commands ──────────────────────────────────────────────────────

#[tauri::command]
pub fn get_classes(state: State<DbState>) -> Result<Vec<Class>, String> {
    let conn = get_conn(&state);
    let mut stmt = conn
        .prepare("SELECT id, name, section, created_at FROM classes ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Class {
                id: row.get(0)?,
                name: row.get(1)?,
                section: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<SqlResult<Vec<Class>>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_class(state: State<DbState>, name: String, section: String) -> Result<Class, String> {
    let conn = get_conn(&state);
    let id = Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO classes (id, name, section, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, section, created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(Class {
        id,
        name,
        section,
        created_at,
    })
}

#[tauri::command]
pub fn update_class(
    state: State<DbState>,
    id: String,
    name: String,
    section: String,
) -> Result<(), String> {
    let conn = get_conn(&state);
    conn.execute(
        "UPDATE classes SET name = ?1, section = ?2 WHERE id = ?3",
        params![name, section, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_class(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = get_conn(&state);
    conn.execute("DELETE FROM classes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Student Commands ───────────────────────────────────────────────────

#[tauri::command]
pub fn get_students(state: State<DbState>, class_id: String) -> Result<Vec<Student>, String> {
    let conn = get_conn(&state);
    let mut stmt = conn
        .prepare(
            "SELECT id, class_id, name, roll_number, created_at FROM students WHERE class_id = ?1 ORDER BY roll_number, name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![class_id], |row| {
            Ok(Student {
                id: row.get(0)?,
                class_id: row.get(1)?,
                name: row.get(2)?,
                roll_number: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<SqlResult<Vec<Student>>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_student(
    state: State<DbState>,
    class_id: String,
    name: String,
    roll_number: String,
) -> Result<Student, String> {
    let conn = get_conn(&state);
    let id = Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO students (id, class_id, name, roll_number, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, class_id, name, roll_number, created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(Student {
        id,
        class_id,
        name,
        roll_number,
        created_at,
    })
}

#[tauri::command]
pub fn import_students(
    state: State<DbState>,
    class_id: String,
    students: Vec<(String, String)>,
) -> Result<usize, String> {
    let conn = get_conn(&state);
    let mut count = 0;
    for (name, roll_number) in students {
        let id = Uuid::new_v4().to_string();
        let created_at = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO students (id, class_id, name, roll_number, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, class_id, name, roll_number, created_at],
        )
        .map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
pub fn update_student(
    state: State<DbState>,
    id: String,
    name: String,
    roll_number: String,
) -> Result<(), String> {
    let conn = get_conn(&state);
    conn.execute(
        "UPDATE students SET name = ?1, roll_number = ?2 WHERE id = ?3",
        params![name, roll_number, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_student(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = get_conn(&state);
    conn.execute("DELETE FROM students WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Attendance Session Commands ─────────────────────────────────────────

#[tauri::command]
pub fn create_attendance_session(
    state: State<DbState>,
    class_id: String,
    date: String,
) -> Result<AttendanceSession, String> {
    let conn = get_conn(&state);
    let id = Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO attendance_sessions (id, class_id, date, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, class_id, date, created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(AttendanceSession {
        id,
        class_id,
        date,
        created_at,
    })
}

#[tauri::command]
pub fn get_or_create_session(
    state: State<DbState>,
    class_id: String,
    date: String,
) -> Result<AttendanceSession, String> {
    let conn = get_conn(&state);
    let mut stmt = conn
        .prepare(
            "SELECT id, class_id, date, created_at FROM attendance_sessions WHERE class_id = ?1 AND date = ?2",
        )
        .map_err(|e| e.to_string())?;
    let existing: Option<AttendanceSession> = stmt
        .query_row(params![class_id, date], |row| {
            Ok(AttendanceSession {
                id: row.get(0)?,
                class_id: row.get(1)?,
                date: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .ok();

    if let Some(session) = existing {
        return Ok(session);
    }

    drop(stmt);
    create_attendance_session(state, class_id, date)
}

#[tauri::command]
pub fn get_attendance_sessions(
    state: State<DbState>,
    class_id: String,
) -> Result<Vec<AttendanceSession>, String> {
    let conn = get_conn(&state);
    let mut stmt = conn
        .prepare(
            "SELECT id, class_id, date, created_at FROM attendance_sessions WHERE class_id = ?1 ORDER BY date DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![class_id], |row| {
            Ok(AttendanceSession {
                id: row.get(0)?,
                class_id: row.get(1)?,
                date: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<SqlResult<Vec<AttendanceSession>>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_attendance_session(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = get_conn(&state);
    conn.execute("DELETE FROM attendance_sessions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Attendance Record Commands ──────────────────────────────────────────

#[tauri::command]
pub fn mark_attendance(
    state: State<DbState>,
    session_id: String,
    student_id: String,
    status: String,
) -> Result<(), String> {
    if status != "present" && status != "absent" {
        return Err("Status must be 'present' or 'absent'".to_string());
    }
    let conn = get_conn(&state);
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO attendance_records (id, session_id, student_id, status) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(session_id, student_id) DO UPDATE SET status = ?4",
        params![id, session_id, student_id, status],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn mark_all_absent(state: State<DbState>, session_id: String, class_id: String) -> Result<(), String> {
    let conn = get_conn(&state);
    let students: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM students WHERE class_id = ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![class_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<SqlResult<Vec<String>>>().map_err(|e| e.to_string())?
    };

    for student_id in students {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO attendance_records (id, session_id, student_id, status) VALUES (?1, ?2, ?3, 'absent')
             ON CONFLICT(session_id, student_id) DO UPDATE SET status = 'absent'",
            params![id, session_id, student_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_attendance_records(
    state: State<DbState>,
    session_id: String,
) -> Result<Vec<AttendanceRecord>, String> {
    let conn = get_conn(&state);
    let mut stmt = conn
        .prepare(
            "SELECT ar.id, ar.session_id, ar.student_id, s.name, s.roll_number, ar.status
             FROM attendance_records ar
             JOIN students s ON s.id = ar.student_id
             WHERE ar.session_id = ?1
             ORDER BY s.roll_number, s.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(AttendanceRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                student_id: row.get(2)?,
                student_name: row.get(3)?,
                roll_number: row.get(4)?,
                status: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<SqlResult<Vec<AttendanceRecord>>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_student_summary(
    state: State<DbState>,
    class_id: String,
) -> Result<Vec<StudentSummary>, String> {
    let conn = get_conn(&state);
    let mut stmt = conn
        .prepare(
            "SELECT
                s.id,
                s.name,
                s.roll_number,
                COUNT(DISTINCT as2.id) as total_sessions,
                COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN as2.id END) as present_count
             FROM students s
             LEFT JOIN attendance_sessions as2 ON as2.class_id = s.class_id
             LEFT JOIN attendance_records ar ON ar.session_id = as2.id AND ar.student_id = s.id
             WHERE s.class_id = ?1
             GROUP BY s.id
             ORDER BY s.roll_number, s.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![class_id], |row| {
            Ok(StudentSummary {
                student_id: row.get(0)?,
                student_name: row.get(1)?,
                roll_number: row.get(2)?,
                total_sessions: row.get(3)?,
                present_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<SqlResult<Vec<StudentSummary>>>().map_err(|e| e.to_string())
}

// ── Export Commands ─────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ExportRow {
    pub roll_number: String,
    pub student_name: String,
    pub date: String,
    pub status: String,
}

#[tauri::command]
pub fn get_export_data(
    state: State<DbState>,
    class_id: String,
) -> Result<Vec<ExportRow>, String> {
    let conn = get_conn(&state);
    let mut stmt = conn
        .prepare(
            "SELECT s.roll_number, s.name, as2.date, ar.status
             FROM students s
             CROSS JOIN attendance_sessions as2 ON as2.class_id = s.class_id
             LEFT JOIN attendance_records ar ON ar.session_id = as2.id AND ar.student_id = s.id
             WHERE s.class_id = ?1
             ORDER BY s.roll_number, s.name, as2.date",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![class_id], |row| {
            Ok(ExportRow {
                roll_number: row.get(0)?,
                student_name: row.get(1)?,
                date: row.get(2)?,
                status: row.get::<_, Option<String>>(3).unwrap_or_else(|| "not_marked".to_string()),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<SqlResult<Vec<ExportRow>>>().map_err(|e| e.to_string())
}

#[derive(Debug, Serialize)]
pub struct ExportSummaryRow {
    pub roll_number: String,
    pub student_name: String,
    pub total_sessions: i64,
    pub present_count: i64,
    pub percentage: f64,
}

#[tauri::command]
pub fn get_export_summary(
    state: State<DbState>,
    class_id: String,
) -> Result<Vec<ExportSummaryRow>, String> {
    let conn = get_conn(&state);
    let mut stmt = conn
        .prepare(
            "SELECT
                s.roll_number,
                s.name,
                COUNT(DISTINCT as2.id) as total_sessions,
                COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN as2.id END) as present_count,
                CASE WHEN COUNT(DISTINCT as2.id) > 0
                    THEN ROUND(COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN as2.id END) * 100.0 / COUNT(DISTINCT as2.id), 1)
                    ELSE 0
                END as percentage
             FROM students s
             LEFT JOIN attendance_sessions as2 ON as2.class_id = s.class_id
             LEFT JOIN attendance_records ar ON ar.session_id = as2.id AND ar.student_id = s.id
             WHERE s.class_id = ?1
             GROUP BY s.id
             ORDER BY s.roll_number, s.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![class_id], |row| {
            Ok(ExportSummaryRow {
                roll_number: row.get(0)?,
                student_name: row.get(1)?,
                total_sessions: row.get(2)?,
                present_count: row.get(3)?,
                percentage: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<SqlResult<Vec<ExportSummaryRow>>>().map_err(|e| e.to_string())
}
