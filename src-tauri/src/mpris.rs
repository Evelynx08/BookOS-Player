//! Servidor MPRIS de BookOS-Player.
//!
//! Hasta ahora el reproductor no publicaba nada en D-Bus: ni la BookBar, ni el
//! applet de Plasma, ni la isla flotante lo veian. Aqui se publican las cuatro
//! interfaces:
//!
//!   org.mpris.MediaPlayer2            identidad
//!   org.mpris.MediaPlayer2.Player     transporte, posicion, volumen, shuffle/loop
//!   org.mpris.MediaPlayer2.TrackList  la cola de verdad (casi ningun player la da)
//!   org.bookos.MediaExtras1           favoritos; extension propia de BookOS,
//!                                     porque MPRIS no tiene forma de marcarlos
//!
//! El estado vive en el front (main.js es quien reproduce, con un <audio>), asi
//! que este modulo es un espejo: el JS empuja el estado con `mpris_publish` y
//! los mandos de D-Bus se reenvian al JS como eventos Tauri `mpris://command`.

use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use zbus::object_server::SignalEmitter;
use zbus::zvariant::{ObjectPath, OwnedObjectPath, Value};
use zbus::{connection, interface};

const BUS_NAME: &str = "org.mpris.MediaPlayer2.bookosplayer";
const OBJECT_PATH: &str = "/org/mpris/MediaPlayer2";
const NO_TRACK: &str = "/org/mpris/MediaPlayer2/TrackList/NoTrack";

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Track {
    /// Ruta del fichero; es la clave con la que el JS identifica todo.
    pub path: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub artist: String,
    #[serde(default)]
    pub album: String,
    #[serde(default)]
    pub art_url: String,
    /// Microsegundos.
    #[serde(default)]
    pub length: i64,
    #[serde(default)]
    pub favorite: bool,
}

impl Track {
    /// Los trackid de MPRIS son object paths, y una ruta de fichero no vale como
    /// tal (barras, acentos, espacios). Se deriva un id estable por hash.
    fn track_id(&self) -> OwnedObjectPath {
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        for b in self.path.as_bytes() {
            hash ^= *b as u64;
            hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
        }
        ObjectPath::try_from(format!("/org/bookos/player/track/{hash:016x}"))
            .unwrap_or_else(|_| ObjectPath::from_static_str_unchecked(NO_TRACK))
            .into()
    }

    fn metadata(&self) -> HashMap<String, Value<'static>> {
        let mut m = HashMap::new();
        m.insert("mpris:trackid".into(), Value::from(self.track_id()));
        if self.length > 0 {
            m.insert("mpris:length".into(), Value::from(self.length));
        }
        if !self.art_url.is_empty() {
            m.insert("mpris:artUrl".into(), Value::from(self.art_url.clone()));
        }
        m.insert("xesam:title".into(), Value::from(self.title.clone()));
        m.insert("xesam:artist".into(), Value::from(vec![self.artist.clone()]));
        m.insert("xesam:album".into(), Value::from(self.album.clone()));
        m.insert("xesam:url".into(), Value::from(file_uri(&self.path)));
        m
    }
}

fn file_uri(path: &str) -> String {
    if path.starts_with("file://") {
        return path.to_string();
    }
    // Codificacion minima: lo que rompe una URI son el espacio, la almohadilla
    // y el interrogante. El resto de caracteres los aguantan los consumidores.
    let escaped = path
        .replace('%', "%25")
        .replace(' ', "%20")
        .replace('#', "%23")
        .replace('?', "%3F");
    format!("file://{escaped}")
}

/// Espejo del estado que empuja el front.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct PlayerState {
    /// "Playing" | "Paused" | "Stopped"
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub position: i64,
    #[serde(default)]
    pub volume: f64,
    #[serde(default)]
    pub shuffle: bool,
    /// "None" | "Track" | "Playlist"
    #[serde(default)]
    pub loop_status: String,
    #[serde(default)]
    pub queue: Vec<Track>,
    #[serde(default)]
    pub index: i32,
}

impl PlayerState {
    fn current(&self) -> Option<&Track> {
        if self.index < 0 {
            return None;
        }
        self.queue.get(self.index as usize)
    }

