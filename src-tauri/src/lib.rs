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
            let config_dir = app.path().app_config_dir().expect("config dir");
            let data_dir = app.path().app_data_dir().expect("data dir");
            let settings_path = config_dir.join("settings.json");
            let binary_dir = data_dir.join("bin");
            let settings =
                crate::settings::Settings::load_from(&settings_path).unwrap_or_default();
            app.manage(crate::commands::AppState {
                settings: tokio::sync::Mutex::new(settings),
                settings_path,
                binary_dir,
                process: tokio::sync::Mutex::new(crate::process::ProcessManager::default()),
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
            crate::commands::get_status,
            crate::commands::start_noalbs,
            crate::commands::stop_noalbs,
            crate::commands::restart_noalbs,
            crate::commands::get_config,
            crate::commands::save_config,
            crate::commands::get_env,
            crate::commands::save_env,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
