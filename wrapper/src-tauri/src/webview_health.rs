use std::time::Duration;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(6);
const MAX_REDIRECTS: u32 = 5;

pub fn probe_webview_url(url: &str) -> Result<(), String> {
  let parsed = tauri::Url::parse(url).map_err(|_| "The WebView URL is invalid.".to_string())?;
  if !matches!(parsed.scheme(), "http" | "https") {
    return Err("Only HTTP and HTTPS WebView URLs are supported.".to_string());
  }

  let client: ureq::Agent = ureq::Agent::config_builder()
    .timeout_connect(Some(CONNECT_TIMEOUT))
    .timeout_global(Some(REQUEST_TIMEOUT))
    .max_redirects(MAX_REDIRECTS)
    .build()
    .into();

  let response = client
    .get(parsed.as_str())
    .header(
      "User-Agent",
      concat!("Spfi/", env!("CARGO_PKG_VERSION"), " endpoint-check"),
    )
    .call()
    .map_err(|error| match error {
      ureq::Error::StatusCode(status) => format!("{url} returned HTTP {status}."),
      _ => format!("Could not load {url}: {error}"),
    })?;
  let status = response.status();

  if status.is_success() {
    Ok(())
  } else {
    Err(format!("{url} returned HTTP {status}."))
  }
}

#[cfg(test)]
mod tests {
  use super::probe_webview_url;
  use std::{
    io::{Read, Write},
    net::TcpListener,
    thread::{self, JoinHandle},
    time::Duration,
  };

  fn serve_once(status: &'static str) -> (String, JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind test endpoint");
    let address = listener.local_addr().expect("read test endpoint address");
    let server = thread::spawn(move || {
      let (mut stream, _) = listener.accept().expect("accept health-check request");
      stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .expect("set request read timeout");

      let mut request = [0; 1024];
      let _ = stream.read(&mut request);
      write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
      )
      .expect("write health-check response");
    });

    (format!("http://{address}"), server)
  }

  #[test]
  fn rejects_non_http_urls() {
    assert!(probe_webview_url("file:///tmp/app.html").is_err());
  }

  #[test]
  fn accepts_a_successful_http_response() {
    let (url, server) = serve_once("200 OK");

    assert!(probe_webview_url(&url).is_ok());
    server.join().expect("health-check server exits cleanly");
  }

  #[test]
  fn rejects_an_http_error_response() {
    let (url, server) = serve_once("503 Service Unavailable");

    let error = probe_webview_url(&url).expect_err("HTTP errors are rejected");
    assert!(error.contains("HTTP 503"));
    server.join().expect("health-check server exits cleanly");
  }
}
