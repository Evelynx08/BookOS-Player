#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mpris;
mod bookos_activity;

use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use base64::{engine::general_purpose, Engine as _};
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::ItemKey;
use walkdir::WalkDir;
use serde::{Deserialize, Serialize};

// Tauri usa `log::error!` internamente (por ejemplo el protocolo asset://
// cuando un archivo da 403/404) pero sin un logger instalado esos mensajes
// se pierden en silencio — nunca aparecían en la terminal de
// `cargo tauri dev`, así que un fallo de asset:// quedaba invisible.
struct StderrLogger;
impl log::Log for StderrLogger {
    fn enabled(&self, _metadata: &log::Metadata) -> bool { true }
    fn log(&self, record: &log::Record) {
        eprintln!("[{}] {}", record.level(), record.args());
    }
    fn flush(&self) {}
}
static LOGGER: StderrLogger = StderrLogger;

fn config_path() -> PathBuf {
    let mut p = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    p.push("bookos-player");
    let _ = fs::create_dir_all(&p);
    p.push("state.json");
    p
}

#[tauri::command]
fn load_state() -> serde_json::Value {
    let p = config_path();
    if let Ok(s) = fs::read_to_string(&p) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
            return v;
        }
    }
    serde_json::json!({
        "theme": "auto",
        "visual": "oled",
        "playlists": [],
        "music_folders": [],
        "volume": 1.0,
        "queue": [],
        "current_index": -1,
        "shuffle": false,
        "repeat": "none"
    })
}

#[tauri::command]
fn save_state(state: serde_json::Value) -> Result<(), String> {
    let p = config_path();
    let s = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&p, s).map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize, Clone)]
struct TrackMeta {
    path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    album_artist: Option<String>,
    year: Option<u32>,
    track_number: Option<u32>,
    duration: Option<f64>,
    cover: Option<String>,
    genre: Option<String>,
}

#[tauri::command]
fn read_track_meta(path: String) -> TrackMeta {
    read_track_meta_inner(path, true)
}

/// Lee los metadatos de una pista. `with_cover` decide si además se decodifica
/// la carátula embebida a base64, que es con diferencia la parte cara: una
/// portada ronda cientos de KB y se convierte a texto. Escanear la biblioteca
/// entera con carátulas es lo que dejaba la ventana invisible varios minutos.
fn read_track_meta_inner(path: String, with_cover: bool) -> TrackMeta {
    let mut meta = TrackMeta {
        path: path.clone(),
        title: None,
        artist: None,
        album: None,
        album_artist: None,
        year: None,
        track_number: None,
        duration: None,
        cover: None,
        genre: None,
    };

    // Filename fallback for title
    let filename_title = std::path::Path::new(&path)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string());

    if let Ok(tagged) = Probe::open(&path).and_then(|p| p.read()) {
        // Duration
        let props = tagged.properties();
        meta.duration = Some(props.duration().as_secs_f64());

        if let Some(tag) = tagged.primary_tag() {
            meta.title = tag.get_string(&ItemKey::TrackTitle).map(str::to_string);
            meta.artist = tag.get_string(&ItemKey::TrackArtist).map(str::to_string);
            meta.album = tag.get_string(&ItemKey::AlbumTitle).map(str::to_string);
            meta.album_artist = tag.get_string(&ItemKey::AlbumArtist).map(str::to_string);
            meta.genre = tag.get_string(&ItemKey::Genre).map(str::to_string);
            meta.year = tag.year();
            meta.track_number = tag.track();

            // Cover art
            if with_cover {
            if let Some(pic) = tag.pictures().first() {
                let data: &[u8] = pic.data();
                let b64 = general_purpose::STANDARD.encode(data);
                let mime = pic.mime_type()
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_else(|| "image/jpeg".to_string());
                meta.cover = Some(format!("data:{};base64,{}", mime, b64));
            }
            }
        }
    }

    if meta.title.is_none() {
        meta.title = filename_title;
    }

    meta
}

const AUDIO_EXTS: [&str; 10] = ["mp3", "flac", "ogg", "opus", "m4a", "aac", "wav", "wv", "ape", "mpc"];

