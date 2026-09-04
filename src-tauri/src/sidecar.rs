// Spawns this install's own, independent copy of the Express backend as a
// Tauri sidecar and re-points the main window at it. See
// ITRED_GOVERNANCE_AND_ARCHITECTURE.md's "Tauri Desktop Packaging" addendum
// for the full design rationale (DL-002/DL-009's per-install requirement).
//
// Only runs in release builds (`!cfg!(debug_assertions)`) — `tauri dev`
// keeps using its existing `beforeDevCommand` (Vite + a fixed-port Express
// dev server via `npm run dev`), unchanged, so the fast HMR loop isn't
// disturbed by this.

use std::collections::HashMap;
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use rand::Rng;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

pub struct SidecarState {
    pub child: Mutex<Option<CommandChild>>,
}

/// Binds an ephemeral local port, reads back what the OS assigned, then
/// releases it. This is what makes two installs on one machine (dev-only
/// scenario — real installs are one per physical device) collision-free
/// without any coordination between them: each asks the OS independently,
/// at spawn time, for whatever's free right now.
fn find_free_port() -> std::io::Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

/// Optional `KEY=VALUE` overrides an operator can drop next to this
/// install's data directory (e.g. SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
/// FISCAL_CREDENTIALS_KEY — see DL-024, which already treats fiscal-key
/// distribution as a manual, out-of-band step; this file is that mechanism
/// for a packaged install, same discipline, not a new one).
fn read_config_overrides(path: &Path) -> HashMap<String, String> {
    let mut map = HashMap::new();
    if let Ok(contents) = std::fs::read_to_string(path) {
        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                let value = value.trim().trim_matches('"');
                map.insert(key.trim().to_string(), value.to_string());
            }
        }
    }
    map
}

fn install_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    // Dev-only escape hatch for running two "installs" side by side on one
    // machine (e.g. simulating two branch terminals) without a second
    // physical device or a second MSI identity. Real installs never set
    // this — each is already its own OS-level app-data directory.
    if let Ok(instance_id) = std::env::var("ITRED_INSTANCE_ID") {
        if !instance_id.trim().is_empty() {
            dir = dir.join("instances").join(instance_id.trim());
        }
    }
    Ok(dir)
}

fn load_or_create_session_secret(data_dir: &Path) -> std::io::Result<String> {
    let secret_path = data_dir.join(".session_secret");
    if let Ok(existing) = std::fs::read_to_string(&secret_path) {
        let existing = existing.trim().to_string();
        if !existing.is_empty() {
            return Ok(existing);
        }
    }
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill(&mut bytes);
    let secret = bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
    std::fs::write(&secret_path, &secret)?;
    Ok(secret)
}

pub fn start(app: &AppHandle) -> Result<(), String> {
    let data_dir = install_data_dir(app)?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

    let db_dir = data_dir.join("data");
    std::fs::create_dir_all(&db_dir).map_err(|e| e.to_string())?;
    let db_path = db_dir.join("itred.db");

    let port = find_free_port().map_err(|e| e.to_string())?;
    let session_secret = load_or_create_session_secret(&data_dir).map_err(|e| e.to_string())?;
    let overrides = read_config_overrides(&data_dir.join("config.env"));

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("server");
    let server_entry = resource_dir.join("server.mjs");
    let dist_dir = resource_dir.join("dist");

    let mut envs: HashMap<String, String> = HashMap::new();
    envs.insert("NODE_ENV".into(), "production".into());
    envs.insert("API_PORT".into(), port.to_string());
    envs.insert("DB_PATH".into(), db_path.to_string_lossy().into_owned());
    envs.insert("DIST_DIR".into(), dist_dir.to_string_lossy().into_owned());
    envs.insert("SESSION_SECRET".into(), session_secret);
    for (key, value) in overrides {
        envs.insert(key, value);
    }

    log::info!(
        "[sidecar] starting backend: db={:?} port={} resource_dir={:?}",
        db_path,
        port,
        resource_dir
    );

    let (mut rx, child) = app
        .shell()
        .sidecar("itred-server")
        .map_err(|e| e.to_string())?
        .current_dir(resource_dir)
        .envs(envs)
        .args([server_entry.to_string_lossy().into_owned()])
        .spawn()
        .map_err(|e| e.to_string())?;

    app.manage(SidecarState {
        child: Mutex::new(Some(child)),
    });

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    log::info!("[server] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    log::warn!("[server] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Error(err) => {
                    log::error!("[server] spawn error: {err}");
                }
                CommandEvent::Terminated(payload) => {
                    log::warn!("[server] exited: {:?}", payload.code);
                    break;
                }
                _ => {}
            }
        }
    });

    if !wait_for_port(port, Duration::from_secs(20)) {
        return Err(format!(
            "backend did not start listening on 127.0.0.1:{port} within 20s"
        ));
    }

    let url = tauri::Url::parse(&format!("http://127.0.0.1:{port}")).map_err(|e| e.to_string())?;
    if let Some(window) = app.get_webview_window("main") {
        window.navigate(url).map_err(|e| e.to_string())?;
    } else {
        log::warn!("[sidecar] no 'main' window found to navigate to the backend");
    }

    Ok(())
}

/// Called on app exit so a closed window doesn't leave an orphaned
/// server.exe holding the local SQLite file's WAL lock — which would be
/// exactly the kind of thing that bites the two-installs-on-one-machine
/// dev workflow first.
pub fn stop(app: &AppHandle) {
    if let Some(state) = app.try_state::<SidecarState>() {
        if let Ok(mut guard) = state.child.lock() {
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
    }
}
