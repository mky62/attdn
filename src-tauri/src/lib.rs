mod db;

use db::DbState;
use rusqlite::Connection;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("attdn.db");
            let conn = Connection::open(&db_path).expect("Failed to open database");
            db::init_db(&conn).expect("Failed to initialize database");
            app.manage(DbState(Mutex::new(conn)));

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            db::get_classes,
            db::create_class,
            db::update_class,
            db::delete_class,
            db::get_students,
            db::create_student,
            db::import_students,
            db::update_student,
            db::delete_student,
            db::create_attendance_session,
            db::get_or_create_session,
            db::get_attendance_sessions,
            db::delete_attendance_session,
            db::mark_attendance,
            db::mark_all_absent,
            db::get_attendance_records,
            db::get_student_summary,
            db::get_export_data,
            db::get_export_summary,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
