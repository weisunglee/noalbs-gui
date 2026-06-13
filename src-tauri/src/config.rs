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
    pub chat: Option<Chat>,
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
    pub stream_servers: Vec<StreamServerEntry>,
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

// ── Stream server types ────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct StreamServerEntry {
    pub stream_server: StreamServerKind,
    pub name: String,
    pub priority: Option<i32>,
    pub override_scenes: Option<SwitchingScenes>,
    pub depends_on: Option<DependsOn>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct DependsOn {
    pub name: String,
    pub backup_scenes: SwitchingScenes,
}

/// Auth used by NodeMediaServer and Mediamtx.
/// No rename_all — fields serialise as "username" / "password" (already lowercase).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct ServerAuth {
    pub username: String,
    pub password: String,
}

/// Each variant wraps a config struct so that `rename_all = "camelCase"` can be
/// applied per-struct rather than to the enum (which would also rename variant names).
/// The tag `"type"` uses the variant name as-is (PascalCase) matching NOALBS v2.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(tag = "type")]
pub enum StreamServerKind {
    Nginx(NginxConfig),
    NodeMediaServer(NodeMediaServerConfig),
    Nimble(NimbleConfig),
    SrtLiveServer(SrtLiveServerConfig),
    Belabox(BelaboxConfig),
    Mediamtx(MediamtxConfig),
    Rist(RistConfig),
    Xiu(XiuConfig),
    #[serde(rename = "OpenIRL")]
    OpenIrl(OpenIrlConfig),
    Irlhosting(IrlhostingConfig),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct NginxConfig {
    pub stats_url: String,
    pub application: String,
    pub key: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct NodeMediaServerConfig {
    pub stats_url: String,
    pub application: String,
    pub key: String,
    pub auth: Option<ServerAuth>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct NimbleConfig {
    pub stats_url: String,
    pub id: String,
    pub application: String,
    pub key: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct SrtLiveServerConfig {
    pub stats_url: String,
    pub publisher: String,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct BelaboxConfig {
    pub stats_url: String,
    pub publisher: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct MediamtxConfig {
    pub stats_url: String,
    pub auth: Option<ServerAuth>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct RistConfig {
    pub stats_url: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct XiuConfig {
    pub stats_url: String,
    pub application: String,
    pub key: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct OpenIrlConfig {
    pub stats_url: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct IrlhostingConfig {
    pub stats_url: String,
    pub application: Option<String>,
    pub key: Option<String>,
    pub publisher: Option<String>,
}

// ── Chat types ─────────────────────────────────────────────────────────────────

/// Matches NOALBS v2 `config::Chat` with `#[serde(rename_all = "camelCase", default)]`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase", default)]
pub struct Chat {
    pub platform: ChatPlatform,
    pub username: String,
    pub admins: Vec<String>,
    pub ignore_users: Vec<String>,
    pub language: String,
    pub prefix: String,
    pub enable_public_commands: bool,
    pub enable_mod_commands: bool,
    pub enable_auto_stop_stream_on_host_or_raid: bool,
    pub announce_raid_on_auto_stop: bool,
    pub commands: Option<HashMap<String, CommandInfo>>,
}

impl Default for Chat {
    fn default() -> Self {
        Self {
            platform: ChatPlatform::Twitch,
            username: String::new(),
            admins: Vec::new(),
            ignore_users: Vec::new(),
            language: "EN".to_string(),
            prefix: "!".to_string(),
            enable_public_commands: true,
            enable_mod_commands: true,
            enable_auto_stop_stream_on_host_or_raid: false,
            announce_raid_on_auto_stop: false,
            commands: None,
        }
    }
}

/// External tagging — `"Twitch"` or `{"Kick": {...}}`.
/// Matches NOALBS v2 `config::ConfigChatPlatform` (no `#[serde(tag)]`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub enum ChatPlatform {
    Twitch,
    Kick(KickConfig),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct KickConfig {
    pub channel_id: Option<usize>,
    pub chatroom_id: Option<usize>,
    pub use_irlproxy: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct CommandInfo {
    pub permission: Option<String>,
    pub user_permissions: Option<Vec<String>>,
    pub alias: Option<Vec<String>>,
}

// ── Config I/O ─────────────────────────────────────────────────────────────────

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

    // The complete example config.json from the NOALBS v2 README.
    // Note: the README example sets `rttOffline: 3500` (not null), includes all chat fields,
    // and has commands with optional fields.
    // We normalise two things to make round-trip work:
    //   1. The README omits `ignoreUsers` — our Chat default fills it as `[]`; we add it back.
    //   2. `"Switch"` command in README omits `"userPermissions"` — our CommandInfo Default
    //      leaves it as `None` which serialises as `null`; we add `"userPermissions": null`.
    //   3. `"Bitrate"` command omits `"userPermissions"` — same fix.
    // These match what NOALBS itself would emit (it uses `Default` + `skip_serializing_if` for
    // None fields in CommandInfo — but noalbs does NOT use skip_serializing_if on CommandInfo,
    // so null fields ARE emitted). We keep our model consistent with that.
    const FULL_SAMPLE: &str = r#"{
  "user": {
    "id": null,
    "name": "example",
    "passwordHash": null
  },
  "switcher": {
    "bitrateSwitcherEnabled": true,
    "onlySwitchWhenStreaming": false,
    "instantlySwitchOnRecover": true,
    "autoSwitchNotification": true,
    "retryAttempts": 5,
    "triggers": {
      "low": 500,
      "rtt": 1000,
      "offline": 450,
      "rttOffline": 3500
    },
    "switchingScenes": {
      "normal": "Live",
      "low": "Low",
      "offline": "Disconnected"
    },
    "streamServers": [
      {
        "streamServer": {
          "type": "Belabox",
          "statsUrl": "http://example.com/stats",
          "publisher": "example"
        },
        "name": "BELABOX cloud",
        "priority": 0,
        "overrideScenes": null,
        "dependsOn": null,
        "enabled": true
      }
    ]
  },
  "software": {
    "type": "Obs",
    "host": "localhost",
    "password": "example",
    "port": 4455,
    "collections": {
      "twitch": {
        "profile": "twitch_profile",
        "collection": "twitch_scenes"
      },
      "kick": {
        "profile": "kick_profile",
        "collection": "kick_scenes"
      }
    }
  },
  "chat": {
    "platform": "Twitch",
    "username": "example",
    "admins": [
      "username1",
      "username2",
      "username3"
    ],
    "ignoreUsers": [],
    "language": "EN",
    "prefix": "!",
    "enablePublicCommands": false,
    "enableModCommands": true,
    "enableAutoStopStreamOnHostOrRaid": true,
    "announceRaidOnAutoStop": true,
    "commands": {
      "Fix": {
        "permission": null,
        "userPermissions": ["715209"],
        "alias": [
          "f"
        ]
      },
      "Switch": {
        "permission": "Mod",
        "userPermissions": null,
        "alias": [
          "ss"
        ]
      },
      "Bitrate": {
        "permission": null,
        "userPermissions": null,
        "alias": [
          "b"
        ]
      }
    }
  },
  "optionalScenes": {
    "starting": null,
    "ending": null,
    "privacy": "privacy",
    "refresh": null
  },
  "optionalOptions": {
    "twitchTranscodingCheck": false,
    "twitchTranscodingRetries": 5,
    "twitchTranscodingDelaySeconds": 15,
    "offlineTimeout": null,
    "recordWhileStreaming": false,
    "switchToStartingSceneOnStreamStart": false,
    "switchFromStartingSceneToLiveScene": false
  }
}"#;

    #[test]
    fn parses_real_sample_config() {
        let c: Config = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(c.user.name, "example");
        assert_eq!(c.switcher.retry_attempts, 5);
        assert_eq!(c.switcher.switching_scenes.normal, "Live");
        assert_eq!(c.switcher.triggers.low, Some(500));
        assert_eq!(c.switcher.stream_servers.len(), 1);
        // Typed assertion on the first stream server
        assert!(matches!(
            &c.switcher.stream_servers[0].stream_server,
            StreamServerKind::Belabox(BelaboxConfig { stats_url, publisher })
            if stats_url == "http://x/stats" && publisher == "p"
        ));
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
        // Typed assertion instead of opaque JSON indexing
        assert!(matches!(
            &reloaded.switcher.stream_servers[0].stream_server,
            StreamServerKind::Belabox(_)
        ));
    }

    #[test]
    fn save_str_rejects_invalid_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        let err = Config::save_str(&path, "{ not valid").unwrap_err();
        assert!(matches!(err, AppError::Json(_)));
        assert!(!path.exists());
    }

    #[test]
    fn full_config_roundtrips_structurally() {
        let original: serde_json::Value = serde_json::from_str(FULL_SAMPLE).unwrap();
        let config: Config = serde_json::from_value(original.clone()).unwrap();
        let reserialized = serde_json::to_value(&config).unwrap();
        assert_eq!(original, reserialized, "config did not round-trip identically");
    }
}
