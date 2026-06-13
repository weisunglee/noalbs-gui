use std::path::PathBuf;
use std::sync::{Arc, Mutex as StdMutex};

use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

use crate::binary::{self, ReleaseAsset};
use crate::config::Config;
use crate::env_file::{self, EnvValues};
use crate::error::{AppError, AppResult};
use crate::process::{ExitSink, LineSink, LogLine, ProcessManager};
use crate::settings::{BinarySource, Settings};
use crate::status::{self, NoalbsStatus};

const GITHUB_API: &str = "https://api.github.com";

pub struct AppState {
    pub settings: Mutex<Settings>,
    pub settings_path: PathBuf,
    pub binary_dir: PathBuf,
    pub process: Mutex<ProcessManager>,
    pub status: Arc<StdMutex<NoalbsStatus>>,
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<Settings> {
    Ok(state.settings.lock().await.clone())
}

#[tauri::command]
pub async fn save_settings(state: State<'_, AppState>, settings: Settings) -> AppResult<()> {
    settings.save_to(&state.settings_path)?;
    *state.settings.lock().await = settings;
    Ok(())
}

#[tauri::command]
pub async fn set_manual_binary_path(
    state: State<'_, AppState>,
    path: PathBuf,
) -> AppResult<Settings> {
    let mut s = state.settings.lock().await;
    s.binary_source = BinarySource::Manual;
    s.binary_path = Some(path);
    s.installed_version = None;
    s.save_to(&state.settings_path)?;
    Ok(s.clone())
}

/// Returns the newer tag if an update is available, else None.
#[tauri::command]
pub async fn check_update(state: State<'_, AppState>) -> AppResult<Option<String>> {
    let installed = state.settings.lock().await.installed_version.clone();
    let release = binary::fetch_latest_release(GITHUB_API).await?;
    match installed {
        Some(v) if !binary::is_update_available(&release.tag_name, &v) => Ok(None),
        _ => Ok(Some(release.tag_name)),
    }
}

/// Download the latest binary for this OS/arch (auto mode). Updates settings.
#[tauri::command]
pub async fn download_binary(state: State<'_, AppState>) -> AppResult<Settings> {
    let target = binary::current_target().ok_or(AppError::NoMatchingAsset)?;
    let release = binary::fetch_latest_release(GITHUB_API).await?;
    let asset: &ReleaseAsset =
        binary::select_asset(&release.assets, target).ok_or(AppError::NoMatchingAsset)?;

    // Update in place: extract into the existing binary's directory so the
    // config.json/.env next to it are preserved. Fall back to the default bin
    // dir for a fresh install.
    let dest = {
        let s = state.settings.lock().await;
        s.binary_path
            .as_ref()
            .and_then(|b| b.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| state.binary_dir.clone())
    };
    let path = binary::download_and_extract(asset, &dest).await?;

    let mut s = state.settings.lock().await;
    s.binary_path = Some(path);
    s.installed_version = Some(binary::normalize_tag(&release.tag_name).to_string());
    s.save_to(&state.settings_path)?;
    Ok(s.clone())
}

#[tauri::command]
pub async fn get_log_buffer(state: State<'_, AppState>) -> AppResult<Vec<LogLine>> {
    let pm = state.process.lock().await;
    let snap = pm.buffer.lock().unwrap().snapshot();
    Ok(snap)
}

#[tauri::command]
pub async fn clear_logs(state: State<'_, AppState>) -> AppResult<()> {
    let pm = state.process.lock().await;
    pm.buffer.lock().unwrap().clear();
    Ok(())
}

#[tauri::command]
pub async fn get_status(app: AppHandle, state: State<'_, AppState>) -> AppResult<bool> {
    let mut pm = state.process.lock().await;
    // If the child exited on its own (e.g. noalbs crashed), surface it: emit a
    // one-shot `noalbs-exit` so the UI updates even without further user action.
    if let Some(code) = pm.poll_exit() {
        let _ = app.emit("noalbs-exit", code);
    }
    Ok(pm.is_running())
}

#[tauri::command]
pub async fn start_noalbs(app: AppHandle, state: State<'_, AppState>) -> AppResult<()> {
    let s = state.settings.lock().await.clone();
    let binary = s.binary_path.clone().ok_or(AppError::BinaryMissing)?;
    let cwd = s.working_dir.clone().unwrap_or_else(|| {
        binary
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .to_path_buf()
    });

    // reset before (re)start
    *state.status.lock().unwrap() = NoalbsStatus::default();

    let status = state.status.clone();
    let app_for_line = app.clone();
    let on_line: LineSink = Arc::new(move |line: LogLine| {
        let _ = app_for_line.emit("noalbs-log", line.clone());
        let changed = {
            let mut s = status.lock().unwrap();
            status::parse_status_line(&line.text, &mut s)
        };
        if changed {
            let snapshot = status.lock().unwrap().clone();
            let _ = app_for_line.emit("noalbs-status", snapshot);
        }
    });
    let app_for_exit = app.clone();
    let on_exit: ExitSink = Arc::new(move |code: Option<i32>| {
        let _ = app_for_exit.emit("noalbs-exit", code);
    });

    let mut pm = state.process.lock().await;
    pm.start(&binary, &cwd, &[], on_line, on_exit)?;
    Ok(())
}

#[tauri::command]
pub async fn stop_noalbs(state: State<'_, AppState>) -> AppResult<()> {
    state.process.lock().await.stop().await
}

#[tauri::command]
pub async fn restart_noalbs(app: AppHandle, state: State<'_, AppState>) -> AppResult<()> {
    {
        let mut pm = state.process.lock().await;
        if pm.is_running() {
            pm.stop().await?;
        }
    }
    start_noalbs(app, state).await
}

fn config_path(s: &crate::settings::Settings) -> AppResult<PathBuf> {
    let dir = s.working_dir.clone().or_else(|| {
        s.binary_path.as_ref().and_then(|b| b.parent().map(|p| p.to_path_buf()))
    });
    dir.map(|d| d.join("config.json")).ok_or(AppError::Other(
        "no working directory or binary path set".into(),
    ))
}

/// Returns the parsed config, or None if no config.json exists yet.
#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> AppResult<Option<Config>> {
    let s = state.settings.lock().await.clone();
    let path = config_path(&s)?;
    if !path.exists() {
        return Ok(None);
    }
    Ok(Some(Config::load_from(&path)?))
}

