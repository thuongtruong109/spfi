use std::error::Error;
use tauri::{AppHandle, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::{webview_health, webview_preferences};

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
  let saved_url = saved_url.and_then(|url| tauri::Url::parse(url).ok());
  let selected = saved_url
    .as_ref()
    .and_then(|saved| {
      targets.iter().find(|target| {
        tauri::Url::parse(&target.url)
          .map(|configured| configured == *saved)
          .unwrap_or(false)
      })
    })
    .or_else(|| targets.first())
    .ok_or_else(|| "No WebView targets are configured.".to_string())?;

  tauri::Url::parse(&selected.url)
    .map_err(|_| "The configured startup WebView URL is invalid.".to_string())
}

struct StartupTarget {
  url: tauri::Url,
  is_reachable: bool,
  used_fallback: bool,
}

fn resolve_startup_target<F>(
  saved_url: Option<&str>,
  mut probe: F,
) -> Result<StartupTarget, String>
where
  F: FnMut(&str) -> Result<(), String>,
{
  let preferred = startup_target_url(saved_url)?;
  let mut candidates = vec![preferred.clone()];

  for target in configured_targets()? {
    let candidate = tauri::Url::parse(&target.url)
      .map_err(|_| "The configured startup WebView URL is invalid.".to_string())?;
    if !candidates.contains(&candidate) {
      candidates.push(candidate);
    }
  }

  for candidate in candidates {
    match probe(candidate.as_str()) {
      Ok(()) => {
        return Ok(StartupTarget {
          used_fallback: candidate != preferred,
          url: candidate,
          is_reachable: true,
        });
      }
      Err(error) => log::warn!("WebView endpoint health check failed for {candidate}: {error}"),
    }
  }

  Ok(StartupTarget {
    url: preferred,
    is_reachable: false,
    used_fallback: false,
  })
}

pub fn create_main_window(app: &AppHandle) -> Result<(), Box<dyn Error>> {
  let saved_url = webview_preferences::load(app).unwrap_or_else(|error| {
    log::warn!("Could not load the saved WebView target: {error}");
    None
  });
  let target = resolve_startup_target(saved_url.as_deref(), webview_health::probe_webview_url)
    .map_err(std::io::Error::other)?;

  if target.used_fallback {
    webview_preferences::save(app, target.url.as_str()).unwrap_or_else(|error| {
      log::warn!("Could not save the fallback WebView target: {error}");
    });
  }

  WebviewWindowBuilder::new(app, "main", WebviewUrl::External(target.url))
    .title("Spfi - Telescope the Shopify storefront in pipeline from one desk")
    .inner_size(1280.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .resizable(true)
    .decorations(!target.is_reachable)
    .fullscreen(false)
    .center()
    .build()?;

  Ok(())
}

#[tauri::command]
pub async fn open_webview_url(
  app: AppHandle,
  webview: WebviewWindow,
  url: String,
) -> Result<(), String> {
  let target = configured_target_url(&url)?;
  let probe_url = url.clone();
  tauri::async_runtime::spawn_blocking(move || webview_health::probe_webview_url(&probe_url))
    .await
    .map_err(|error| format!("WebView connectivity check failed: {error}"))??;

  webview
    .navigate(target)
    .map_err(|error| format!("Could not open the WebView: {error}"))?;
  webview_preferences::save(&app, &url)
}

#[cfg(test)]
mod tests {
  use super::{
    configured_target_url, configured_targets, resolve_startup_target, startup_target_url,
  };

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
      startup_target_url(Some("https://spfi.netlify.app"))
        .expect("saved target")
        .as_str(),
      "https://spfi.netlify.app/"
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
  fn falls_back_to_a_reachable_target_at_startup() {
    let target = resolve_startup_target(Some("https://spfi.netlify.app"), |url| {
      if url.starts_with("http://localhost:3000") {
        Ok(())
      } else {
        Err("endpoint is unavailable".to_string())
      }
    })
    .expect("resolve startup target");

    assert_eq!(target.url.as_str(), "http://localhost:3000/");
    assert!(target.is_reachable);
    assert!(target.used_fallback);
  }

  #[test]
  fn keeps_native_decorations_when_every_target_is_unavailable() {
    let target = resolve_startup_target(Some("https://spfi.netlify.app"), |_| {
      Err("endpoint is unavailable".to_string())
    })
    .expect("resolve startup target");

    assert_eq!(target.url.as_str(), "https://spfi.netlify.app/");
    assert!(!target.is_reachable);
    assert!(!target.used_fallback);
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

  #[test]
  fn remote_window_controls_cover_every_configured_target() {
    let capability: serde_json::Value = serde_json::from_str(include_str!(
      "../capabilities/remote-window-controls.json"
    ))
    .expect("remote capability is valid JSON");
    let patterns = capability["remote"]["urls"]
      .as_array()
      .expect("remote capability URLs are an array")
      .iter()
      .map(|value| {
        value
          .as_str()
          .expect("remote capability URL is a string")
          .parse::<tauri::utils::acl::RemoteUrlPattern>()
          .expect("remote capability URL is a valid pattern")
      })
      .collect::<Vec<_>>();

    for target in configured_targets().expect("WebView targets are configured") {
      let url = tauri::Url::parse(&target.url).expect("configured target URL is valid");
      assert!(
        patterns.iter().any(|pattern| pattern.test(&url)),
        "no remote capability URL matches {url}"
      );
    }
  }
}
