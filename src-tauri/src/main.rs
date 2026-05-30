#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use base64::{engine::general_purpose, Engine as _};
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::ItemKey;
use walkdir::WalkDir;
use serde::{Deserialize, Serialize};

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

    if meta.title.is_none() {
        meta.title = filename_title;
    }

    meta
}

#[tauri::command]
fn scan_folder(folder: String) -> Vec<TrackMeta> {
    let audio_exts = ["mp3", "flac", "ogg", "opus", "m4a", "aac", "wav", "wv", "ape", "mpc"];
    let mut tracks = Vec::new();

    for entry in WalkDir::new(&folder).follow_links(true).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() { continue; }
        let path = entry.path();
        let ext = path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        if audio_exts.contains(&ext.as_str()) {
            tracks.push(read_track_meta(path.to_string_lossy().to_string()));
        }
    }

    tracks.sort_by(|a, b| {
        let ta = a.title.as_deref().unwrap_or("");
        let tb = b.title.as_deref().unwrap_or("");
        ta.cmp(tb)
    });

    tracks
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


#[tauri::command]
fn read_audio_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            read_track_meta,
            scan_folder,
            detect_system_theme,
            read_audio_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