    fn find(&self, id: &ObjectPath<'_>) -> Option<&Track> {
        self.queue.iter().find(|t| t.track_id().as_ref() == *id)
    }
}

#[derive(Clone)]
pub struct Shared {
    state: Arc<Mutex<PlayerState>>,
    app: AppHandle,
}

impl Shared {
    /// Manda una orden al front, que es quien controla el <audio>.
    fn command(&self, action: &str, arg: Option<String>) {
        let _ = self.app.emit(
            "mpris://command",
            serde_json::json!({ "action": action, "arg": arg }),
        );
    }
}

// ── org.mpris.MediaPlayer2 ───────────────────────────────────────────────────
struct RootIface(Shared);

#[interface(name = "org.mpris.MediaPlayer2")]
impl RootIface {
    async fn raise(&self) {
        self.0.command("raise", None);
    }

    async fn quit(&self) {
        self.0.command("quit", None);
    }

    #[zbus(property)]
    async fn can_quit(&self) -> bool {
        true
    }

    #[zbus(property)]
    async fn can_raise(&self) -> bool {
        true
    }

    #[zbus(property)]
    async fn has_track_list(&self) -> bool {
        true
    }

    #[zbus(property)]
    async fn identity(&self) -> String {
        "BookOS Player".into()
    }

    #[zbus(property)]
    async fn desktop_entry(&self) -> String {
        "bookos-player".into()
    }

    #[zbus(property)]
    async fn supported_uri_schemes(&self) -> Vec<String> {
        vec!["file".into()]
    }

    #[zbus(property)]
    async fn supported_mime_types(&self) -> Vec<String> {
        vec![
            "audio/mpeg".into(),
            "audio/flac".into(),
            "audio/ogg".into(),
            "audio/x-wav".into(),
            "audio/mp4".into(),
        ]
    }
}

// ── org.mpris.MediaPlayer2.Player ────────────────────────────────────────────
struct PlayerIface(Shared);

#[interface(name = "org.mpris.MediaPlayer2.Player")]
impl PlayerIface {
    async fn next(&self) {
        self.0.command("next", None);
    }

    async fn previous(&self) {
        self.0.command("previous", None);
    }

    async fn pause(&self) {
        self.0.command("pause", None);
    }

    async fn play_pause(&self) {
        self.0.command("playpause", None);
    }

    async fn stop(&self) {
        self.0.command("stop", None);
    }

    async fn play(&self) {
        self.0.command("play", None);
    }

    async fn seek(&self, offset: i64) {
        let position = self.0.state.lock().await.position + offset;
        self.0.command("seek", Some(position.max(0).to_string()));
    }

    async fn set_position(&self, _track_id: ObjectPath<'_>, position: i64) {
        self.0.command("seek", Some(position.max(0).to_string()));
    }

    async fn open_uri(&self, uri: String) {
        self.0.command("open", Some(uri));
    }

    #[zbus(property)]
    async fn playback_status(&self) -> String {
        let s = self.0.state.lock().await;
        if s.status.is_empty() {
            "Stopped".into()
        } else {
            s.status.clone()
        }
    }

    #[zbus(property)]
    async fn loop_status(&self) -> String {
        let s = self.0.state.lock().await;
        if s.loop_status.is_empty() {
            "None".into()
        } else {
            s.loop_status.clone()
        }
    }

    #[zbus(property)]
    async fn set_loop_status(&self, value: String) {
        self.0.command("loop", Some(value));
    }

    #[zbus(property)]
    async fn shuffle(&self) -> bool {
        self.0.state.lock().await.shuffle
    }

    #[zbus(property)]
    async fn set_shuffle(&self, value: bool) {
        self.0.command("shuffle", Some(value.to_string()));
    }