#[derive(serde::Serialize, ts_rs::TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct SaveConfigResult {
    pub config: Config,
    pub running: bool,
}

/// Validate + atomically save the given JSON string as config.json. Returns the
/// parsed config and whether noalbs is currently running.
#[tauri::command]
pub async fn save_config(state: State<'_, AppState>, json: String) -> AppResult<SaveConfigResult> {
    let s = state.settings.lock().await.clone();
    let path = config_path(&s)?;
    let config = Config::save_str(&path, &json)?;
    let running = state.process.lock().await.is_running();
    Ok(SaveConfigResult { config, running })
}

fn env_path(s: &crate::settings::Settings) -> AppResult<PathBuf> {
    let dir = s.working_dir.clone().or_else(|| {
        s.binary_path.as_ref().and_then(|b| b.parent().map(|p| p.to_path_buf()))
    });
    dir.map(|d| d.join(".env")).ok_or(AppError::Other(
        "no working directory or binary path set".into(),
    ))
}

#[tauri::command]
pub async fn get_env(state: State<'_, AppState>) -> AppResult<EnvValues> {
    let s = state.settings.lock().await.clone();
    env_file::read_values(&env_path(&s)?)
}

#[tauri::command]
pub async fn save_env(state: State<'_, AppState>, values: EnvValues) -> AppResult<()> {
    let s = state.settings.lock().await.clone();
    env_file::write_values(&env_path(&s)?, &values)
}

#[derive(serde::Serialize, ts_rs::TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct DashboardSnapshot {
    pub running: bool,
    pub uptime_secs: Option<u64>,
    pub version: Option<String>,
    pub status: NoalbsStatus,
}

#[tauri::command]
pub async fn get_dashboard(state: State<'_, AppState>) -> AppResult<DashboardSnapshot> {
    let version = state.settings.lock().await.installed_version.clone();
    let mut pm = state.process.lock().await;
    pm.poll_exit(); // refresh running + clear uptime if it exited
    let running = pm.is_running();
    let uptime_secs = pm.uptime_secs();
    let status = state.status.lock().unwrap().clone();
    Ok(DashboardSnapshot { running, uptime_secs, version, status })
}
