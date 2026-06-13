pub mod binary;
pub mod commands;
pub mod config;
pub mod env_file;
pub mod error;
pub mod process;
pub mod settings;
pub mod status;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::Manager;
            // Portable: keep settings + the downloaded noalbs binary in a folder
            // next to the GUI executable (beside the .app on macOS), like NOALBS.
            let base = crate::settings::portable_base();
            let settings_path = base.join("settings.json");
            let binary_dir = base.join("bin");
            let settings =
                crate::settings::Settings::load_from(&settings_path).unwrap_or_default();
            app.manage(crate::commands::AppState {
                settings: tokio::sync::Mutex::new(settings),
                settings_path,
                binary_dir,
                process: tokio::sync::Mutex::new(crate::process::ProcessManager::default()),
                status: std::sync::Arc::new(std::sync::Mutex::new(crate::status::NoalbsStatus::default())),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            crate::commands::get_settings,
            crate::commands::save_settings,
            crate::commands::set_manual_binary_path,
            crate::commands::check_update,
            crate::commands::download_binary,
            crate::commands::get_log_buffer,
            crate::commands::clear_logs,
            crate::commands::get_status,
            crate::commands::start_noalbs,
            crate::commands::stop_noalbs,
            crate::commands::restart_noalbs,
            crate::commands::get_config,
            crate::commands::save_config,
            crate::commands::get_env,
            crate::commands::save_env,
            crate::commands::get_dashboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
