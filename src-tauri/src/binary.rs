use serde::Deserialize;

pub const REPO: &str = "NOALBS/nginx-obs-automatic-low-bitrate-switching";

/// Returns the Rust target-triple substring present in the release asset name
/// for the current OS/architecture, or None if unsupported.
pub fn current_target() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => Some("aarch64-apple-darwin"),
        ("macos", "x86_64") => Some("x86_64-apple-darwin"),
        ("windows", "x86_64") => Some("x86_64-pc-windows-msvc"),
        ("linux", "x86_64") => Some("x86_64-unknown-linux-musl"),
        _ => None,
    }
}

/// Pick the asset whose name contains the given target triple.
pub fn select_asset<'a>(assets: &'a [ReleaseAsset], target: &str) -> Option<&'a ReleaseAsset> {
    assets.iter().find(|a| a.name.contains(target))
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct ReleaseAsset {
    pub name: String,
    #[serde(rename = "browser_download_url")]
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Release {
    pub tag_name: String,
    pub assets: Vec<ReleaseAsset>,
}

/// Parse a semver version (e.g. "2.17.0") from a noalbs startup banner line
/// such as "...╝ v2.17.0".
pub fn parse_version_from_banner(line: &str) -> Option<String> {
    let idx = line.find('v')?;
    let rest = &line[idx + 1..];
    let ver: String = rest
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    if ver.split('.').count() == 3 && semver::Version::parse(&ver).is_ok() {
        Some(ver)
    } else {
        None
    }
}

/// Normalize a release tag like "v2.17.0" to "2.17.0".
pub fn normalize_tag(tag: &str) -> &str {
    tag.strip_prefix('v').unwrap_or(tag)
}

/// True when `latest` (tag or version) is strictly newer than `installed`.
pub fn is_update_available(latest_tag: &str, installed: &str) -> bool {
    let latest = semver::Version::parse(normalize_tag(latest_tag));
    let cur = semver::Version::parse(normalize_tag(installed));
    match (latest, cur) {
        (Ok(l), Ok(c)) => l > c,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assets() -> Vec<ReleaseAsset> {
        ["aarch64-apple-darwin.tar.gz", "x86_64-apple-darwin.tar.gz",
         "x86_64-pc-windows-msvc.zip", "x86_64-unknown-linux-musl.tar.gz"]
            .iter()
            .map(|n| ReleaseAsset {
                name: format!("noalbs-v2.17.0-{n}"),
                url: format!("https://example.com/{n}"),
            })
            .collect()
    }

    #[test]
    fn selects_windows_zip() {
        let binding = assets();
        let a = select_asset(&binding, "x86_64-pc-windows-msvc").unwrap();
        assert!(a.name.ends_with(".zip"));
        assert!(a.name.contains("x86_64-pc-windows-msvc"));
    }

    #[test]
    fn selects_mac_arm() {
        let binding = assets();
        let a = select_asset(&binding, "aarch64-apple-darwin").unwrap();
        assert!(a.name.contains("aarch64-apple-darwin"));
    }

    #[test]
    fn unknown_target_returns_none() {
        assert!(select_asset(&assets(), "powerpc-unknown-linux").is_none());
    }

    #[test]
    fn current_target_is_known_on_test_host() {
        assert!(current_target().is_some());
    }

    #[test]
    fn parses_version_from_banner() {
        let line = "    ╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝ ╚══════╝ v2.17.0";
        assert_eq!(parse_version_from_banner(line).as_deref(), Some("2.17.0"));
    }

    #[test]
    fn banner_without_version_is_none() {
        assert!(parse_version_from_banner("just some log line").is_none());
    }

    #[test]
    fn update_available_when_newer() {
        assert!(is_update_available("v2.18.0", "2.17.0"));
        assert!(is_update_available("2.17.1", "2.17.0"));
    }

    #[test]
    fn no_update_when_same_or_older() {
        assert!(!is_update_available("v2.17.0", "2.17.0"));
        assert!(!is_update_available("v2.16.0", "2.17.0"));
    }
}
