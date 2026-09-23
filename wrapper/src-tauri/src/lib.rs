mod webview;
mod webview_health;
mod webview_preferences;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      webview::create_main_window(app.handle())?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![webview::open_webview_url])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
