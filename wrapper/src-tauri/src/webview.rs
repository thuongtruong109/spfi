use std::{
  net::{TcpStream, ToSocketAddrs},
  time::{Duration, Instant},
};
use tauri::WebviewWindow;

const PROBE_TIMEOUT: Duration = Duration::from_secs(3);
const CONNECTION_ATTEMPT_TIMEOUT: Duration = Duration::from_millis(1200);
const TARGETS_JSON: &str = include_str!("../webview-targets.json");
const LAUNCHER_HTML: &str = include_str!("../launcher.html");

#[derive(serde::Deserialize)]
struct WebviewTarget {
  url: String,
}

fn configured_target_url(url: &str) -> Result<tauri::Url, String> {
  let requested = tauri::Url::parse(url).map_err(|_| "The WebView URL is invalid.".to_string())?;
  let targets: Vec<WebviewTarget> = serde_json::from_str(TARGETS_JSON)
    .map_err(|error| format!("The WebView target configuration is invalid: {error}"))?;
  let is_configured = targets.iter().any(|target| {
    tauri::Url::parse(&target.url)
      .map(|configured| configured == requested)
      .unwrap_or(false)
  });

  is_configured
    .then_some(requested)
    .ok_or_else(|| "The selected URL is not in the configured WebView target list.".to_string())
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
pub async fn open_webview_url(webview: WebviewWindow, url: String) -> Result<(), String> {
  let target = configured_target_url(&url)?;
  tauri::async_runtime::spawn_blocking(move || probe_webview_url(&url))
    .await
    .map_err(|error| format!("WebView connectivity check failed: {error}"))??;

  webview
    .navigate(target)
    .map_err(|error| format!("Could not open the WebView: {error}"))
}

#[tauri::command]
pub fn control_window(webview: WebviewWindow, action: String) -> Result<(), String> {
  let result = match action.as_str() {
    "minimize" => webview.minimize(),
    "maximize" => match webview.is_maximized() {
      Ok(true) => webview.unmaximize(),
      Ok(false) => webview.maximize(),
      Err(error) => Err(error),
    },
    "close" => webview.close(),
    _ => return Err("Unknown window action.".to_string()),
  };

  result.map_err(|error| error.to_string())
}

pub fn launcher_response() -> tauri::http::Response<Vec<u8>> {
  let safe_targets = TARGETS_JSON.replace('<', "\\u003c");
  let html = LAUNCHER_HTML.replace("__SPFI_WEBVIEW_TARGETS__", &safe_targets);

  tauri::http::Response::builder()
    .header(
      tauri::http::header::CONTENT_TYPE,
      "text/html; charset=utf-8",
    )
    .body(html.into_bytes())
    .expect("build launcher response")
}

#[cfg(test)]
mod tests {
  use super::{configured_target_url, launcher_response, probe_webview_url};
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
  fn launcher_contains_the_configured_targets() {
    let body = launcher_response().into_body();
    let html = String::from_utf8(body).expect("launcher is UTF-8");

    assert!(html.contains("http://localhost:3000"));
    assert!(!html.contains("__SPFI_WEBVIEW_TARGETS__"));
  }
}
