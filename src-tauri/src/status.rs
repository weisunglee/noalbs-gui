use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub enum ObsConnection {
    Disconnected,
    Connecting,
    Connected,
}

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
#[serde(rename_all = "camelCase")]
pub struct NoalbsStatus {
    pub obs: ObsConnection,
    pub current_scene: Option<String>,
    pub last_switch_type: Option<String>,
    pub switcher_state: Option<String>,
    pub user: Option<String>,
}

impl Default for NoalbsStatus {
    fn default() -> Self {
        Self {
            obs: ObsConnection::Disconnected,
            current_scene: None,
            last_switch_type: None,
            switcher_state: None,
            user: None,
        }
    }
}

/// Update `status` from a single captured log line. Returns true if anything
/// changed. Matches on the message text within tracing's default line format
/// (`<ts> <LEVEL> <target>: <message>`), so it is tolerant of the prefix.
pub fn parse_status_line(line: &str, status: &mut NoalbsStatus) -> bool {
    let before = status.clone();

    if let Some(rest) = line.split("Scene switched to [").nth(1) {
        // rest looks like: `Normal] LIVE`
        if let Some((ty, scene)) = rest.split_once("] ") {
            status.last_switch_type = Some(ty.trim().to_string());
            status.current_scene = Some(scene.trim().to_string());
        }
    } else if let Some(rest) = line.split("Loaded user: ").nth(1) {
        status.user = Some(rest.trim().to_string());
    } else if ends_with_msg(line, "Disconnected") {
        status.obs = ObsConnection::Disconnected;
    } else if ends_with_msg(line, "Connecting") {
        status.obs = ObsConnection::Connecting;
    } else if ends_with_msg(line, "Connected") {
        status.obs = ObsConnection::Connected;
    } else if line.contains("Offline timeout reached") {
        status.switcher_state = Some("Offline timeout — stopping stream".to_string());
    } else if line.contains("Switcher disabled") {
        status.switcher_state = Some("Disabled".to_string());
    } else if line.contains("Waiting for OBS connection") {
        status.switcher_state = Some("Waiting for OBS".to_string());
    } else if line.contains("Waiting till OBS starts streaming") {
        status.switcher_state = Some("Waiting for streaming".to_string());
    } else if line.contains("waiting for scene switch to a switchable scene") {
        status.switcher_state = Some("Waiting for switchable scene".to_string());
    } else if line.contains("Switcher running") || line.contains("Running switcher") {
        status.switcher_state = Some("Running".to_string());
    }

    *status != before
}

/// True if the log line's message (the part after the last "<target>: ") equals
/// `msg` — i.e. the trimmed line ends with `msg`. Disambiguates Connected vs
/// Disconnected (checked in the right order by the caller).
fn ends_with_msg(line: &str, msg: &str) -> bool {
    line.trim_end().ends_with(msg)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(lines: &[&str]) -> NoalbsStatus {
        let mut s = NoalbsStatus::default();
        for l in lines {
            parse_status_line(l, &mut s);
        }
        s
    }

    #[test]
    fn parses_scene_switch() {
        let s = parse(&["2026-06-13T12:00:00Z  INFO noalbs::switcher: Scene switched to [Normal] LIVE"]);
        assert_eq!(s.current_scene.as_deref(), Some("LIVE"));
        assert_eq!(s.last_switch_type.as_deref(), Some("Normal"));
    }

    #[test]
    fn parses_scene_with_spaces() {
        let s = parse(&["...: Scene switched to [Offline] My BRB Scene"]);
        assert_eq!(s.current_scene.as_deref(), Some("My BRB Scene"));
        assert_eq!(s.last_switch_type.as_deref(), Some("Offline"));
    }

    #[test]
    fn obs_connection_transitions() {
        let mut s = NoalbsStatus::default();
        assert_eq!(s.obs, ObsConnection::Disconnected);
        parse_status_line("... INFO noalbs::broadcasting_software::obs_v5: Connecting", &mut s);
        assert_eq!(s.obs, ObsConnection::Connecting);
        parse_status_line("... INFO noalbs::broadcasting_software::obs_v5: Connected", &mut s);
        assert_eq!(s.obs, ObsConnection::Connected);
        parse_status_line("... WARN noalbs::broadcasting_software::obs_v5: Disconnected", &mut s);
        assert_eq!(s.obs, ObsConnection::Disconnected);
    }

    #[test]
    fn disconnected_not_misread_as_connected() {
        let mut s = NoalbsStatus::default();
        s.obs = ObsConnection::Connected;
        let changed = parse_status_line("... WARN ...obs_v5: Disconnected", &mut s);
        assert!(changed);
        assert_eq!(s.obs, ObsConnection::Disconnected);
    }

    #[test]
    fn parses_user_and_switcher_state() {
        let s = parse(&[
            "... INFO noalbs::noalbs: Loaded user: b3ck",
            "... INFO noalbs::switcher: Switcher running",
        ]);
        assert_eq!(s.user.as_deref(), Some("b3ck"));
        assert_eq!(s.switcher_state.as_deref(), Some("Running"));
    }

    #[test]
    fn unmatched_line_does_not_change() {
        let mut s = NoalbsStatus::default();
        let changed = parse_status_line("... INFO noalbs: some unrelated line", &mut s);
        assert!(!changed);
    }
}