    #[zbus(property)]
    async fn metadata(&self) -> HashMap<String, Value<'static>> {
        match self.0.state.lock().await.current() {
            Some(t) => t.metadata(),
            None => HashMap::new(),
        }
    }

    #[zbus(property)]
    async fn volume(&self) -> f64 {
        self.0.state.lock().await.volume
    }

    #[zbus(property)]
    async fn set_volume(&self, value: f64) {
        self.0.command("volume", Some(value.clamp(0.0, 1.0).to_string()));
    }

    // Position no emite PropertiesChanged por spec: los clientes la preguntan
    // cuando la necesitan y usan la senal Seeked para los saltos.
    #[zbus(property(emits_changed_signal = "false"))]
    async fn position(&self) -> i64 {
        self.0.state.lock().await.position
    }

    #[zbus(property)]
    async fn rate(&self) -> f64 {
        1.0
    }

    #[zbus(property)]
    async fn set_rate(&self, _value: f64) {}

    #[zbus(property)]
    async fn minimum_rate(&self) -> f64 {
        1.0
    }

    #[zbus(property)]
    async fn maximum_rate(&self) -> f64 {
        1.0
    }

    #[zbus(property)]
    async fn can_go_next(&self) -> bool {
        !self.0.state.lock().await.queue.is_empty()
    }

    #[zbus(property)]
    async fn can_go_previous(&self) -> bool {
        !self.0.state.lock().await.queue.is_empty()
    }

    #[zbus(property)]
    async fn can_play(&self) -> bool {
        true
    }

    #[zbus(property)]
    async fn can_pause(&self) -> bool {
        true
    }

    #[zbus(property)]
    async fn can_seek(&self) -> bool {
        true
    }

    #[zbus(property)]
    async fn can_control(&self) -> bool {
        true
    }

    #[zbus(signal)]
    async fn seeked(emitter: &SignalEmitter<'_>, position: i64) -> zbus::Result<()>;
}

// ── org.mpris.MediaPlayer2.TrackList ─────────────────────────────────────────
struct TrackListIface(Shared);

#[interface(name = "org.mpris.MediaPlayer2.TrackList")]
impl TrackListIface {
    async fn get_tracks_metadata(
        &self,
        track_ids: Vec<OwnedObjectPath>,
    ) -> Vec<HashMap<String, Value<'static>>> {
        let s = self.0.state.lock().await;
        track_ids
            .iter()
            .filter_map(|id| s.find(&id.as_ref()).map(|t| t.metadata()))
            .collect()
    }

    async fn add_track(&self, uri: String, after_track: ObjectPath<'_>, set_as_current: bool) {
        let after = self
            .0
            .state
            .lock()
            .await
            .find(&after_track)
            .map(|t| t.path.clone())
            .unwrap_or_default();
        self.0.command(
            "queue-add",
            Some(
                serde_json::json!({ "uri": uri, "after": after, "play": set_as_current })
                    .to_string(),
            ),
        );
    }

    async fn remove_track(&self, track_id: ObjectPath<'_>) {
        if let Some(t) = self.0.state.lock().await.find(&track_id) {
            self.0.command("queue-remove", Some(t.path.clone()));
        }
    }

    async fn go_to(&self, track_id: ObjectPath<'_>) {
        if let Some(t) = self.0.state.lock().await.find(&track_id) {
            self.0.command("queue-goto", Some(t.path.clone()));
        }
    }

    #[zbus(property)]
    async fn tracks(&self) -> Vec<OwnedObjectPath> {
        self.0
            .state
            .lock()
            .await
            .queue
            .iter()
            .map(|t| t.track_id())
            .collect()
    }

    #[zbus(property)]
    async fn can_edit_tracks(&self) -> bool {
        true
    }

    #[zbus(signal)]
    async fn track_list_replaced(
        emitter: &SignalEmitter<'_>,
        tracks: Vec<OwnedObjectPath>,
        current_track: OwnedObjectPath,
    ) -> zbus::Result<()>;
}

// ── org.bookos.MediaExtras1 ──────────────────────────────────────────────────
struct ExtrasIface(Shared);

#[interface(name = "org.bookos.MediaExtras1")]
impl ExtrasIface {
    async fn is_favorite(&self, track_id: ObjectPath<'_>) -> bool {
        self.0
            .state
            .lock()
            .await
            .find(&track_id)
            .map(|t| t.favorite)
            .unwrap_or(false)
    }

    async fn set_favorite(&self, track_id: ObjectPath<'_>, value: bool) {
        if let Some(t) = self.0.state.lock().await.find(&track_id) {
            self.0.command(
                "favorite",
                Some(serde_json::json!({ "path": t.path, "value": value }).to_string()),
            );
        }
    }

