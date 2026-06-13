use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub enum BinarySource {
    Auto,
    Manual,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub binary_source: BinarySource,
    pub binary_path: Option<PathBuf>,
    pub installed_version: Option<String>,
    pub working_dir: Option<PathBuf>,
    pub check_updates_on_startup: bool,
    #[serde(default)]
    pub theme: Theme,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            binary_source: BinarySource::Auto,
            binary_path: None,
            installed_version: None,
            working_dir: None,
            check_updates_on_startup: true,
            theme: Theme::System,
        }
    }
}

impl Settings {
    /// Load from `path`, or return defaults if the file does not exist.
    pub fn load_from(path: &std::path::Path) -> Result<Self, crate::error::AppError> {
        match std::fs::read_to_string(path) {
            Ok(s) => Ok(serde_json::from_str(&s)?),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(e.into()),
        }
    }

    /// Atomic write: write to a temp file then rename.
    pub fn save_to(&self, path: &std::path::Path) -> Result<(), crate::error::AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_string_pretty(self)?)?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    }
}

/// Resolve the portable data directory for a given executable path. Data lives
/// in a `noalbsgui-data` folder next to the executable. On macOS the binary is
/// inside `Foo.app/Contents/MacOS/`, so the folder is placed next to the `.app`.
pub fn portable_base_for(exe: &std::path::Path) -> PathBuf {
    let mut dir = exe.parent().map(|p| p.to_path_buf()).unwrap_or_default();
    // Climb out of a macOS .app bundle so data sits beside it, not inside it.
    if dir.ends_with("Contents/MacOS") {
        if let Some(p) = dir.ancestors().nth(3) {
            dir = p.to_path_buf();
        }
    }
    dir.join("noalbsgui-data")
}

/// Portable data directory next to the currently running executable.
pub fn portable_base() -> PathBuf {
    let exe = std::env::current_exe().expect("resolve current executable");
    portable_base_for(&exe)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn portable_base_plain_exe() {
        let p = portable_base_for(std::path::Path::new("/opt/noalbsgui/NOALBSGUI"));
        assert_eq!(p, std::path::Path::new("/opt/noalbsgui/noalbsgui-data"));
    }

    #[test]
    fn portable_base_macos_app_bundle() {
        let p = portable_base_for(std::path::Path::new(
            "/Users/me/Downloads/NOALBSGUI.app/Contents/MacOS/NOALBSGUI",
        ));
        assert_eq!(p, std::path::Path::new("/Users/me/Downloads/noalbsgui-data"));
    }

    #[test]
    fn load_missing_returns_default() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let s = Settings::load_from(&path).unwrap();
        assert_eq!(s, Settings::default());
    }

    #[test]
    fn save_then_load_roundtrips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let mut s = Settings::default();
        s.installed_version = Some("2.17.0".to_string());
        s.binary_source = BinarySource::Manual;
        s.theme = Theme::Dark;
        s.save_to(&path).unwrap();
        let loaded = Settings::load_from(&path).unwrap();
        assert_eq!(s, loaded);
    }

    #[test]
    fn missing_theme_defaults_to_system() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, r#"{"binarySource":"auto","binaryPath":null,"installedVersion":null,"workingDir":null,"checkUpdatesOnStartup":true}"#).unwrap();
        let s = Settings::load_from(&path).unwrap();
        assert_eq!(s.theme, Theme::System);
    }
}
