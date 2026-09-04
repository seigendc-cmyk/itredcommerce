mod sidecar;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
        // `tauri dev`'s existing beforeDevCommand (`npm run dev`) already
        // starts a fixed-port Express dev server behind Vite's proxy —
        // unchanged by this addendum. Real per-install separation (own
        // sidecar, own SQLite, own port) applies to release builds, where
        // "install" is a meaningful concept; see sidecar.rs's header.
      } else {
        let handle = app.handle().clone();
        std::thread::spawn(move || {
          if let Err(err) = sidecar::start(&handle) {
            log::error!("[sidecar] failed to start backend: {err}");
          }
        });
      }
      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::Destroyed = event {
        sidecar::stop(window.app_handle());
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
