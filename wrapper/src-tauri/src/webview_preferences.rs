use std::fs;
use tauri::{AppHandle, Manager};

const SELECTION_FILE: &str = "selected-webview-url";

fn selection_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  app
    .path()
    .app_config_dir()
    .map(|directory| directory.join(SELECTION_FILE))
    .map_err(|error| format!("Could not resolve the app configuration directory: {error}"))
}

pub fn load(app: &AppHandle) -> Result<Option<String>, String> {
  let path = selection_path(app)?;
  match fs::read_to_string(path) {
    Ok(value) => Ok(Some(value.trim().to_string())),
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
    Err(error) => Err(format!("Could not read the saved WebView target: {error}")),
  }
}

pub fn save(app: &AppHandle, url: &str) -> Result<(), String> {
  let path = selection_path(app)?;
  let directory = path
    .parent()
    .ok_or_else(|| "The WebView preference path has no parent directory.".to_string())?;

  fs::create_dir_all(directory)
    .map_err(|error| format!("Could not create the app configuration directory: {error}"))?;
  fs::write(path, url)
    .map_err(|error| format!("Could not save the selected WebView target: {error}"))
}
