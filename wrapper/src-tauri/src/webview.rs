use std::{
  error::Error,
  net::{TcpStream, ToSocketAddrs},
  time::{Duration, Instant},
};
use tauri::{AppHandle, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::webview_preferences;

const PROBE_TIMEOUT: Duration = Duration::from_secs(3);
const CONNECTION_ATTEMPT_TIMEOUT: Duration = Duration::from_millis(1200);
const TARGETS_JSON: &str = include_str!("../../../config/webview-targets.json");

#[derive(serde::Deserialize)]
struct WebviewTarget {
  url: String,
}

fn configured_targets() -> Result<Vec<WebviewTarget>, String> {
  serde_json::from_str(TARGETS_JSON)
    .map_err(|error| format!("The WebView target configuration is invalid: {error}"))
}

fn configured_target_url(url: &str) -> Result<tauri::Url, String> {
  let requested = tauri::Url::parse(url).map_err(|_| "The WebView URL is invalid.".to_string())?;
  let targets = configured_targets()?;
  let is_configured = targets.iter().any(|target| {
    tauri::Url::parse(&target.url)
      .map(|configured| configured == requested)
      .unwrap_or(false)
  });

  is_configured
    .then_some(requested)
    .ok_or_else(|| "The selected URL is not in the configured WebView target list.".to_string())
}

fn startup_target_url(saved_url: Option<&str>) -> Result<tauri::Url, String> {
  let targets = configured_targets()?;
  let selected = saved_url
    .and_then(|saved| targets.iter().find(|target| target.url == saved))
    .or_else(|| targets.first())
    .ok_or_else(|| "No WebView targets are configured.".to_string())?;

  tauri::Url::parse(&selected.url)
    .map_err(|_| "The configured startup WebView URL is invalid.".to_string())
}

pub fn create_main_window(app: &AppHandle) -> Result<(), Box<dyn Error>> {
  let saved_url = webview_preferences::load(app).unwrap_or_else(|error| {
    log::warn!("Could not load the saved WebView target: {error}");
    None
  });
  let target = startup_target_url(saved_url.as_deref()).map_err(std::io::Error::other)?;

  WebviewWindowBuilder::new(app, "main", WebviewUrl::External(target))
    .title("Spfi - Telescope the Shopify storefront in pipeline from one desk")
    .inner_size(1280.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .resizable(true)
    .decorations(false)
    .fullscreen(false)
    .center()
    .build()?;

  Ok(())
}

fn probe_webview_url(url: &str) -> Result<(), String> {
  let parsed = tauri::Url::parse(url).map_err(|_| "The WebView URL is invalid.".to_string())?;
  if !matches!(parsed.scheme(), "http" | "https") {
    return Err("Only HTTP and HTTPS WebView URLs are supported.".to_string());
  }

  let host = parsed
    .host_str()
    .ok_or_else(|| "The WebView URL does not include a host.".to_string())?;
  let port = parsed
    .port_or_known_default()
    .ok_or_else(|| "The WebView URL does not include a usable port.".to_string())?;
  let addresses = (host, port)
    .to_socket_addrs()
    .map_err(|error| format!("Could not resolve {host}: {error}"))?;
  let deadline = Instant::now() + PROBE_TIMEOUT;
  let mut last_error = None;

  for address in addresses {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
      break;
    }

    match TcpStream::connect_timeout(&address, remaining.min(CONNECTION_ATTEMPT_TIMEOUT)) {
      Ok(stream) => {
        drop(stream);
        return Ok(());
      }
      Err(error) => last_error = Some(error),
    }
  }

  Err(format!(
    "Could not connect to {host}:{port}: {}",
    last_error
      .map(|error| error.to_string())
      .unwrap_or_else(|| "connection timed out".to_string())
  ))
}

#[tauri::command]
pub async fn open_webview_url(
  app: AppHandle,
  webview: WebviewWindow,
  url: String,
) -> Result<(), String> {
  let target = configured_target_url(&url)?;
  let probe_url = url.clone();
  tauri::async_runtime::spawn_blocking(move || probe_webview_url(&probe_url))
    .await
    .map_err(|error| format!("WebView connectivity check failed: {error}"))??;

  webview_preferences::save(&app, &url)?;
  webview
    .navigate(target)
    .map_err(|error| format!("Could not open the WebView: {error}"))
}

#[cfg(test)]
mod tests {
  use super::{configured_target_url, probe_webview_url, startup_target_url};
  use std::net::TcpListener;

  #[test]
  fn rejects_non_http_urls() {
    assert!(probe_webview_url("file:///tmp/app.html").is_err());
  }

  #[test]
  fn accepts_a_reachable_http_endpoint() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind test endpoint");
    let address = listener.local_addr().expect("read test endpoint address");

    assert!(probe_webview_url(&format!("http://{address}")).is_ok());
  }

  #[test]
  fn only_accepts_configured_targets() {
    assert!(configured_target_url("http://localhost:3000").is_ok());
    assert!(configured_target_url("https://example.com").is_err());
  }

  #[test]
  fn defaults_to_the_first_configured_target() {
    assert_eq!(
      startup_target_url(None).expect("default target").as_str(),
      "http://localhost:3000/"
    );
  }

  #[test]
  fn restores_a_saved_configured_target() {
    assert_eq!(
      startup_target_url(Some("https://spfi.thuongtruong.me"))
        .expect("saved target")
        .as_str(),
      "https://spfi.thuongtruong.me/"
    );
  }

  #[test]
  fn ignores_a_saved_target_that_is_no_longer_configured() {
    assert_eq!(
      startup_target_url(Some("https://example.com"))
        .expect("fallback target")
        .as_str(),
      "http://localhost:3000/"
    );
  }

  #[test]
  fn webview_navigation_is_enabled_for_local_and_remote_webviews() {
    for capability in [
      include_str!("../capabilities/default.json"),
      include_str!("../capabilities/remote-window-controls.json"),
    ] {
      let value: serde_json::Value =
        serde_json::from_str(capability).expect("capability is valid JSON");
      let permissions = value["permissions"]
        .as_array()
        .expect("capability permissions are an array");

      assert!(permissions
        .iter()
        .any(|permission| permission == "allow-open-webview-url"));
    }

    let permission = include_str!("../permissions/webview.toml");
    assert!(permission.contains("open_webview_url"));
  }
}