    #[zbus(property)]
    async fn can_favorite(&self) -> bool {
        true
    }

    #[zbus(signal)]
    async fn favorite_changed(
        emitter: &SignalEmitter<'_>,
        track_id: OwnedObjectPath,
        value: bool,
    ) -> zbus::Result<()>;
}

// ── arranque y publicacion ───────────────────────────────────────────────────
pub struct Mpris {
    shared: Shared,
    connection: zbus::Connection,
}

impl Mpris {
    pub async fn start(app: AppHandle) -> zbus::Result<Self> {
        let shared = Shared {
            state: Arc::new(Mutex::new(PlayerState {
                volume: 1.0,
                index: -1,
                ..Default::default()
            })),
            app,
        };

        let connection = connection::Builder::session()?
            .name(BUS_NAME)?
            .serve_at(OBJECT_PATH, RootIface(shared.clone()))?
            .serve_at(OBJECT_PATH, PlayerIface(shared.clone()))?
            .serve_at(OBJECT_PATH, TrackListIface(shared.clone()))?
            .serve_at(OBJECT_PATH, ExtrasIface(shared.clone()))?
            .build()
            .await?;

        Ok(Self { shared, connection })
    }

    /// Sustituye el estado y avisa a los clientes. La llama el front en cada
    /// cambio de pista, de cola o de favorito.
    pub async fn publish(&self, new_state: PlayerState) -> zbus::Result<()> {
        let (track_changed, queue_changed, seeked_to) = {
            let mut s = self.shared.state.lock().await;
            let old_current = s.current().map(|t| t.path.clone());
            let old_queue: Vec<String> = s.queue.iter().map(|t| t.path.clone()).collect();
            let old_position = s.position;

            let new_current = new_state.current().map(|t| t.path.clone());
            let new_queue: Vec<String> = new_state.queue.iter().map(|t| t.path.clone()).collect();
            // Un salto de mas de dos segundos hacia atras o hacia delante no es
            // el avance normal de la reproduccion: es un seek.
            let jumped = (new_state.position - old_position).abs() > 2_000_000;
            let position = new_state.position;

            *s = new_state;
            (
                old_current != new_current,
                old_queue != new_queue,
                if jumped { Some(position) } else { None },
            )
        };

        let object_server = self.connection.object_server();

        let player = object_server
            .interface::<_, PlayerIface>(OBJECT_PATH)
            .await?;
        {
            let iface = player.get().await;
            let emitter = player.signal_emitter();
            iface.playback_status_changed(emitter).await?;
            iface.volume_changed(emitter).await?;
            iface.shuffle_changed(emitter).await?;
            iface.loop_status_changed(emitter).await?;
            if track_changed {
                iface.metadata_changed(emitter).await?;
            }
            if let Some(position) = seeked_to {
                PlayerIface::seeked(emitter, position).await?;
            }
        }

        if queue_changed {
            let tracklist = object_server
                .interface::<_, TrackListIface>(OBJECT_PATH)
                .await?;
            let iface = tracklist.get().await;
            let emitter = tracklist.signal_emitter();
            iface.tracks_changed(emitter).await?;

            let s = self.shared.state.lock().await;
            let tracks: Vec<OwnedObjectPath> = s.queue.iter().map(|t| t.track_id()).collect();
            let current = s
                .current()
                .map(|t| t.track_id())
                .unwrap_or_else(|| ObjectPath::from_static_str_unchecked(NO_TRACK).into());
            TrackListIface::track_list_replaced(emitter, tracks, current).await?;
        }

        Ok(())
    }

    /// Avisa de un cambio de favorito. Se llama aparte de `publish` porque el
    /// corazon puede cambiar sin que cambie nada mas del estado.
    pub async fn publish_favorite(&self, path: &str, value: bool) -> zbus::Result<()> {
        let track_id = {
            let s = self.shared.state.lock().await;
            s.queue
                .iter()
                .find(|t| t.path == path)
                .map(|t| t.track_id())
        };
        let Some(track_id) = track_id else {
            return Ok(());
        };
        let extras = self
            .connection
            .object_server()
            .interface::<_, ExtrasIface>(OBJECT_PATH)
            .await?;
        ExtrasIface::favorite_changed(extras.signal_emitter(), track_id, value).await
    }
}
