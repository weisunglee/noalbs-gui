use std::io::Cursor;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::error::{AppError, AppResult};

pub const REPO: &str = "NOALBS/nginx-obs-automatic-low-bitrate-switching";

const USER_AGENT: &str = "noalbsgui";

/// Fetch the latest release JSON from a GitHub API base URL.
/// `api_base` is normally "https://api.github.com" (overridable in tests).
pub async fn fetch_latest_release(api_base: &str) -> AppResult<Release> {
    let url = format!("{api_base}/repos/{REPO}/releases/latest");
    let client = reqwest::Client::new();
    let release = client
        .get(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await?
        .error_for_status()?
        .json::<Release>()
        .await?;
    Ok(release)
}

/// Download `asset` and extract the `noalbs`/`noalbs.exe` binary into `dest_dir`.
/// Returns the path to the extracted binary.
pub async fn download_and_extract(asset: &ReleaseAsset, dest_dir: &Path) -> AppResult<PathBuf> {
    std::fs::create_dir_all(dest_dir)?;
    let client = reqwest::Client::new();
    let bytes = client
        .get(&asset.url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;

    let bin_name = if cfg!(windows) { "noalbs.exe" } else { "noalbs" };

    // Extraction is CPU- and blocking-IO-heavy (multi-MB archives); run it off
    // the async runtime so it can't stall a Tauri worker thread.
    let is_zip = asset.name.ends_with(".zip");
    let bytes = bytes.to_vec();
    let dest = dest_dir.to_path_buf();
    let out_path = tokio::task::spawn_blocking(move || -> AppResult<PathBuf> {
        let out_path = if is_zip {
            extract_zip(&bytes, bin_name, &dest)?
        } else {
            extract_tar_gz(&bytes, bin_name, &dest)?
        };

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&out_path)?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&out_path, perms)?;
        }

        Ok(out_path)
    })
    .await
    .map_err(|e| AppError::Other(format!("extraction task failed: {e}")))??;

    Ok(out_path)
}

/// Companion files the official archive ships alongside the binary. We extract
/// them so a fresh install has a working config, but never overwrite the user's.
const COMPANIONS: [&str; 2] = ["config.json", ".env"];

fn extract_tar_gz(bytes: &[u8], bin_name: &str, dest_dir: &Path) -> AppResult<PathBuf> {
    let gz = flate2::read::GzDecoder::new(Cursor::new(bytes));
    let mut archive = tar::Archive::new(gz);
    let mut bin_path = None;
    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.into_owned();
        let fname = path.file_name().and_then(|f| f.to_str()).unwrap_or("").to_string();
        if fname == bin_name {
            let out = dest_dir.join(bin_name);
            entry.unpack(&out)?;
            bin_path = Some(out);
        } else if COMPANIONS.contains(&fname.as_str()) {
            let out = dest_dir.join(&fname);
            if !out.exists() {
                entry.unpack(&out)?;
            }
        }
    }
    bin_path.ok_or(AppError::NoMatchingAsset)
}

fn extract_zip(bytes: &[u8], bin_name: &str, dest_dir: &Path) -> AppResult<PathBuf> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))?;
    let mut bin_path = None;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let name = file.name().to_string();
        let base = name.rsplit('/').next().unwrap_or(&name);
        let copy_to = |file: &mut zip::read::ZipFile<'_>, out: &Path| -> AppResult<()> {
            let mut o = std::fs::File::create(out)?;
            std::io::copy(file, &mut o)?;
            Ok(())
        };
        if base == bin_name {
            let out = dest_dir.join(bin_name);
            copy_to(&mut file, &out)?;
            bin_path = Some(out);
        } else if COMPANIONS.contains(&base) {
            let out = dest_dir.join(base);
            if !out.exists() {
                copy_to(&mut file, &out)?;
            }
        }
    }
    bin_path.ok_or(AppError::NoMatchingAsset)
}

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

    use wiremock::matchers::{method, path as wiremock_path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn make_tar_gz_with_noalbs() -> Vec<u8> {
        use std::io::Write;
        let mut tar_buf = Vec::new();
        {
            let mut builder = tar::Builder::new(&mut tar_buf);
            let content = b"#!/bin/sh\necho noalbs\n";
            let mut header = tar::Header::new_gnu();
            header.set_path("noalbs").unwrap();
            header.set_size(content.len() as u64);
            header.set_mode(0o755);
            header.set_cksum();
            builder.append(&header, &content[..]).unwrap();
            builder.finish().unwrap();
        }
        let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        gz.write_all(&tar_buf).unwrap();
        gz.finish().unwrap()
    }

    #[tokio::test]
    async fn fetch_and_download_roundtrip() {
        let server = MockServer::start().await;
        let archive = make_tar_gz_with_noalbs();

        let release_json = serde_json::json!({
            "tag_name": "v2.17.0",
            "assets": [{
                "name": "noalbs-v2.17.0-x86_64-unknown-linux-musl.tar.gz",
                "browser_download_url": format!("{}/download/asset.tar.gz", server.uri())
            }]
        });

        Mock::given(method("GET"))
            .and(wiremock_path(format!("/repos/{REPO}/releases/latest")))
            .respond_with(ResponseTemplate::new(200).set_body_json(&release_json))
            .mount(&server)
            .await;

        Mock::given(method("GET"))
            .and(wiremock_path("/download/asset.tar.gz"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(archive))
            .mount(&server)
            .await;

        let release = fetch_latest_release(&server.uri()).await.unwrap();
        assert_eq!(release.tag_name, "v2.17.0");

        let asset = select_asset(&release.assets, "x86_64-unknown-linux-musl").unwrap();
        let dir = tempfile::tempdir().unwrap();
        let out = download_and_extract(asset, dir.path()).await.unwrap();
        assert!(out.exists());
    }

    /// Build a tar.gz like the official release: a top-level dir containing the
    /// binary plus config.json and .env companions.
    fn make_tar_gz_with_companions() -> Vec<u8> {
        use std::io::Write;
        let mut tar_buf = Vec::new();
        {
            let mut builder = tar::Builder::new(&mut tar_buf);
            let files: [(&str, &[u8]); 3] = [
                ("noalbs-v2.17.0-x/noalbs", b"#!/bin/sh\necho noalbs\n"),
                ("noalbs-v2.17.0-x/config.json", b"{\"fresh\":true}"),
                ("noalbs-v2.17.0-x/.env", b"TWITCH_BOT_USERNAME=example\n"),
            ];
            for (path, content) in files {
                let mut header = tar::Header::new_gnu();
                header.set_path(path).unwrap();
                header.set_size(content.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder.append(&header, content).unwrap();
            }
            builder.finish().unwrap();
        }
        let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        gz.write_all(&tar_buf).unwrap();
        gz.finish().unwrap()
    }

    #[test]
    fn extracts_companions_without_clobbering() {
        let archive = make_tar_gz_with_companions();
        let dir = tempfile::tempdir().unwrap();

        // First extraction: binary + both companions appear.
        let bin = extract_tar_gz(&archive, "noalbs", dir.path()).unwrap();
        assert!(bin.exists());
        assert_eq!(std::fs::read_to_string(dir.path().join("config.json")).unwrap(), "{\"fresh\":true}");
        assert!(dir.path().join(".env").exists());

        // Pre-existing user config must NOT be overwritten on re-extract.
        std::fs::write(dir.path().join("config.json"), "USER EDITED").unwrap();
        extract_tar_gz(&archive, "noalbs", dir.path()).unwrap();
        assert_eq!(std::fs::read_to_string(dir.path().join("config.json")).unwrap(), "USER EDITED");
    }

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
