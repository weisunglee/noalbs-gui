use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("no release asset found for this OS/architecture")]
    NoMatchingAsset,
    #[error("noalbs is not running")]
    NotRunning,
    #[error("noalbs binary not found; download it or set a manual path")]
    BinaryMissing,
    #[error("{0}")]
    Other(String),
}

// Tauri commands must return errors that serialize. We serialize to the message string.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
