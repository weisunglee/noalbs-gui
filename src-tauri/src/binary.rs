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
}