/// Escanea una carpeta y devuelve las pistas **sin carátula**.
///
/// `async` + `spawn_blocking`: recorrer el disco y leer etiquetas es trabajo
/// bloqueante, y hacerlo en el hilo del IPC congelaba la ventana entera. Las
/// carátulas se piden después con `read_covers`, para que la lista aparezca
/// enseguida en vez de esperar a decodificar la biblioteca completa a base64.
#[tauri::command]
async fn scan_folder(folder: String) -> Vec<TrackMeta> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut tracks = Vec::new();

        for entry in WalkDir::new(&folder).follow_links(true).into_iter().filter_map(|e| e.ok()) {
            if !entry.file_type().is_file() { continue; }
            let path = entry.path();
            let ext = path.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            if AUDIO_EXTS.contains(&ext.as_str()) {
                tracks.push(read_track_meta_inner(path.to_string_lossy().to_string(), false));
            }
        }

        tracks.sort_by(|a, b| {
            let ta = a.title.as_deref().unwrap_or("");
            let tb = b.title.as_deref().unwrap_or("");
            ta.cmp(tb)
        });

        tracks
    })
    .await
    .unwrap_or_default()
}

/// Carátulas de un lote de pistas, en base64. Se llama por trozos desde el
/// frontend una vez la lista ya está a la vista.
#[tauri::command]
async fn read_covers(paths: Vec<String>) -> Vec<(String, Option<String>)> {
    tauri::async_runtime::spawn_blocking(move || {
        paths
            .into_iter()
            .map(|p| {
                let cover = read_track_meta_inner(p.clone(), true).cover;
                (p, cover)
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

/// Lee una imagen arbitraria (portada de lista) y la devuelve como data URL
/// para guardarla directo en el estado — mismo patrón que las carátulas de
/// pista, que ya viajan como `data:` en vez de un path a un archivo que
/// podría moverse o borrarse.
#[tauri::command]
async fn read_image_as_data_url(path: String) -> Result<String, String> {
    // Leer + codificar a base64 en el hilo del IPC congelaba la ventana
    // unos segundos con imágenes grandes — mismo motivo por el que
    // scan_folder/read_covers ya usan spawn_blocking.
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = fs::read(&path).map_err(|e| e.to_string())?;
        let mime = mime_guess::from_path(&path).first_or_octet_stream().to_string();
        let b64 = general_purpose::STANDARD.encode(&bytes);
        Ok(format!("data:{};base64,{}", mime, b64))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn detect_system_theme() -> String {
    // Try KDE plasma color scheme
    if let Ok(out) = std::process::Command::new("kreadconfig5")
        .args(["--group", "General", "--key", "ColorScheme"])
        .output()
    {
        let s = String::from_utf8_lossy(&out.stdout).to_lowercase();
        if s.contains("dark") { return "dark".to_string(); }
        if s.contains("light") { return "light".to_string(); }
    }
    // Try GNOME
    if let Ok(out) = std::process::Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "color-scheme"])
        .output()
    {
        let s = String::from_utf8_lossy(&out.stdout).to_lowercase();
        if s.contains("dark") { return "dark".to_string(); }
    }
    "dark".to_string()
}


use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::sync::atomic::{AtomicU16, Ordering};

static SERVER_PORT: AtomicU16 = AtomicU16::new(0);

#[tauri::command]
fn get_server_port() -> u16 {
    SERVER_PORT.load(Ordering::Relaxed)
}

fn decode_component(s: &str) -> String {
    // Decodifica lo mismo que `encodeURIComponent` del lado JS produce —
    // ahí un '+' literal en un nombre de archivo se manda como %2B, no
    // como '+' suelto, así que un '+' que llegue acá es literal (no un
    // espacio "application/x-www-form-urlencoded" como en un <form>).
    let mut bytes = Vec::new();
    let mut chars = s.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            if let (Some(h1), Some(h2)) = (chars.next(), chars.next()) {
                if let Ok(val) = u8::from_str_radix(std::str::from_utf8(&[h1, h2]).unwrap_or(""), 16) {
                    bytes.push(val);
                    continue;
                }
            }
        }
        bytes.push(b);
    }
    String::from_utf8_lossy(&bytes).to_string()
}

fn handle_http_connection(socket: &mut std::net::TcpStream) -> std::io::Result<()> {
    let mut reader = BufReader::new(socket.try_clone()?);
    let mut request_line = String::new();
    if reader.read_line(&mut request_line)? == 0 {
        return Ok(());
    }

    let mut range_header: Option<String> = None;
    loop {
        let mut line = String::new();
        let bytes_read = reader.read_line(&mut line)?;
        if bytes_read == 0 || line == "\r\n" || line == "\n" {
            break;
        }
        if line.to_lowercase().starts_with("range:") {
            range_header = Some(line.trim().to_string());
        }
    }

    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 || parts[0] != "GET" {
        let resp = "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n";
        socket.write_all(resp.as_bytes())?;
        return Ok(());
    }

    let uri = parts[1];
    let file_path_str = if let Some(idx) = uri.find("path=") {
        let raw_path = &uri[idx + 5..];
        let raw_path = raw_path.split('&').next().unwrap_or(raw_path);
        decode_component(raw_path)
    } else {
        let resp = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n";
        socket.write_all(resp.as_bytes())?;
        return Ok(());
    };

    let path = std::path::Path::new(&file_path_str);
    let mut file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => {
            let resp = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
            socket.write_all(resp.as_bytes())?;
            return Ok(());
        }
    };

    let file_size = file.metadata()?.len();
    if file_size == 0 {
        let resp = "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n";
        socket.write_all(resp.as_bytes())?;
        return Ok(());
    }

    let mime = mime_guess::from_path(path).first_or_octet_stream().to_string();

    let mut range_start: Option<u64> = None;
    let mut range_end: Option<u64> = None;

    if let Some(ref r_hdr) = range_header {
        if let Some(bytes_spec) = r_hdr.split('=').nth(1) {
            let parts: Vec<&str> = bytes_spec.trim().split('-').collect();
            if parts.len() >= 2 && parts[0].is_empty() && !parts[1].is_empty() {
                // Rango de sufijo: "bytes=-500" = "los últimos 500 bytes".
                // GStreamer/WebKit lo usan para leer metadata de cola sin
                // bajar el archivo entero (más notorio en FLAC, mucho más
                // pesado que mp3) — sin este caso, caía al `else` de abajo
                // y devolvía el archivo COMPLETO con 200 en vez de la cola
                // con 206, lo cual confundía al demuxer a mitad de stream.
                if let Ok(suffix_len) = parts[1].parse::<u64>() {
                    let start = file_size.saturating_sub(suffix_len);
                    range_start = Some(start);
                    range_end = Some(file_size - 1);
                }
            } else if !parts.is_empty() {
                if let Ok(s) = parts[0].parse::<u64>() {
                    range_start = Some(s);
                }
                if parts.len() > 1 && !parts[1].is_empty() {
                    if let Ok(e) = parts[1].parse::<u64>() {
                        range_end = Some(e);
                    }
                }
            }
        }
    }

    if let Some(start) = range_start {
        let start = start.min(file_size - 1);
        let end = range_end.unwrap_or(file_size - 1).min(file_size - 1);
        if start > end {
            let resp = format!("HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */{}\r\n\r\n", file_size);
            socket.write_all(resp.as_bytes())?;
            return Ok(());
        }
        let content_length = end - start + 1;
        file.seek(SeekFrom::Start(start))?;

        let header = format!(
            "HTTP/1.1 206 Partial Content\r\n\
             Content-Type: {}\r\n\
             Content-Length: {}\r\n\
             Content-Range: bytes {}-{}/{}\r\n\
             Accept-Ranges: bytes\r\n\
             Access-Control-Allow-Origin: *\r\n\
             Connection: close\r\n\r\n",
            mime, content_length, start, end, file_size
        );
        socket.write_all(header.as_bytes())?;

        let mut buffer = [0u8; 65536];
        let mut remaining = content_length;
        while remaining > 0 {
            let to_read = (remaining as usize).min(buffer.len());
            let n = file.read(&mut buffer[..to_read])?;
            if n == 0 { break; }
            if socket.write_all(&buffer[..n]).is_err() { break; }
            remaining -= n as u64;
        }
    } else {
        let header = format!(
            "HTTP/1.1 200 OK\r\n\
             Content-Type: {}\r\n\
             Content-Length: {}\r\n\
             Accept-Ranges: bytes\r\n\
             Access-Control-Allow-Origin: *\r\n\
             Connection: close\r\n\r\n",
            mime, file_size
        );
        socket.write_all(header.as_bytes())?;

        let mut buffer = [0u8; 65536];
        let mut remaining = file_size;
        while remaining > 0 {
            let to_read = (remaining as usize).min(buffer.len());
            let n = file.read(&mut buffer[..to_read])?;
            if n == 0 { break; }
            if socket.write_all(&buffer[..n]).is_err() { break; }
            remaining -= n as u64;
        }
    }

    Ok(())
}

/// Respaldo si el servidor local falla: lee el archivo entero y lo manda por IPC para armar un Blob en el frontend.
#[tauri::command]
fn read_audio_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

// El servidor MPRIS se crea una sola vez, en el setup de Tauri (hace falta el
// AppHandle para poder mandar ordenes de vuelta al front).
static MPRIS: OnceLock<mpris::Mpris> = OnceLock::new();

/// El front empuja aquí su estado en cada cambio de pista, cola o ajuste.
#[tauri::command]
async fn mpris_publish(state: mpris::PlayerState) -> Result<(), String> {
    let Some(m) = MPRIS.get() else { return Ok(()) };
    m.publish(state).await.map_err(|e| e.to_string())
}

/// Los favoritos van aparte: el corazón cambia sin que cambie nada más.
#[tauri::command]
async fn mpris_favorite(path: String, value: bool) -> Result<(), String> {
    let Some(m) = MPRIS.get() else { return Ok(()) };
    m.publish_favorite(&path, value).await.map_err(|e| e.to_string())
}

fn main() {
    log::set_logger(&LOGGER).ok();
    log::set_max_level(log::LevelFilter::Debug);

    if let Ok(listener) = std::net::TcpListener::bind("127.0.0.1:0") {
        if let Ok(addr) = listener.local_addr() {
            SERVER_PORT.store(addr.port(), Ordering::Relaxed);
            std::thread::spawn(move || {
                for stream in listener.incoming() {
                    if let Ok(mut socket) = stream {
                        std::thread::spawn(move || {
                            let _ = handle_http_connection(&mut socket);
                        });
                    }
                }
            });
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            bookos_palette_css,
            load_state,
            save_state,
            read_track_meta,
            scan_folder,
            read_covers,
            detect_system_theme,
            read_audio_bytes,
            get_server_port,
            read_image_as_data_url,
            mpris_publish,
            mpris_favorite,
            bookos_activity::bookos_activity_publish,
            bookos_activity::bookos_activity_close,
        ])
        .setup(|app| {
            bookos_activity::listen(app.handle().clone(), "com.bookos.player");
            // Si el bus no está disponible (sesión sin D-Bus) el reproductor
            // sigue funcionando; solo se queda sin MPRIS.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match mpris::Mpris::start(handle).await {
                    Ok(m) => { let _ = MPRIS.set(m); }
                    Err(e) => log::warn!("MPRIS no disponible: {e}"),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Color dinámico ───────────────────────────────────────────────────────
// La paleta la genera BookOS Settings desde el fondo de pantalla y la deja en
// ~/.config/bookos/palette.css. Aquí solo se lee: quien tiñe es la hoja, que
// el cliente bookos-palette.js inyecta al final de <head>.
#[tauri::command]
fn bookos_palette_css() -> String {
    std::env::var("HOME").ok()
        .map(|h| std::path::Path::new(&h).join(".config/bookos/palette.css"))
        .and_then(|p| std::fs::read_to_string(p).ok())
        .unwrap_or_default()
}
