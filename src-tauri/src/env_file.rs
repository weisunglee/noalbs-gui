use std::path::Path;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::error::AppError;

/// The .env values the GUI manages. Other lines in the file are preserved.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct EnvValues {
    pub twitch_bot_username: Option<String>,
    pub twitch_bot_oauth: Option<String>,
    pub api_port: Option<String>,
    pub log_dir: Option<String>,
}

const MANAGED: [(&str, fn(&EnvValues) -> Option<String>); 4] = [
    ("TWITCH_BOT_USERNAME", |v| v.twitch_bot_username.clone()),
    ("TWITCH_BOT_OAUTH", |v| v.twitch_bot_oauth.clone()),
    ("API_PORT", |v| v.api_port.clone()),
    ("LOG_DIR", |v| v.log_dir.clone()),
];

/// Split a non-comment line into (KEY, VALUE). Returns None for blanks/comments.
fn parse_kv(line: &str) -> Option<(&str, &str)> {
    let trimmed = line.trim_start();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }
    let (k, v) = line.split_once('=')?;
    Some((k.trim(), v))
}

pub fn read_values(path: &Path) -> Result<EnvValues, AppError> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(EnvValues::default()),
        Err(e) => return Err(e.into()),
    };
    let mut v = EnvValues::default();
    for line in content.lines() {
        if let Some((k, val)) = parse_kv(line) {
            match k {
                "TWITCH_BOT_USERNAME" => v.twitch_bot_username = Some(val.to_string()),
                "TWITCH_BOT_OAUTH" => v.twitch_bot_oauth = Some(val.to_string()),
                "API_PORT" => v.api_port = Some(val.to_string()),
                "LOG_DIR" => v.log_dir = Some(val.to_string()),
                _ => {}
            }
        }
    }
    Ok(v)
}

/// Update the managed keys in `path`, preserving all other lines, comments, and
/// ordering. Managed keys present in the file are updated in place; managed keys
/// with a Some value not yet in the file are appended; managed keys set to None
/// are left as-is if absent, or removed if present. Atomic write.
pub fn write_values(path: &Path, values: &EnvValues) -> Result<(), AppError> {
    let existing = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(e.into()),
    };

    let mut out: Vec<String> = Vec::new();
    let mut seen: Vec<&str> = Vec::new();

    for line in existing.lines() {
        match parse_kv(line) {
            Some((k, _)) if MANAGED.iter().any(|(mk, _)| *mk == k) => {
                seen.push(MANAGED.iter().find(|(mk, _)| *mk == k).unwrap().0);
                let getter = MANAGED.iter().find(|(mk, _)| *mk == k).unwrap().1;
                match getter(values) {
                    Some(val) => out.push(format!("{k}={val}")),
                    None => {} // managed key cleared -> drop the line
                }
            }
            _ => out.push(line.to_string()),
        }
    }
    // Append managed keys that have a value but weren't already present.
    for (k, getter) in MANAGED.iter() {
        if !seen.contains(k) {
            if let Some(val) = getter(values) {
                out.push(format!("{k}={val}"));
            }
        }
    }

    let mut content = out.join("\n");
    if !content.is_empty() {
        content.push('\n');
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("env.tmp");
    std::fs::write(&tmp, content)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_missing_returns_default() {
        let dir = tempfile::tempdir().unwrap();
        let v = read_values(&dir.path().join(".env")).unwrap();
        assert_eq!(v, EnvValues::default());
    }

    #[test]
    fn reads_known_keys() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join(".env");
        std::fs::write(&p, "# comment\nTWITCH_BOT_USERNAME=bob\nTWITCH_BOT_OAUTH=oauth:abc\nCUSTOM=1\n").unwrap();
        let v = read_values(&p).unwrap();
        assert_eq!(v.twitch_bot_username.as_deref(), Some("bob"));
        assert_eq!(v.twitch_bot_oauth.as_deref(), Some("oauth:abc"));
        assert_eq!(v.api_port, None);
    }

    #[test]
    fn write_preserves_unknown_lines_and_updates_in_place() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join(".env");
        std::fs::write(&p, "# my notes\nTWITCH_BOT_USERNAME=old\nCUSTOM=keep\n").unwrap();
        let v = EnvValues {
            twitch_bot_username: Some("new".into()),
            twitch_bot_oauth: Some("oauth:x".into()),
            api_port: Some("8080".into()),
            log_dir: None,
        };
        write_values(&p, &v).unwrap();
        let content = std::fs::read_to_string(&p).unwrap();
        assert!(content.contains("# my notes"));
        assert!(content.contains("CUSTOM=keep"));
        assert!(content.contains("TWITCH_BOT_USERNAME=new"));
        assert!(!content.contains("TWITCH_BOT_USERNAME=old"));
        assert!(content.contains("TWITCH_BOT_OAUTH=oauth:x")); // appended
        assert!(content.contains("API_PORT=8080"));            // appended
        // round-trips
        let reread = read_values(&p).unwrap();
        assert_eq!(reread, v);
    }

    #[test]
    fn clearing_a_value_removes_the_line() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join(".env");
        std::fs::write(&p, "API_PORT=8080\nTWITCH_BOT_USERNAME=bob\n").unwrap();
        let v = EnvValues { twitch_bot_username: Some("bob".into()), api_port: None, ..Default::default() };
        write_values(&p, &v).unwrap();
        let content = std::fs::read_to_string(&p).unwrap();
        assert!(!content.contains("API_PORT"));
        assert!(content.contains("TWITCH_BOT_USERNAME=bob"));
    }
}
