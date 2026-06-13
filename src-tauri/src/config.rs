use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::error::AppError;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub user: User,
    pub switcher: Switcher,
    pub software: SoftwareConnection,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any")]
    pub chat: Option<serde_json::Value>,
    #[serde(default)]
    pub optional_scenes: OptionalScenes,
    #[serde(default)]
    pub optional_options: OptionalOptions,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: Option<i64>,
    pub name: String,
    pub password_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct Switcher {
    pub bitrate_switcher_enabled: bool,
    pub only_switch_when_streaming: bool,
    pub instantly_switch_on_recover: bool,
    pub auto_switch_notification: bool,
    pub retry_attempts: u8,
    pub triggers: Triggers,
    pub switching_scenes: SwitchingScenes,
    #[serde(default)]
    #[ts(type = "any[]")]
    pub stream_servers: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct Triggers {
    pub low: Option<u32>,
    pub rtt: Option<u32>,
    pub offline: Option<u32>,
    pub rtt_offline: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct SwitchingScenes {
    pub normal: String,
    pub low: String,
    pub offline: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(tag = "type")]
pub enum SoftwareConnection {
    Obs(ObsConfig),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct ObsConfig {
    pub host: String,
    pub password: Option<String>,
    pub port: u16,
    pub collections: Option<HashMap<String, CollectionPair>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct CollectionPair {
    pub profile: String,
    pub collection: String,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct OptionalScenes {
    pub starting: Option<String>,
    pub ending: Option<String>,
    pub privacy: Option<String>,
    pub refresh: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct OptionalOptions {
    pub twitch_transcoding_check: bool,
    pub twitch_transcoding_retries: u64,
    pub twitch_transcoding_delay_seconds: u64,
    pub offline_timeout: Option<u32>,
    pub record_while_streaming: bool,
    pub switch_to_starting_scene_on_stream_start: bool,
    pub switch_from_starting_scene_to_live_scene: bool,
}

impl Default for OptionalOptions {
    fn default() -> Self {
        Self {
            twitch_transcoding_check: false,
            twitch_transcoding_retries: 5,
            twitch_transcoding_delay_seconds: 15,
            offline_timeout: None,
            record_while_streaming: false,
            switch_to_starting_scene_on_stream_start: false,
            switch_from_starting_scene_to_live_scene: false,
        }
    }
}

impl Config {
    pub fn load_from(path: &Path) -> Result<Self, AppError> {
        let s = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&s)?)
    }

    pub fn save_str(path: &Path, json: &str) -> Result<Self, AppError> {
        let config: Config = serde_json::from_str(json)?;
        Self::write(path, &config)?;
        Ok(config)
    }

    pub fn write(path: &Path, config: &Config) -> Result<(), AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_string_pretty(config)?)?;
        std::fs::rename(&tmp, path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "user": { "id": null, "name": "example", "passwordHash": null },
      "switcher": {
        "bitrateSwitcherEnabled": true,
        "onlySwitchWhenStreaming": false,
        "instantlySwitchOnRecover": true,
        "autoSwitchNotification": true,
        "retryAttempts": 5,
        "triggers": { "low": 500, "rtt": 1000, "offline": 450, "rttOffline": null },
        "switchingScenes": { "normal": "Live", "low": "Low", "offline": "Disconnected" },
        "streamServers": [
          { "streamServer": { "type": "Belabox", "statsUrl": "http://x/stats", "publisher": "p" },
            "name": "BELABOX", "priority": 0, "overrideScenes": null, "dependsOn": null, "enabled": true }
        ]
      },
      "software": { "type": "Obs", "host": "localhost", "password": "pw", "port": 4455,
        "collections": { "twitch": { "profile": "p", "collection": "c" } } },
      "chat": { "platform": "Twitch", "username": "example", "admins": ["a"], "language": "EN", "prefix": "!" },
      "optionalScenes": { "starting": null, "ending": null, "privacy": "privacy", "refresh": null },
      "optionalOptions": { "twitchTranscodingCheck": false, "twitchTranscodingRetries": 5,
        "twitchTranscodingDelaySeconds": 15, "offlineTimeout": null, "recordWhileStreaming": false,
        "switchToStartingSceneOnStreamStart": false, "switchFromStartingSceneToLiveScene": false }
    }"#;

    #[test]
    fn parses_real_sample_config() {
        let c: Config = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(c.user.name, "example");
        assert_eq!(c.switcher.retry_attempts, 5);
        assert_eq!(c.switcher.switching_scenes.normal, "Live");
        assert_eq!(c.switcher.triggers.low, Some(500));
        assert_eq!(c.switcher.stream_servers.len(), 1);
        let SoftwareConnection::Obs(obs) = &c.software;
        assert_eq!(obs.port, 4455);
        assert_eq!(obs.password.as_deref(), Some("pw"));
        assert_eq!(c.optional_scenes.privacy.as_deref(), Some("privacy"));
    }

    #[test]
    fn save_str_validates_and_roundtrips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let saved = Config::save_str(&path, SAMPLE).unwrap();
        assert_eq!(saved.switcher.switching_scenes.low, "Low");
        let reloaded = Config::load_from(&path).unwrap();
        assert_eq!(reloaded, saved);
        assert_eq!(reloaded.switcher.stream_servers[0]["streamServer"]["type"], "Belabox");
    }

    #[test]
    fn save_str_rejects_invalid_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let err = Config::save_str(&path, "{ not valid").unwrap_err();
        assert!(matches!(err, AppError::Json(_)));
        assert!(!path.exists());
    }
}
