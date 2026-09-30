'use strict';

// ── Tauri ─────────────────────────────────────────────────────────────────
const { invoke, convertFileSrc } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;
const { open: dialogOpen } = window.__TAURI__.dialog;
const appWindow = getCurrentWindow();
document.getElementById('app').classList.add('oled-mode');

// ── Block native context menu (no "inspect element") ───────────────────────
// Our custom track menu calls preventDefault + showCtx itself, so this only
// suppresses the browser default everywhere else.
document.addEventListener('contextmenu', e => {
  if (!e.target.closest('.tr')) e.preventDefault();
});

// ── Block zoom gestures (pinch / ctrl+wheel) and keyboard zoom ──────────────
document.addEventListener('wheel', e => {
  if (e.ctrlKey) e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
}, { passive: false });

// ── i18n ───────────────────────────────────────────────────────────────────
const LANG = navigator.language.startsWith('es') ? 'es' : 'en';
const T = {
  es: {
    songs: 'Canciones', albums: 'Álbumes', artists: 'Artistas',
    playlists: 'Listas', settings: 'Ajustes',
    addFolder: 'Añadir carpeta', playAll: 'Reproducir todo',
    newPlaylist: 'Nueva lista', deletePlaylist: 'Eliminar lista',
    emptyTitle: 'Tu biblioteca está vacía',
    emptySub: 'Añade una carpeta con música para comenzar',
    searchPlaceholder: 'Buscar en biblioteca…',
    title: 'Título', artist: 'Artista', album: 'Álbum',
    noPlayback: 'Sin reproducción',
    theme: 'Tema', themeSub: 'Claro, oscuro o del sistema',
    visual: 'Modo visual', visualSub: 'OLED (negro puro) o Blur (color dinámico del álbum)',
    themeAuto: 'Automático', themeDark: 'Oscuro', themeLight: 'Claro',
    visualOled: 'OLED', visualBlur: 'Blur',
    musicFolders: 'Carpetas de música',
    queue: 'Cola', songs_count: n => `${n} canción${n !== 1 ? 'es' : ''}`,
    albumType: 'Álbum', artistType: 'Artista',
    shuffleAll: 'Reproducir todo',
    modalNewPlaylist: 'Nueva lista', modalPlaceholder: 'Nombre de la lista…',
    cancel: 'Cancelar', create: 'Crear',
    ctxPlay: 'Reproducir', ctxPlayNext: 'Reproducir a continuación',
    ctxAddTo: 'Añadir a lista', noLists: 'Sin listas',
    home: 'Home', favorites: 'Favoritos', like: 'Me gusta',
    resumeLabel: 'Continuar escuchando',
    historyTitle: 'Reproducido recientemente',
    historyEmptySub: 'Todavía no has escuchado nada',
    favEmptyTitle: 'Sin favoritos todavía',
    favEmptySub: 'Toca el corazón de una canción para guardarla aquí',
    queueTitle: 'A continuación', queueEmpty: 'Nada en cola',
    importFiles: 'Importar canciones',
    filterPlaceholder: 'Filtrar…', noResults: 'Sin resultados',
    changeCover: 'Cambiar',
    editPlaylist: 'Personalizar lista', customize: 'Personalizar', save: 'Guardar',
    fieldColor: 'Color de la lista', fieldCover: 'Portada',
    colorMain: 'Color principal', colorSecond: 'Segundo color',
    useGradient: 'Degradado', angle: 'Ángulo',
    chooseImage: 'Elegir imagen', autoMosaic: 'Mosaico automático',
    reset: 'Quitar', mosaicNeedsFour: 'Hacen falta 4 carátulas',
    viewList: 'Vista de lista', viewGrid: 'Vista de cuadrícula', density: 'Densidad',
    crossfade: 'Crossfade', off: 'Desactivado',
    crossfadeSub: 'Funde el final de una canción con el principio de la siguiente',
  },
  en: {
    songs: 'Songs', albums: 'Albums', artists: 'Artists',
    playlists: 'Playlists', settings: 'Settings',
    addFolder: 'Add folder', playAll: 'Play all',
    newPlaylist: 'New playlist', deletePlaylist: 'Delete playlist',
    emptyTitle: 'Your library is empty',
    emptySub: 'Add a folder with music to get started',
    searchPlaceholder: 'Search library…',
    title: 'Title', artist: 'Artist', album: 'Album',
    noPlayback: 'Not playing',
    theme: 'Theme', themeSub: 'Light, dark or system',
    visual: 'Visual mode', visualSub: 'OLED (pure black) or Blur (dynamic album color)',
    themeAuto: 'Automatic', themeDark: 'Dark', themeLight: 'Light',
    visualOled: 'OLED', visualBlur: 'Blur',
    musicFolders: 'Music folders',
    queue: 'Queue', songs_count: n => `${n} song${n !== 1 ? 's' : ''}`,
    albumType: 'Album', artistType: 'Artist',
    shuffleAll: 'Shuffle all',
    modalNewPlaylist: 'New playlist', modalPlaceholder: 'Playlist name…',
    cancel: 'Cancel', create: 'Create',
    ctxPlay: 'Play', ctxPlayNext: 'Play next',
    ctxAddTo: 'Add to playlist', noLists: 'No playlists',
    home: 'Home', favorites: 'Favorites', like: 'Like',
    resumeLabel: 'Continue listening',
    historyTitle: 'Recently played',
    historyEmptySub: "You haven't listened to anything yet",
    favEmptyTitle: 'No favorites yet',
    favEmptySub: 'Tap the heart on a song to save it here',
    queueTitle: 'Up next', queueEmpty: 'Nothing queued',
    importFiles: 'Import songs',
    filterPlaceholder: 'Filter…', noResults: 'No results',
    changeCover: 'Change',
    editPlaylist: 'Customize playlist', customize: 'Customize', save: 'Save',
    fieldColor: 'Playlist color', fieldCover: 'Cover',
    colorMain: 'Main color', colorSecond: 'Second color',
    useGradient: 'Gradient', angle: 'Angle',
    chooseImage: 'Choose image', autoMosaic: 'Auto mosaic',
    reset: 'Clear', mosaicNeedsFour: 'Needs 4 covers',
    viewList: 'List view', viewGrid: 'Grid view', density: 'Density',
    crossfade: 'Crossfade', off: 'Off',
    crossfadeSub: 'Blends the end of a song into the start of the next one',
  }
}[LANG];

// ── State ──────────────────────────────────────────────────────────────────
let state = {
  theme: 'auto', visual: 'oled',
  playlists: [], music_folders: [],
  volume: 1.0, crossfade: 0, queue: [], current_index: -1,
  shuffle: false, repeat: 'none',
  favorites: [], history: [],
  imported_tracks: [],
};

// Personalización de listas. El estado se guarda como JSON sin esquema
// (~/.config/bookos-player/state.json), así que basta con rellenar los campos
// que falten al cargar: las listas viejas siguen funcionando.
const PL_DEFAULTS = { color: null, gradient: null, view: 'list', density: 'normal' };

function normalizePlaylist(pl) {
  const out = Object.assign({ tracks: [], cover: null }, PL_DEFAULTS, pl);
  delete out.icon;   // los iconos se retiraron: el color es la seña de identidad
  return out;
}

// El degradado se compone siempre con la MISMA estructura (linear-gradient de
// dos paradas) tenga o no personalización: así el navegador puede interpolarlo
// al pasar de una lista a otra en vez de cortar.
function playlistGradient(pl) {
  if (pl?.gradient) return `linear-gradient(${pl.gradient.angle}deg, ${pl.gradient.from}, ${pl.gradient.to})`;
  // Un solo color elegido: se hace el degradado con una variante más oscura de
  // ese mismo color, así sigue siendo el color del usuario y no una mezcla rara.
  if (pl?.color) return `linear-gradient(135deg, ${pl.color}, color-mix(in srgb, ${pl.color} 65%, #000 35%))`;
  return 'linear-gradient(135deg, var(--accent), var(--accent-2))';
}

function playlistAccent(pl) {
  return pl?.color || pl?.gradient?.from || 'var(--accent)';
}

function playlistIsCustom(pl) {
  return !!(pl?.color || pl?.gradient);
}

let library = [];
let currentView = 'songs';
let activePlaylistId = null;
let ctxTrack = null;
let modalCb = null;
let modalCancelCb = null;
let searchQuery = '';

// ── Audio ──────────────────────────────────────────────────────────────────
// Dos elementos que se turnan. El crossfade necesita dos pistas sonando a la
// vez, y hacerlo con uno solo obligaría a re-buscar la posición a mitad de
// stream (corte audible). `audio` SIEMPRE apunta al elemento de la pista
// actual; al terminar el fundido se intercambian los papeles. Es `let` a
// propósito: mpris-bridge.js y updateProgress() lo leen en cada llamada, así
// que el cambio les llega solo.
const audioA = document.getElementById('audioEl');
const audioB = document.getElementById('audioEl2');
let audio = audioA;
const idleAudio = () => (audio === audioA ? audioB : audioA);

// El servidor local manda `Access-Control-Allow-Origin: *`, pero sin este
// atributo la petición va en modo no-CORS y el medio queda "tainted": Web Audio
// leería silencio. Se pone antes de cualquier src.
[audioA, audioB].forEach(el => { el.crossOrigin = 'anonymous'; });

// ── Web Audio: análisis de nivel ───────────────────────────────────────────
// Solo sirve para detectar el silencio del final. El volumen pasa a un GainNode
// cuando el grafo está activo, en vez de a el.volume: así no dependemos de si
// esta implementación aplica .volume antes o después del nodo de origen — con
// el grafo montado, el nivel lo controlamos nosotros y punto.
let _actx = null;
let webAudioReady = false;
const _nodes = new Map();   // el -> { gain, analyser }

function initWebAudio() {
  if (webAudioReady || _actx === false) return webAudioReady;
  try {
    _actx = new (window.AudioContext || window.webkitAudioContext)();
    for (const el of [audioA, audioB]) {
      const src = _actx.createMediaElementSource(el);
      const gain = _actx.createGain();
      const analyser = _actx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(gain); gain.connect(analyser); analyser.connect(_actx.destination);
      gain.gain.value = state.volume;
      el.volume = 1;                       // el nivel lo lleva el gain
      _nodes.set(el, { gain, analyser, buf: new Uint8Array(analyser.fftSize) });
    }
    webAudioReady = true;
  } catch (err) {
    // Si algo falla se sigue con el.volume de siempre: sin detección de
    // silencio, pero sin romper la reproducción.
    console.error('Web Audio init failed, usando volumen del elemento:', err);
    _actx = false;
    webAudioReady = false;
  }
  return webAudioReady;
}

// Punto único para el nivel de un elemento, con grafo o sin él.
function resumeWebAudio() {
  // El contexto nace suspendido hasta que hay un gesto del usuario; sin esto,
  // la primera pista tras activar el crossfade se quedaría muda.
  if (webAudioReady && _actx && _actx.state === 'suspended') _actx.resume().catch(() => { });
}

function setLevel(el, v) {
  v = Math.max(0, Math.min(1, v));
  const n = _nodes.get(el);
  if (webAudioReady && n) n.gain.gain.value = v;
  else el.volume = v;
}

function getLevel(el) {
  const n = _nodes.get(el);
  return (webAudioReady && n) ? n.gain.gain.value : el.volume;
}

// Pico de la señal ahora mismo, 0..1. null si no hay grafo.
function currentPeak(el) {
  const n = _nodes.get(el);
  if (!webAudioReady || !n) return null;
  n.analyser.getByteTimeDomainData(n.buf);
  let peak = 0;
  for (let i = 0; i < n.buf.length; i++) {
    const d = Math.abs(n.buf[i] - 128);
    if (d > peak) peak = d;
  }
  return peak / 128;
}

// ── DOM shortcuts ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const app = $('app');

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = s => { if (!s || isNaN(s)) return '0:00'; s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MIME_BY_EXT = {
  mp3: 'audio/mpeg', flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/opus',
  m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', wv: 'audio/x-wavpack',
  ape: 'audio/x-ape', mpc: 'audio/x-musepack',
};
const mimeForPath = p => MIME_BY_EXT[(p.split('.').pop() || '').toLowerCase()] || '';

// ── Motion helpers ─────────────────────────────────────────────────────────
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// FLIP: los renderizadores reconstruyen la tabla entera (innerHTML = ''), así
// que un reordenado saltaba de golpe. Se miden las posiciones antes, se aplica
// la mutación tal cual, y se anima el desfase con WAAPI — acelerado por GPU e
// interrumpible, sin librerías.
function flip(container, mutate) {
  if (!container || reducedMotion()) { mutate(); return; }
  const before = new Map();
  for (const el of container.children) {
    if (el.dataset.path || el.dataset.id) {
      before.set(el.dataset.path || el.dataset.id, el.getBoundingClientRect());
    }
  }
  mutate();
  for (const el of container.children) {
    const key = el.dataset.path || el.dataset.id;
    const prev = key && before.get(key);
    if (!prev) continue;
    const now = el.getBoundingClientRect();
    const dx = prev.left - now.left;
    const dy = prev.top - now.top;
    if (!dx && !dy) continue;
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: 260, easing: 'cubic-bezier(.23, 1, .32, 1)' },
    );
  }
}

// Los atajos de teclado se repiten decenas de veces por sesión: animarlos hace
// que la app se sienta lenta y desconectada de la pulsación. Como el rebote y
// el morph se disparan desde eventos de <audio> (no desde el propio atajo), se
// marca el momento del atajo y se silencia la animación durante ese instante.
let kbActionAt = 0;
const markKbAction = () => { kbActionAt = Date.now(); };
const kbActionRecent = () => Date.now() - kbActionAt < 500;

// Entrada escalonada. Tope en 12 para que una rejilla larga no tarde un segundo
// en aparecer; no se usa en la vista Canciones (se pinta en bloques de 250).
const maybeStagger = (on, el, i) => (on ? stagger(el, i) : el);

function stagger(el, i) {
  if (reducedMotion()) return el;
  el.classList.add('stagger-in');
  el.style.setProperty('--i', Math.min(i, 12));
  return el;
}

// ── Color extraction ───────────────────────────────────────────────────────
function extractColor(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 24;
        const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, 24, 24);
        const d = cx.getImageData(0, 0, 24, 24).data;
        const main = avgColor(d, () => true);
        if (!main) { resolve(null); return; }
        const [a, b] = twoHues(d);
        resolve({ ...main, a: (a || main).hex, b: (b || a || main).hex });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Media de los píxeles de 24×24 que cumplen `inRegion`, sin los casi negros ni
// casi blancos (no dicen nada del color) y con la saturación subida un 55 %.
function avgColor(d, inRegion) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 8) {
    const p = i / 4;
    if (!inRegion(p % 24, Math.floor(p / 24))) continue;
    const lum = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
    if (lum < 20 || lum > 235) continue;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  }
  if (!n) return null;
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  const mid = (r + g + b) / 3, f = 1.55;
  const sat = v => Math.max(0, Math.min(255, Math.round(mid + (v - mid) * f)));
  r = sat(r); g = sat(g); b = sat(b);
  return { hex: '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''), rgb: `${r},${g},${b}` };
}

// Los dos tonos que más pesan en la portada, para el degradado de pantalla
// completa. Se probó con la media de dos esquinas y en portadas de fondo negro
// salía gris: lo que da carácter es el color saturado, esté donde esté.
// Cubos de 30° de tono, cada píxel pesa su saturación; el segundo tono tiene
// que estar a más de 60° del primero para que el degradado no sea monocromo.
function twoHues(d) {
  const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 40 || max - min < 40) continue;          // negros y grises
    const sat = (max - min) / max;
    let h = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
    h = ((h * 60) + 360) % 360;
    const k = buckets[Math.floor(h / 30)];
    k.w += sat; k.r += r * sat; k.g += g * sat; k.b += b * sat;
  }
  const order = buckets.map((k, i) => ({ ...k, i })).filter(k => k.w > 0).sort((x, y) => y.w - x.w);
  const first = order[0];
  if (!first) return [null, null];
  const second = order.find(k => Math.min(Math.abs(k.i - first.i), 12 - Math.abs(k.i - first.i)) > 2);
  const toColor = k => {
    const [r, g, b] = [k.r, k.g, k.b].map(v => Math.round(v / k.w));
    return { hex: '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('') };
  };
  return [toColor(first), second ? toColor(second) : null];
}

// El acento de la app es el de Ajustes (--blue de la paleta de BookOS); el
// color de la carátula sólo tiñe la pantalla completa, que es donde la
// carátula manda. Antes pisaba --dyn en toda la app y el color elegido en
// Ajustes no se veía nunca mientras sonara algo con portada.
function applyDyn(color) {
  const imm = $('immersive');
  if (color?.hex) {
    imm.style.setProperty('--accent', color.hex);
    imm.style.setProperty('--imm-c1', color.a);
    imm.style.setProperty('--imm-c2', color.b);
  } else {
    ['--accent', '--imm-c1', '--imm-c2'].forEach(v => imm.style.removeProperty(v));
  }
}

// ── Theme / visual ─────────────────────────────────────────────────────────
async function applyTheme(t) {
  let r = t;
  if (t === 'auto') r = await invoke('detect_system_theme').catch(() => 'dark');
  app.classList.toggle('light-mode', r === 'light');
  // También en :root: la hoja de la paleta compartida trae un bloque
  // @media(prefers-color-scheme:dark){:root:not(.light-mode){…}}. Sin esta
  // clase, elegir "Claro" con el sistema en oscuro dejaba --bg/--card oscuros
  // bajo texto de tema claro.
  document.documentElement.classList.toggle('light-mode', r === 'light');
  // Mismo contrato de clase que bookos-palette.js usa en toda la app, para
  // que su hoja de --bg/--card (inyectada después) pueda pisar el nuestro.
  document.documentElement.classList.toggle('dark-mode', r === 'dark');
}
function applyVisual(v) {
  app.classList.toggle('oled-mode', v === 'oled');
  app.classList.toggle('blur-mode', v === 'blur');
}

// ── State ──────────────────────────────────────────────────────────────────
// Las carátulas no se guardan: loadCovers() las vuelve a leer del archivo. Con
// ellas en imported_tracks e history el state.json llegó a 157 MB, y cada
// guardado costaba 0,6 s solo en Rust (medido), unas tres veces por cambio de
// pista y con la ventana congelada.
const withoutCover = ({ cover, ...t }) => t;
// Un cambio de pista llama a saveState() desde varios sitios seguidos; con
// agruparlos en un solo guardado basta.
let _saveTimer = null;
function saveState() {
  clearTimeout(_saveTimer);
  return new Promise(resolve => {
    _saveTimer = setTimeout(() => {
      invoke('save_state', {
        state: {
          ...state,
          queue: state.queue.map(t => t.path),
          imported_tracks: state.imported_tracks.map(withoutCover),
          history: state.history.map(withoutCover),
        }
      }).catch(err => console.error('save_state:', err)).then(resolve);
    }, 300);
  });
}
async function loadState() {
  const s = await invoke('load_state').catch(() => ({}));
  ['theme', 'visual', 'playlists', 'music_folders', 'volume', 'crossfade', 'shuffle', 'repeat', 'favorites', 'history', 'imported_tracks'].forEach(k => {
    if (s[k] !== undefined) state[k] = s[k];
  });
  // Migración de listas creadas antes de la personalización
  state.playlists = (state.playlists || []).map(normalizePlaylist);
}

// ── Scanning ───────────────────────────────────────────────────────────────
async function scanAll() {
  library = [];
  // Las carpetas se escanean a la vez: en serie, la última no empezaba hasta
  // que terminaba la anterior.
  const perFolder = await Promise.all(
    state.music_folders.map(f => invoke('scan_folder', { folder: f }).catch(() => []))
  );
  for (const tracks of perFolder) library.push(...tracks);
  const seen = new Set();
  library = library.filter(t => { if (seen.has(t.path)) return false; seen.add(t.path); return true; });
  // Pistas importadas sueltas (fuera de cualquier carpeta registrada) —
  // sin esto desaparecían de la biblioteca (y de cualquier lista que las
  // usara) cada vez que se reescaneaba, porque scanAll() solo mira
  // state.music_folders.
  for (const t of state.imported_tracks) {
    if (!seen.has(t.path)) { seen.add(t.path); library.push(t); }
  }
  if (currentView === 'songs') renderSongs();
  if (currentView === 'albums') renderAlbums();
  if (currentView === 'artists') renderArtists();
  if (currentView === 'favorites') renderFavorites();
  if (currentView === 'home') renderHome();
  updatePlaylistNav();
  loadCovers();
}

// Las carátulas llegan después de que la lista ya esté a la vista. Se piden por
// trozos para no bloquear ni el backend ni el hilo de render, y solo se vuelve
// a pintar cuando un trozo ha traído algo.
let coversLoading = false;
async function loadCovers() {
  if (coversLoading) return;
  coversLoading = true;
  const byPath = new Map(library.map(t => [t.path, t]));
  const pending = library.filter(t => !t.cover).map(t => t.path);
  const CHUNK = 12;
  try {
    for (let i = 0; i < pending.length; i += CHUNK) {
      const slice = pending.slice(i, i + CHUNK);
      const got = await invoke('read_covers', { paths: slice }).catch(() => []);
      const changed = [];
      for (const [path, cover] of got) {
        const t = byPath.get(path);
        if (!t || !cover) continue;
        t.cover = await makeThumb(cover);
        if (t.cover) changed.push(t);
      }
      if (changed.length) paintRowCovers(changed);
      // Ceder el hilo entre trozos para que la interfaz siga respondiendo.
      await new Promise(r => setTimeout(r, 0));
    }
  } finally {
    coversLoading = false;
  }
  // La rejilla se pinta una vez al final: reconstruirla por cada lote era la
  // mayor parte del tiempo de arranque.
  if (currentView === 'albums') renderAlbums();
  if (currentView === 'home') renderHome();
  const cur = state.queue[state.current_index];
  if (cur && cur.cover) updateNowPlaying(cur);
}

// Las carátulas embebidas miden de media 650 KB (hasta 1,5 MB, 1280×720 en
// PNG) y cada fila de 34 px decodificaba la original: 140 MB en base64 vivos
// en la página y el scroll a tirones. Se guarda sólo una miniatura; la
// original se pide aparte para la pantalla completa (loadFullArt).
// 384 px cubre la tarjeta de álbum más grande a escala 2.
const THUMB_PX = 384;
async function makeThumb(src) {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch (err) {
    console.error('carátula ilegible:', err);
    return null;
  }
  const k = Math.min(1, THUMB_PX / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .85);
}

// Recorre las filas una vez por lote; buscar cada pista por separado hacía
// que el coste creciera con el producto entre portadas y filas visibles.
function paintRowCovers(tracks) {
  const byPath = new Map(tracks.map(t => [t.path, t.cover]));
  document.querySelectorAll('.tr .tr-cover-ph').forEach(ph => {
    const cover = byPath.get(ph.closest('.tr')?.dataset.path);
    if (!cover) return;
    const img = document.createElement('img');
    img.className = 'tr-cover';
    img.alt = '';
    img.src = cover;
    ph.replaceWith(img);
  });
}

// ── View switching ─────────────────────────────────────────────────────────
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.sb-pl-item').forEach(b => b.classList.remove('active'));
  const v = $(`view-${name}`);
  if (v) v.classList.add('active');
  if (name === 'songs') renderSongs();
  if (name === 'albums') renderAlbums();
  if (name === 'artists') renderArtists();
  if (name === 'favorites') renderFavorites();
  if (name === 'home') renderHome();
}

function showDetailView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sb-pl-item').forEach(b => b.classList.remove('active'));
  const v = $(`view-${name}`);
  if (v) v.classList.add('active');
}

// ── Favorites ──────────────────────────────────────────────────────────────
function isFavorite(path) { return state.favorites.includes(path); }

function toggleFavorite(path, btnEl) {
  const i = state.favorites.indexOf(path);
  const nowFav = i === -1;
  if (nowFav) state.favorites.push(path); else state.favorites.splice(i, 1);
  saveState();
  document.querySelectorAll(`.tr[data-path="${cssEscape(path)}"] .tr-like`).forEach(btn => {
    btn.classList.toggle('active', nowFav);
    btn.querySelector('svg').setAttribute('fill', nowFav ? 'currentColor' : 'none');
    if (nowFav) {
      // quitar → rAF → poner reinicia el keyframe; el animationend limpia la
      // clase para que la próxima vez vuelva a dispararse desde cero.
      btn.classList.remove('pop');
      requestAnimationFrame(() => btn.classList.add('pop'));
      btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });
    }
  });
  if (currentView === 'favorites') renderFavorites();
  // La isla flotante pinta el corazón de cada pista de la cola; sin este aviso
  // no se enteraría hasta el siguiente latido.
  window.bookosMprisFavorite?.(path, nowFav);
}

function cssEscape(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'); }

// ── Playback history ────────────────────────────────────────────────────────
function pushHistory(track) {
  if (!track || !track.path) return;
  state.history = state.history.filter(t => t.path !== track.path);
  state.history.unshift({ path: track.path, title: track.title, artist: track.artist, album: track.album, cover: track.cover, duration: track.duration, played_at: Date.now() });
  state.history = state.history.slice(0, 30);
  saveState();
}

// ── Track row builder ──────────────────────────────────────────────────────
function makeRow(track, index, tracks, cols = '4col', opts = null) {
  const div = document.createElement('div');
  div.className = 'tr' + (cols === '2col' ? ' tr-2col' : cols === '3col' ? ' tr-3col' : '');
  div.dataset.path = track.path;
  div.dataset.index = index;

  const title = esc(track.title || track.path.split('/').pop());
  const artist = esc(track.artist || '—');
  const album = esc(track.album || '—');
  const dur = fmt(track.duration);
  const coverHtml = track.cover
    ? `<img class="tr-cover" src="${esc(track.cover)}" loading="lazy" alt="">`
    : `<div class="tr-cover-ph"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/></svg></div>`;

  const likeHtml = `<button class="tr-like${isFavorite(track.path) ? ' active' : ''}" title="${T.like}">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="${isFavorite(track.path) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
    </button>`;
  const removeHtml = opts?.onRemove
    ? `<button class="tr-remove" title="Quitar de la lista">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18 18 6M6 6l12 12"/></svg>
      </button>`
    : '';

  let inner = '';
  if (cols === '2col') {
    inner = `<div class="tr-num">${index + 1}</div>
      <div class="tr-play-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd"/></svg></div>
      <div class="tr-eq"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>
      <div class="tr-title-wrap">${coverHtml}<div class="tr-title">${title}</div></div>
      <div class="tr-dur">${dur}</div>
      ${likeHtml}${removeHtml}`;
  } else if (cols === '3col') {
    inner = `<div class="tr-num">${index + 1}</div>
      <div class="tr-play-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd"/></svg></div>
      <div class="tr-eq"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>
      <div class="tr-title-wrap">${coverHtml}<div class="tr-title">${title}</div></div>
      <div class="tr-album">${album}</div>
      <div class="tr-dur">${dur}</div>
      ${likeHtml}${removeHtml}`;
  } else {
    inner = `<div class="tr-num">${index + 1}</div>
      <div class="tr-play-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd"/></svg></div>
      <div class="tr-eq"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>
      <div class="tr-title-wrap">${coverHtml}<div class="tr-title">${title}</div></div>
      <div class="tr-artist">${artist}</div>
      <div class="tr-album">${album}</div>
      <div class="tr-dur">${dur}</div>
      ${likeHtml}${removeHtml}`;
  }
  div.innerHTML = inner;

  div.addEventListener('click', () => playTracklist(tracks, index));
  div.addEventListener('contextmenu', e => { e.preventDefault(); showCtx(e.clientX, e.clientY, track); });
  div.querySelector('.tr-like').addEventListener('click', e => {
    e.stopPropagation();
    toggleFavorite(track.path, e.currentTarget);
  });

  if (opts?.onRemove) {
    div.querySelector('.tr-remove').addEventListener('click', e => {
      e.stopPropagation();
      opts.onRemove(track, index);
    });
  }

  if (opts?.onReorder) {
    div.draggable = true;
    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.effectAllowed = 'move';
      div.classList.add('dragging');
    });
    div.addEventListener('dragend', () => div.classList.remove('dragging'));
    // La línea de destino va arriba o abajo según en qué mitad de la fila esté
    // el cursor: dice dónde va a caer, no sólo sobre qué fila está.
    div.addEventListener('dragover', e => {
      e.preventDefault();
      const r = div.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      div.classList.add('drag-over');
      div.classList.toggle('drop-after', after);
      div.classList.toggle('drop-before', !after);
    });
    div.addEventListener('dragleave', () => div.classList.remove('drag-over', 'drop-before', 'drop-after'));
    div.addEventListener('drop', e => {
      e.preventDefault();
      div.classList.remove('drag-over', 'drop-before', 'drop-after');
      const fromIndex = Number(e.dataTransfer.getData('text/plain'));
      if (!Number.isNaN(fromIndex) && fromIndex !== index) opts.onReorder(fromIndex, index);
    });
  }

  return div;
}

function highlightRows() {
  const cur = state.queue[state.current_index];
  document.querySelectorAll('.tr').forEach(r => {
    const playing = !!(cur && r.dataset.path === cur.path);
    r.classList.toggle('playing', playing);
  });
}

// ── Ordenación por columna ─────────────────────────────────────────────────
// Cada vista con tabla guarda su propio criterio; click en la cabecera
// alterna asc/desc, y un segundo click sobre otra columna empieza en asc.
const sortState = {
  // `scan_folder` (Rust) ya devuelve la biblioteca ordenada por título
  // ascendente, así que se declara ese estado en vez de fingir "sin orden":
  // si no, el primer click en "Título" volvía a ordenar ascendente y no
  // cambiaba nada visible, dando la sensación de que no funcionaba.
  songs: { key: 'title', dir: 'asc' },
  playlist: { key: null, dir: 'asc' },
  favorites: { key: null, dir: 'asc' },
  album: { key: null, dir: 'asc' },
  artist: { key: null, dir: 'asc' },
};

function sortTracks(tracks, view) {
  const st = sortState[view];
  if (!st || !st.key) return tracks;
  const mult = st.dir === 'desc' ? -1 : 1;
  return [...tracks].sort((a, b) => {
    if (st.key === 'duration') {
      return ((a.duration || 0) - (b.duration || 0)) * mult;
    }
    const av = (a[st.key] || '').toString();
    const bv = (b[st.key] || '').toString();
    return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * mult;
  });
}

// Marca visualmente la columna activa con su flecha de dirección.
function paintSortHead(headEl, view) {
  if (!headEl) return;
  const st = sortState[view];
  headEl.querySelectorAll('[data-sort]').forEach(th => {
    const active = st.key === th.dataset.sort;
    th.classList.toggle('sorted', active);
    th.classList.toggle('desc', active && st.dir === 'desc');
  });
}

function wireSortHead(headId, view, rerender) {
  const headEl = $(headId);
  if (!headEl) return;
  headEl.querySelectorAll('[data-sort]').forEach(th => {
    th.classList.add('sortable');
    th.addEventListener('click', () => {
      const st = sortState[view];
      const key = th.dataset.sort;
      if (st.key === key) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
      else { st.key = key; st.dir = 'asc'; }
      paintSortHead(headEl, view);
      rerender();
    });
  });
  // Refleja el criterio inicial ya al arrancar (p.ej. Canciones viene
  // ordenado por título), para que la cabecera no mienta y siempre haya
  // una señal visible de por qué la lista está en ese orden.
  paintSortHead(headEl, view);
}

// ── Songs view ─────────────────────────────────────────────────────────────
// Render por lotes: con bibliotecas grandes construir miles de filas de golpe
// congela la UI. Pinta 250, cede el hilo y sigue; una búsqueda nueva cancela
// el lote pendiente (token de generación).
let _songsRenderGen = 0;
function renderSongs() {
  const tbl = $('trackTable');
  const empty = $('emptyState');
  tbl.innerHTML = '';
  const gen = ++_songsRenderGen;

  const searched = searchQuery
    ? library.filter(t => [t.title, t.artist, t.album].some(s => (s || '').toLowerCase().includes(searchQuery)))
    : library;
  const filtered = sortTracks(searched, 'songs');

  if (!filtered.length) { empty.classList.add('show'); tbl.style.display = 'none'; return; }
  empty.classList.remove('show'); tbl.style.display = '';

  const CHUNK = 250;
  let i = 0;
  function renderChunk() {
    if (gen !== _songsRenderGen) return;            // llegó un render más nuevo
    const frag = document.createDocumentFragment();
    const end = Math.min(i + CHUNK, filtered.length);
    for (; i < end; i++) frag.appendChild(makeRow(filtered[i], i, filtered));
    tbl.appendChild(frag);
    if (i < filtered.length) requestAnimationFrame(renderChunk);
    else highlightRows();
  }
  renderChunk();
}

// ── Albums view ────────────────────────────────────────────────────────────
function renderAlbums() {
  const grid = $('albumGrid'); grid.innerHTML = '';
  const albums = {};
  library.forEach(t => {
    const key = (t.album || '—') + '|||' + (t.album_artist || t.artist || '—');
    if (!albums[key]) albums[key] = { name: t.album || '—', artist: t.album_artist || t.artist || '—', cover: t.cover, tracks: [] };
    albums[key].tracks.push(t);
  });
  Object.values(albums).sort((a, b) => a.name.localeCompare(b.name)).forEach(alb => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.innerHTML = (alb.cover ? `<img src="${esc(alb.cover)}" loading="lazy" alt="">` : `<div class="album-card-ph"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".5"><path d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/></svg></div>`)
      + `<div class="album-card-info"><div class="album-card-name">${esc(alb.name)}</div><div class="album-card-artist">${esc(alb.artist)}</div></div>`;
    card.addEventListener('click', () => showAlbumDetail(alb));
    grid.appendChild(stagger(card, grid.childElementCount));
  });
}

let currentAlbum = null;
let adRenderedKey = null;
async function showAlbumDetail(alb) {
  currentAlbum = alb;
  $('adType').textContent = T.albumType;
  $('adTitle').textContent = alb.name;
  $('adMeta').textContent = `${alb.artist} · ${T.songs_count(alb.tracks.length)}`;
  if (alb.cover) {
    $('adArt').src = alb.cover; $('adArt').style.display = 'block'; $('adArtPh').style.display = 'none';
    const color = await extractColor(alb.cover);
    if (color) document.querySelector('.album-detail-header').style.background = `linear-gradient(to bottom,rgba(${color.rgb},.18),transparent)`;
  } else {
    $('adArt').style.display = 'none'; $('adArtPh').style.display = 'flex';
    document.querySelector('.album-detail-header').style.background = '';
  }
  const tbl = $('adTrackTable'); tbl.innerHTML = '';
  // Sin criterio elegido, el orden natural de un álbum es su nº de pista.
  const sorted = sortState.album.key
    ? sortTracks(alb.tracks, 'album')
    : [...alb.tracks].sort((a, b) => (a.track_number || 999) - (b.track_number || 999));
  // Igual que en las listas: sólo se escalona al entrar en otro álbum, no al
  // reordenar por columna.
  const fresh = adRenderedKey !== alb.name + '|' + alb.artist;
  adRenderedKey = alb.name + '|' + alb.artist;
  sorted.forEach((t, i) => tbl.appendChild(maybeStagger(fresh, makeRow(t, i, sorted, '2col'), i)));
  $('adPlayBtn').onclick = () => playTracklist(sorted, 0);
  $('adShuffleBtn').onclick = () => {
    state.shuffle = true; syncShuffleRepeatUI();
    playTracklist(sorted, 0);
  };
  showDetailView('album-detail');
  highlightRows();
}

// ── Artists view ───────────────────────────────────────────────────────────
function renderArtists() {
  const grid = $('artistGrid'); grid.innerHTML = '';
  const artists = {};
  library.forEach(t => {
    const key = t.artist || '—';
    if (!artists[key]) artists[key] = { name: key, count: 0, tracks: [] };
    artists[key].count++;
    artists[key].tracks.push(t);
  });
  Object.values(artists).sort((a, b) => a.name.localeCompare(b.name)).forEach(art => {
    const card = document.createElement('div');
    card.className = 'artist-card';
    card.innerHTML = `<div class="artist-card-avatar">${esc((art.name[0] || '?').toUpperCase())}</div><div class="artist-card-name">${esc(art.name)}</div><div class="artist-card-count">${T.songs_count(art.count)}</div>`;
    card.addEventListener('click', () => showArtistDetail(art));
    grid.appendChild(stagger(card, grid.childElementCount));
  });
}

let currentArtist = null;
let artRenderedKey = null;
async function showArtistDetail(art) {
  currentArtist = art;
  $('artDetailName').textContent = art.name;
  $('artDetailMeta').textContent = T.songs_count(art.tracks.length);
  $('artAvatarLg').textContent = (art.name[0] || '?').toUpperCase();
  const tbl = $('artTrackTable'); tbl.innerHTML = '';
  const artTracks = sortTracks(art.tracks, 'artist');
  const fresh = artRenderedKey !== art.name;
  artRenderedKey = art.name;
  artTracks.forEach((t, i) => tbl.appendChild(maybeStagger(fresh, makeRow(t, i, artTracks, '3col'), i)));
  $('artPlayBtn').onclick = () => playTracklist(art.tracks, 0);
  showDetailView('artist-detail');
  highlightRows();
}

// ── Favorites view ─────────────────────────────────────────────────────────
function renderFavorites() {
  const tbl = $('favTrackTable'); const empty = $('favEmpty');
  tbl.innerHTML = '';
  const tracks = sortTracks(library.filter(t => isFavorite(t.path)), 'favorites');
  if (!tracks.length) { empty.classList.add('show'); tbl.style.display = 'none'; return; }
  empty.classList.remove('show'); tbl.style.display = '';
  tracks.forEach((t, i) => tbl.appendChild(makeRow(t, i, tracks)));
  highlightRows();
}

// ── Home view ──────────────────────────────────────────────────────────────
function renderHome() {
  const cur = state.current_index >= 0 ? state.queue[state.current_index] : null;
  const last = state.history[0];
  // El historial guardado ya no lleva carátula: se toma la de la biblioteca.
  const resumeTrack = cur || (last && (library.find(t => t.path === last.path) || last)) || null;
  const card = $('resumeCard');
  if (resumeTrack) {
    card.style.display = '';
    $('resumeTitle').textContent = resumeTrack.title || resumeTrack.path.split('/').pop();
    $('resumeArtist').textContent = resumeTrack.artist || '—';
    if (resumeTrack.cover) {
      $('resumeArtImg').src = resumeTrack.cover; $('resumeArtImg').style.display = 'block'; $('resumeArtPh').style.display = 'none';
    } else {
      $('resumeArtImg').style.display = 'none'; $('resumeArtPh').style.display = 'flex';
    }
  } else {
    card.style.display = 'none';
  }

  const tbl = $('historyTrackTable'); const empty = $('historyEmpty');
  tbl.innerHTML = '';
  if (!state.history.length) { empty.classList.add('show'); tbl.style.display = 'none'; return; }
  empty.classList.remove('show'); tbl.style.display = '';
  const tracks = state.history.map(h => library.find(t => t.path === h.path) || h);
  tracks.forEach((t, i) => tbl.appendChild(makeRow(t, i, tracks, '2col')));
  highlightRows();
}

$('resumePlayBtn').addEventListener('click', () => {
  const cur = state.current_index >= 0 ? state.queue[state.current_index] : null;
  if (cur) { audio.paused ? audio.play() : null; return; }
  const t = state.history[0];
  if (!t) return;
  const full = library.find(x => x.path === t.path) || t;
  playTracklist([full], 0);
});

$('homeShuffleBtn').addEventListener('click', () => {
  if (!library.length) return;
  state.shuffle = true; syncShuffleRepeatUI();
  playTracklist(library, Math.floor(Math.random() * library.length));
});

// ── Playlists ──────────────────────────────────────────────────────────────
function updatePlaylistNav() {
  const nav = $('playlistNav'); nav.innerHTML = '';
  state.playlists.forEach((pl, index) => {
    const btn = document.createElement('button');
    btn.className = 'sb-pl-item' + (activePlaylistId === pl.id ? ' active' : '');
    btn.dataset.id = pl.id;
    btn.style.setProperty('--pl-item-accent', playlistAccent(pl));
    const iconHtml = pl.cover
      ? `<img src="${esc(pl.cover)}" alt="" style="width:18px;height:18px;border-radius:5px;object-fit:cover;flex-shrink:0">`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/></svg>`;
    const dotHtml = playlistIsCustom(pl) ? '<span class="sb-pl-dot"></span>' : '';
    btn.innerHTML = `${iconHtml}<span class="sb-pl-name">${esc(pl.name)}</span>${dotHtml}`;
    btn.addEventListener('click', () => {
      if (activePlaylistId !== pl.id) plFilterQuery = '';
      showPlaylistView(pl.id);
    });
    btn.addEventListener('contextmenu', e => { e.preventDefault(); openPlaylistEditor(pl.id); });

    // Reordenar listas arrastrando en la barra lateral
    btn.draggable = true;
    btn.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.effectAllowed = 'move';
      btn.classList.add('dragging');
    });
    btn.addEventListener('dragend', () => btn.classList.remove('dragging'));
    btn.addEventListener('dragover', e => {
      e.preventDefault();
      const r = btn.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      btn.classList.add('drag-over');
      btn.classList.toggle('drop-after', after);
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('drag-over', 'drop-after'));
    btn.addEventListener('drop', e => {
      e.preventDefault();
      btn.classList.remove('drag-over', 'drop-after');
      const from = Number(e.dataTransfer.getData('text/plain'));
      if (Number.isNaN(from) || from === index) return;
      flip(nav, () => {
        const [moved] = state.playlists.splice(from, 1);
        state.playlists.splice(index, 0, moved);
        updatePlaylistNav();
      });
      saveState();
    });

    nav.appendChild(btn);
  });
}

let plFilterQuery = '';
let plRenderedId = null;   // última lista escalonada, para no repetir la entrada

// Nombre, portada y color de la lista, sin reconstruir la tabla. El editor la
// llama en cada cambio para que se vea en el momento sobre la cabecera real.
function applyPlaylistTheme(pl) {
  const view = $('view-playlist');
  // Color de la lista: variables con ámbito en la vista. No se toca --dyn ni
  // --accent globales, que pertenecen al color extraído de la carátula que suena.
  view.style.setProperty('--pl-accent', playlistAccent(pl));
  view.style.setProperty('--pl-grad', playlistGradient(pl));
  view.classList.toggle('pl-custom', playlistIsCustom(pl));
  $('plViewTitle').textContent = pl.name;
  if (pl.cover) {
    $('plCoverImg').src = pl.cover; $('plCoverImg').style.display = 'block'; $('plCoverPh').style.display = 'none';
  } else {
    $('plCoverImg').style.display = 'none'; $('plCoverPh').style.display = 'flex';
  }
  updatePlaylistNav();
}

function showPlaylistView(id) {
  activePlaylistId = id;
  const pl = state.playlists.find(p => p.id === id);
  if (!pl) return;
  applyPlaylistTheme(pl);
  $('plHeaderLabel').textContent = T.playlists;
  $('plSearchInput').value = plFilterQuery;

  const allTracks = pl.tracks.map(p => library.find(t => t.path === p)).filter(Boolean);
  $('plCount').textContent = T.songs_count(allTracks.length);
  const q = plFilterQuery.trim().toLowerCase();
  const tracks = q
    ? allTracks.filter(t => [t.title, t.artist, t.album].some(s => (s || '').toLowerCase().includes(q)))
    : allTracks;

  const tbl = $('plTrackTable'); tbl.innerHTML = '';
  tbl.dataset.view = pl.view;
  tbl.dataset.density = pl.density;
  $('plViewListBtn').classList.toggle('active', pl.view === 'list');
  $('plViewGridBtn').classList.toggle('active', pl.view === 'grid');
  $('plDensityBtn').classList.toggle('active', pl.density === 'compact');

  // showPlaylistView() se vuelve a llamar en cada mutación (quitar, reordenar,
  // filtrar, cambiar vista). El escalonado sólo tiene sentido al ENTRAR en una
  // lista distinta; si no, cada borrado haría parpadear la tabla entera.
  const fresh = plRenderedId !== id;
  plRenderedId = id;

  const empty = $('plEmpty');
  if (!tracks.length) {
    empty.classList.add('show'); tbl.style.display = 'none';
  } else {
    empty.classList.remove('show'); tbl.style.display = '';
    tracks.forEach((t, i) => tbl.appendChild(maybeStagger(fresh, makeRow(t, i, tracks, '4col', {
      onRemove: (track) => {
        pl.tracks = pl.tracks.filter(p => p !== track.path);
        showPlaylistView(id);
        saveState();
      },
      // Sin filtro activo: los índices visibles coinciden con los reales.
      onReorder: q ? null : (fromIdx, toIdx) => {
        const fromPath = tracks[fromIdx].path;
        const toPath = tracks[toIdx].path;
        const realFrom = pl.tracks.indexOf(fromPath);
        const realTo = pl.tracks.indexOf(toPath);
        if (realFrom === -1 || realTo === -1) return;
        // FLIP: la tabla se reconstruye entera, pero las filas se deslizan.
        flip(tbl, () => {
          pl.tracks.splice(realFrom, 1);
          pl.tracks.splice(realTo, 0, fromPath);
          showPlaylistView(id);
        });
        saveState();
      },
    }), i)));
  }
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sb-pl-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  showDetailView('playlist');
  highlightRows();
}

// ── Vista y densidad de la lista ───────────────────────────────────────────
function setPlaylistOption(patch) {
  const pl = state.playlists.find(p => p.id === activePlaylistId);
  if (!pl) return;
  Object.assign(pl, patch);
  // FLIP para que el cambio de disposición deslice en vez de saltar.
  flip($('plTrackTable'), () => showPlaylistView(pl.id));
  saveState();
}

$('plViewListBtn').addEventListener('click', () => setPlaylistOption({ view: 'list' }));
$('plViewGridBtn').addEventListener('click', () => setPlaylistOption({ view: 'grid' }));
$('plDensityBtn').addEventListener('click', () => {
  const pl = state.playlists.find(p => p.id === activePlaylistId);
  if (pl) setPlaylistOption({ density: pl.density === 'compact' ? 'normal' : 'compact' });
});

$('plSearchInput').addEventListener('input', e => {
  plFilterQuery = e.target.value;
  if (activePlaylistId) showPlaylistView(activePlaylistId);
});

// Elegir una imagen del disco como portada. Devuelve el data URL o null.
async function pickCoverImage() {
  const path = await dialogOpen({
    multiple: false, directory: false,
    filters: [{ name: 'Imagen', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
  }).catch(() => null);
  if (!path) return null;
  return await invoke('read_image_as_data_url', { path }).catch(() => null);
}

// Mosaico 2×2 con las primeras carátulas distintas de la lista. Si no hay al
// menos cuatro, se devuelve null y se deja el degradado + icono, que ya
// identifica la lista sin inventar una portada a medias.
function buildPlaylistMosaic(pl) {
  return new Promise(resolve => {
    const covers = [];
    for (const p of pl.tracks) {
      const t = library.find(x => x.path === p);
      if (t?.cover && !covers.includes(t.cover)) covers.push(t.cover);
      if (covers.length === 4) break;
    }
    if (covers.length < 4) { resolve(null); return; }
    const S = 200;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S * 2;
    const ctx = canvas.getContext('2d');
    let done = 0;
    covers.forEach((src, i) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        if (img.naturalWidth) ctx.drawImage(img, (i % 2) * S, Math.floor(i / 2) * S, S, S);
        if (++done === 4) resolve(canvas.toDataURL('image/jpeg', .85));
      };
      img.src = src;
    });
  });
}

$('plCover').addEventListener('click', () => {
  if (activePlaylistId) openPlaylistEditor(activePlaylistId);
});

$('plEditBtn').addEventListener('click', () => {
  if (activePlaylistId) openPlaylistEditor(activePlaylistId);
});

$('newPlaylistBtn').addEventListener('click', () => {
  openModal(T.modalNewPlaylist, '', name => {
    if (!name.trim()) return;
    state.playlists.push(normalizePlaylist({ id: uid(), name: name.trim() }));
    updatePlaylistNav(); saveState();
  });
});

// ── Editor de lista (nombre, color, portada) ───────────────────────────────
// Los cambios se aplican EN VIVO sobre la cabecera real de la lista: se ve al
// instante qué toca cada control (el degradado tiñe el banner, la portada y el
// punto de la barra lateral). "Guardar" sólo persiste; "Cancelar" restaura la
// instantánea previa. Así no hay que adivinar si se ha guardado o no.
function openPlaylistEditor(id) {
  const pl = state.playlists.find(p => p.id === id);
  if (!pl) return;
  const snapshot = {
    name: pl.name, color: pl.color,
    gradient: pl.gradient ? { ...pl.gradient } : null,
    cover: pl.cover,
  };

  const initial = pl.gradient || { from: pl.color || '#7c5cfc', to: pl.color || '#7c5cfc', angle: 135 };
  let twoTone = !!pl.gradient && pl.gradient.from !== pl.gradient.to;

  openFormModal({
    title: T.editPlaylist,
    okLabel: T.save,
    nameValue: pl.name,
    namePlaceholder: T.modalPlaceholder,
    onCancel: () => {
      $('modalInput').oninput = null;
      Object.assign(pl, snapshot);
      applyPlaylistTheme(pl);
    },
    fieldsHtml: `
      <div class="mf-field">
        <div class="mf-label">${T.fieldColor}</div>
        <div class="mf-row">
          <input type="color" class="mf-color" id="mfFrom" value="${esc(initial.from)}" title="${T.colorMain}">
          <input type="color" class="mf-color" id="mfTo" value="${esc(initial.to)}" title="${T.colorSecond}">
          <label class="mf-check"><input type="checkbox" id="mfTwo"> ${T.useGradient}</label>
          <button class="btn-sec mf-mini" id="mfClearGrad">${T.reset}</button>
        </div>
        <div class="mf-row mf-angle-row" id="mfAngleRow">
          <span class="mf-label">${T.angle}</span>
          <input type="range" class="mf-angle" id="mfAngle" min="0" max="360" step="5" value="${initial.angle}">
        </div>
      </div>
      <div class="mf-field">
        <div class="mf-label">${T.fieldCover}</div>
        <div class="mf-row">
          <button class="btn-action" id="mfPickCover">${T.chooseImage}</button>
          <button class="btn-action" id="mfMosaic">${T.autoMosaic}</button>
          <button class="btn-action danger" id="mfClearCover">${T.reset}</button>
        </div>
      </div>`,
    onReady: () => {
      const from = $('mfFrom'), to = $('mfTo'), angle = $('mfAngle'), two = $('mfTwo');
      two.checked = twoTone;

      const syncControls = () => {
        to.style.display = two.checked ? '' : 'none';
        $('mfAngleRow').style.display = two.checked ? '' : 'none';
      };

      const apply = () => {
        if (two.checked) {
          pl.gradient = { from: from.value, to: to.value, angle: Number(angle.value) };
          pl.color = from.value;
        } else {
          pl.gradient = null;
          pl.color = from.value;
        }
        applyPlaylistTheme(pl);
      };

      syncControls();
      [from, to, angle].forEach(el => el.addEventListener('input', apply));
      two.addEventListener('change', () => { syncControls(); apply(); });

      $('mfClearGrad').addEventListener('click', () => {
        pl.color = null; pl.gradient = null;
        two.checked = false; syncControls();
        applyPlaylistTheme(pl);
      });

      $('mfPickCover').addEventListener('click', async () => {
        const url = await pickCoverImage();
        if (url) { pl.cover = url; applyPlaylistTheme(pl); }
      });
      $('mfMosaic').addEventListener('click', async () => {
        const url = await buildPlaylistMosaic(pl);
        if (url) { pl.cover = url; applyPlaylistTheme(pl); }
        else $('mfMosaic').textContent = T.mosaicNeedsFour;
      });
      $('mfClearCover').addEventListener('click', () => { pl.cover = null; applyPlaylistTheme(pl); });

      // El nombre también se ve al escribirlo
      $('modalInput').oninput = () => {
        pl.name = $('modalInput').value.trim() || snapshot.name;
        applyPlaylistTheme(pl);
      };
    },
    onSubmit: name => {
      $('modalInput').oninput = null;
      pl.name = (name || '').trim() || snapshot.name;
      applyPlaylistTheme(pl);
      saveState();
    },
  });
}

$('deletePlBtn').addEventListener('click', () => {
  if (!activePlaylistId) return;
  state.playlists = state.playlists.filter(p => p.id !== activePlaylistId);
  activePlaylistId = null;
  plFilterQuery = '';
  updatePlaylistNav();
  showView('songs'); saveState();
});

// ── Playback ───────────────────────────────────────────────────────────────
function playTracklist(tracks, idx) {
  state.queue = [...tracks];
  state.current_index = idx;
  if (state.shuffle) shuffleFrom(idx);
  loadAndPlay(state.current_index);
  saveState();
}

function playIndex(idx) {
  if (idx < 0 || idx >= state.queue.length) return;
  state.current_index = idx;
  loadAndPlay(idx); saveState();
}

// Fija audio.src y espera a canplay/error. Devuelve true si quedó listo
// para reproducir, false si el navegador no pudo con esa fuente.
function trySrc(url, el = audio) {
  el.src = url;
  return new Promise(resolve => {
    const onOk = () => { cleanup(); resolve(true); };
    const onErr = () => { cleanup(); resolve(false); };
    const cleanup = () => { el.removeEventListener('canplay', onOk); el.removeEventListener('error', onErr); };
    el.addEventListener('canplay', onOk, { once: true });
    el.addEventListener('error', onErr, { once: true });
    el.load();
  });
}

// ── Servidor HTTP Local para Audio ──────────────────────────────────────────
let localServerPort = 0;
invoke('get_server_port').then(p => { localServerPort = p || 0; }).catch(() => { });

async function getAudioSrc(path) {
  if (!localServerPort) {
    localServerPort = await invoke('get_server_port').catch(() => 0);
  }
  if (localServerPort) {
    return `http://127.0.0.1:${localServerPort}/stream?path=${encodeURIComponent(path)}`;
  }
  return convertFileSrc(path);
}

// Lee el archivo entero y arma un Blob URL con el mime correcto — el
// respaldo de siempre cuando asset:// o HTTP no andan.
async function loadAsBlobUrl(path, el = audio) {
  if (el._blobUrl) { URL.revokeObjectURL(el._blobUrl); el._blobUrl = null; }
  const buf = await invoke('read_audio_bytes', { path });
  const blob = new Blob([buf], { type: mimeForPath(path) });
  const url = URL.createObjectURL(blob);
  el._blobUrl = url;
  return url;
}

// Si la fuente se corta A MITAD de la reproducción (archivos corruptos/red), reintenta con Blob
let _usingAsset = false;
let _fallbackTried = false;
// Token de generación: mismo patrón que `_songsRenderGen` en renderSongs().
// Cada llamada a loadAndPlay() se queda con un número; si llega otra (o el
// usuario cambia de pista), la vieja deja de tocar `audio.src`.
let _loadGen = 0;
// Mientras loadAndPlay() resuelve su propia cadena de fuentes, el listener de
// 'error' y el watchdog NO deben intervenir: si no, los dos caminos se pisan
// el `audio.src` a la vez. Con un mp3 pequeño casi no se solapan, pero con un
// FLAC de decenas de MB la lectura a Blob tarda y rompe la reproducción.
let _loading = false;

async function fallbackToBlobAndResume() {
  if (_loading || _fallbackTried) return;
  const t = state.queue[state.current_index];
  if (!t) return;
  _fallbackTried = true;
  const myGen = _loadGen;
  const resumeAt = audio.currentTime;
  try {
    const url = await loadAsBlobUrl(t.path);
    if (myGen !== _loadGen) return;   // llegó una carga más nueva
    _usingAsset = false;
    const ok = await trySrc(url);
    if (myGen !== _loadGen) return;
    if (ok) { audio.currentTime = resumeAt; await audio.play(); }
  } catch (err) {
    console.error('fallback playback failed:', err);
  }
}
// Solo el elemento activo dispara la recuperación: el que se está apagando en
// un crossfade no debe reescribir la fuente de nada.
[audioA, audioB].forEach(el => el.addEventListener('error', () => {
  if (el !== audio) return;
  const e = el.error;
  console.error('audio error code', e && e.code, e && e.message);
  fallbackToBlobAndResume();
}));

// Watchdog de stream colgado: si currentTime no avanza durante unos segundos mientras debería estar sonando
let _lastProgressTime = 0;
let _lastProgressAt = 0;
const STALL_TIMEOUT_MS = 6000;
[audioA, audioB].forEach(el => el.addEventListener('timeupdate', () => {
  if (el !== audio) return;
  _lastProgressTime = el.currentTime;
  _lastProgressAt = performance.now();
}));
setInterval(() => {
  if (_loading || audio.paused || _fallbackTried) return;
  if (!_lastProgressAt) return;
  const stuckFor = performance.now() - _lastProgressAt;
  if (stuckFor > STALL_TIMEOUT_MS && audio.currentTime === _lastProgressTime) {
    console.error('audio stalled (sin avanzar por', Math.round(stuckFor / 1000), 's) — cayendo a Blob');
    fallbackToBlobAndResume();
  }
}, 2000);

// ── Crossfade ──────────────────────────────────────────────────────────────
// state.crossfade son segundos; 0 = desactivado.
let crossfading = false;
const _ramps = new WeakMap();

// Rampa de volumen por rAF. No se usa una transición CSS porque .volume no es
// una propiedad de estilo, y un setInterval a 60 Hz gasta más de lo necesario.
function rampVolume(el, from, to, ms) {
  cancelRamp(el);
  const t0 = performance.now();
  setLevel(el, from);
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    // Curva de potencia igual (raíz): dos rampas lineales cruzadas hunden el
    // volumen percibido en el centro del fundido; con esta el nivel se mantiene.
    const v = from + (to - from) * Math.sqrt(k);
    setLevel(el, v);
    if (k < 1) _ramps.set(el, requestAnimationFrame(step));
    else _ramps.delete(el);
  };
  _ramps.set(el, requestAnimationFrame(step));
}

function cancelRamp(el) {
  const id = _ramps.get(el);
  if (id) { cancelAnimationFrame(id); _ramps.delete(el); }
}

// Aparca el elemento que se apaga: parar, soltar la fuente y devolver el
// volumen, para que la próxima vez que le toque el turno empiece limpio.
function parkAudio(el) {
  cancelRamp(el);
  el.pause();
  el.removeAttribute('src');
  el.load();
  setLevel(el, state.volume);
  if (el._blobUrl) { URL.revokeObjectURL(el._blobUrl); el._blobUrl = null; }
}

function cancelCrossfade() {
  discardPreload();
  if (!crossfading) return;
  crossfading = false;
  parkAudio(idleAudio());
  cancelRamp(audio);
  setLevel(audio, state.volume);
}

function nextIndexForCrossfade() {
  if (state.repeat === 'one' || !state.queue.length) return -1;
  const n = state.current_index + 1;
  if (n < state.queue.length) return n;
  return state.repeat === 'all' ? 0 : -1;
}

// El crossfade NO alarga la reproducción: los N segundos se solapan. La pista
// entrante arranca N segundos antes de que acabe la saliente, así que el total
// se acorta en N, no se alarga.
//
// Para que el fundido dure exactamente N, la fuente tiene que estar lista ANTES
// de llegar al punto de solape. Cargarla al llegar (como se hacía) tenía dos
// fallos: el fundido salía más corto que lo pedido, y con un crossfade corto o
// un archivo grande la pista podía terminar durante la carga — entonces saltaba
// 'ended', el relevo normal cancelaba el fundido y sonaba un corte seco.
const PRELOAD_LEAD = 8;
let _preload = null;   // { idx, el, ready }

function discardPreload() {
  if (!_preload) return;
  const el = _preload.el;
  _preload = null;
  parkAudio(el);
}

async function preloadNext(idx) {
  let t = state.queue[idx];
  if (!t) return;
  const el = idleAudio();
  const mine = { idx, el, ready: false };
  _preload = mine;

  if (!t.title && !t.duration) {
    t = await invoke('read_track_meta', { path: t.path }).catch(() => t);
    state.queue[idx] = t;
  }
  let ok = false;
  try {
    const url = await getAudioSrc(t.path);
    if (_preload !== mine) return;              // se descartó mientras cargaba
    ok = await trySrc(url, el);
    if (!ok && !webAudioReady && _preload === mine) ok = await trySrc(convertFileSrc(t.path), el);
  } catch (err) {
    console.error('crossfade preload failed:', err);
  }
  if (_preload !== mine) return;
  // Sin caída a Blob a propósito: leer un FLAC entero a memoria llegaría tarde
  // igualmente. Si la fuente falla, se deja el relevo normal sin fundido.
  if (!ok) { discardPreload(); return; }
  setLevel(el, 0);
  mine.ready = true;
}

// Muchas pistas traen segundos de silencio pegados al final del archivo. Como
// el punto de fundido se calcula desde el final del ARCHIVO, el solape caía
// entero dentro de ese silencio: la música paraba, y la siguiente entraba sola
// y despacio sobre la nada. Midiendo la señal se sabe dónde acaba la música.
const SILENCE_PEAK = 0.012;        // ≈ -38 dBFS
const SILENCE_HOLD_MS = 400;       // sostenido, para no confundirlo con un compás en blanco
const SILENCE_WINDOW = 45;         // solo se vigila cerca del final
let _silentSince = 0;

// Devuelve true si la pista activa lleva ya un rato en silencio de verdad.
function tailWentSilent(left) {
  if (left > SILENCE_WINDOW) { _silentSince = 0; return false; }
  const peak = currentPeak(audio);
  if (peak === null) return false;               // sin grafo: no se puede saber
  if (peak > SILENCE_PEAK) { _silentSince = 0; return false; }
  const now = performance.now();
  if (!_silentSince) { _silentSince = now; return false; }
  return now - _silentSince >= SILENCE_HOLD_MS;
}

// Llamado desde 'timeupdate' del elemento activo (~4 veces por segundo).
function maybeCrossfade() {
  const secs = Number(state.crossfade) || 0;
  if (!secs || crossfading || _loading) return;
  const dur = audio.duration;
  if (!dur || !isFinite(dur)) return;

  const n = nextIndexForCrossfade();
  if (n < 0) { discardPreload(); return; }
  if (_preload && _preload.idx !== n) discardPreload();   // cambió la cola

  const left = dur - audio.currentTime;
  // Se precarga con margen suficiente para cubrir también el caso del silencio,
  // que puede adelantar el relevo bastante más que `secs`.
  if (left <= SILENCE_WINDOW && !_preload) preloadNext(n);

  const silent = tailWentSilent(left);
  if (!silent && (left > secs || left < .25)) return;
  if (!_preload || !_preload.ready) return;              // aún cargando: se reintenta al siguiente tick

  // Con la saliente ya en silencio no hay nada que fundir: la entrante entra a
  // volumen normal con una rampa mínima (evita el chasquido) y la vieja se
  // aparca en el acto. Cruzar sobre silencio es justo lo que sonaba raro.
  if (silent) beginFade(n, 200, true);
  else beginFade(n, Math.min(secs, left) * 1000, false);
}

// Síncrona a propósito: en el punto de solape ya no se puede esperar a nada.
function beginFade(idx, ms, cutTail) {
  const t = state.queue[idx];
  const incoming = _preload.el;
  _preload = null;
  _silentSince = 0;
  if (!t) { parkAudio(incoming); return; }

  const outgoing = audio;
  crossfading = true;
  resumeWebAudio();
  setLevel(incoming, 0);
  const p = incoming.play();
  if (p && p.catch) p.catch(() => { crossfading = false; parkAudio(incoming); });

  if (cutTail) cancelRamp(outgoing), outgoing.pause();
  else rampVolume(outgoing, getLevel(outgoing), 0, ms);
  rampVolume(incoming, 0, state.volume, ms);

  // El relevo de "pista actual" es inmediato: la barra, el inmersivo, MPRIS y
  // la cola deben hablar ya de lo que se está oyendo entrar.
  audio = incoming;
  state.current_index = idx;
  updateNowPlaying(t);
  highlightRows();
  pushHistory(t);
  if (currentView === 'home') renderHome();
  renderQueuePanel();
  saveState();
  extractColor(t.cover || null).then(applyDyn);

  setTimeout(() => {
    if (!crossfading) return;
    crossfading = false;
    parkAudio(outgoing);
    setLevel(audio, state.volume);
  }, ms + 60);
}

async function loadAndPlay(idx) {
  let t = state.queue[idx];
  if (!t) return;
  // El grafo de Web Audio solo se monta si el crossfade está activo: con el
  // ajuste a 0 la ruta de audio se queda exactamente como estaba.
  if (state.crossfade) initWebAudio();
  // Un cambio de pista manual manda sobre cualquier fundido en curso.
  cancelCrossfade();
  setLevel(audio, state.volume);
  if (!t.title && !t.duration) {
    t = await invoke('read_track_meta', { path: t.path }).catch(() => t);
    state.queue[idx] = t;
  }

  _fallbackTried = false;
  _lastProgressAt = 0;
  _lastProgressTime = 0;
  const myGen = ++_loadGen;
  _loading = true;
  try {
    // Cadena de fuentes, en orden de preferencia. Se corta en cuanto una
    // funciona, y se aborta entera si entretanto empezó otra carga.
    const srcUrl = await getAudioSrc(t.path);
    if (myGen !== _loadGen) return;
    let ok = await trySrc(srcUrl);
    if (!ok && !webAudioReady && myGen === _loadGen) {
      ok = await trySrc(convertFileSrc(t.path));
    }
    if (!ok && myGen === _loadGen) {
      const blobUrl = await loadAsBlobUrl(t.path);
      if (myGen !== _loadGen) return;
      ok = await trySrc(blobUrl);
    }
    if (myGen !== _loadGen) return;
    if (ok) { resumeWebAudio(); await audio.play(); }
  } catch (err) {
    console.error('playback failed:', err);
  } finally {
    // Solo la carga vigente levanta el flag: si otra la reemplazó, ella manda.
    if (myGen === _loadGen) _loading = false;
  }
  updateNowPlaying(t);
  highlightRows();
  pushHistory(t);
  if (currentView === 'home') renderHome();
  renderQueuePanel();
  saveState();
  // Extract dominant color off the critical path (don't block playback start)
  extractColor(t.cover || null).then(applyDyn);
}

function updateNowPlaying(t) {
  syncImmFavorite();
  const title = t.title || t.path.split('/').pop();
  const artist = t.artist || '—';
  // player bar
  $('pbTitle').textContent = title;
  $('pbArtist').textContent = artist;
  if (t.cover) {
    $('pbArtImg').src = t.cover; $('pbArtImg').style.display = 'block'; $('pbArtPh').style.display = 'none';
  } else {
    $('pbArtImg').style.display = 'none'; $('pbArtPh').style.display = 'flex';
  }
  // immersive
  $('immTitle').textContent = title;
  $('immArtist').textContent = artist;
  $('immAlbum').textContent = t.album || '';
  if (t.cover) {
    $('immArt').src = t.cover; $('immArt').style.display = 'block'; $('immArtPh').style.display = 'none';
    colorField(t.cover).then(url => {
      if (state.queue[state.current_index]?.path === t.path) setImmersiveBg(url ? `url('${url}')` : '');
    });
    loadFullArt(t.path);
  } else {
    $('immArt').style.display = 'none'; $('immArtPh').style.display = 'flex';
    setImmersiveBg('');
  }
}

// Fondo de pantalla completa: la portada reducida a 6×6 píxeles, cada uno la
// media de su zona, que luego CSS estira a toda la ventana. Quedan campos de
// color suaves sin ninguna forma reconocible. Se probó con blur de CSS sobre la
// portada girando, y WebKit no aplica bien el filtro a capas animadas: en la
// app se leían las letras de la carátula. Esto no depende del filtro.
// Reducción en dos pasos (→48→6): de golpe, drawImage muestrea en vez de
// promediar y salen colores de píxeles sueltos.
async function colorField(src) {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch (err) {
    console.error('carátula ilegible:', err);
    return null;
  }
  const step = n => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  const mid = step(48), out = step(6);
  mid.getContext('2d').drawImage(img, 0, 0, 48, 48);
  out.getContext('2d').drawImage(mid, 0, 0, 6, 6);
  return out.toDataURL('image/png');
}

// La portada grande de pantalla completa, a tamaño original. El fondo se queda
// con la miniatura: va difuminado y a 1/4 de tamaño, no se nota.
function loadFullArt(path) {
  invoke('read_covers', { paths: [path] }).then(([got]) => {
    const full = got && got[1];
    if (full && state.queue[state.current_index]?.path === path) $('immArt').src = full;
  }).catch(err => console.error('read_covers:', err));
}

// Dos capas alternándose: `background-image` no es interpolable, así que la
// transición anterior no animaba nada y el cambio de carátula era un corte.
// El crossfade se hace con opacity, que se compone en GPU.
let immBgFront = 0;
let immBgSrc = '';
function setImmersiveBg(image) {
  // Comparación contra el valor crudo: el navegador normaliza style.backgroundImage
  // (url('x') → url("x")), así que compararlo consigo mismo nunca coincidiría.
  if (image === immBgSrc) return;
  immBgSrc = image;
  const layers = [$('immBg'), $('immBg2')];
  const front = layers[immBgFront];
  const back = layers[1 - immBgFront];
  // Variable y no background-image: la pintan las dos copias giratorias de
  // dentro (::before/::after), no la capa.
  back.style.setProperty('--art', image || 'none');
  back.classList.add('show');
  front.classList.remove('show');
  immBgFront = 1 - immBgFront;
}

function setPlayIcon(playing) {
  const animate = !kbActionRecent() && !reducedMotion();
  [$('playBtn'), $('immPlay')].forEach(btn => {
    btn.classList.toggle('is-playing', playing);
    const shown = btn.querySelector(playing ? '.icon-pause' : '.icon-play');
    btn.querySelector('.icon-play').style.display = playing ? 'none' : 'block';
    btn.querySelector('.icon-pause').style.display = playing ? 'block' : 'none';
    shown.classList.remove('morphing');
    if (animate) requestAnimationFrame(() => shown.classList.add('morphing'));
  });
  document.querySelectorAll('.tr.playing').forEach(r => r.classList.toggle('paused', !playing));
}

function shuffleFrom(idx) {
  const first = state.queue[idx];
  const rest = state.queue.filter((_, i) => i !== idx);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[rest[i], rest[j]] = [rest[j], rest[i]]; }
  state.queue = [first, ...rest]; state.current_index = 0;
}

function bounceCtrl(btn, dir) {
  if (!btn || kbActionRecent() || reducedMotion()) return;
  const cls = 'bounce-' + dir;
  btn.classList.remove(cls);
  requestAnimationFrame(() => btn.classList.add(cls));
  btn.addEventListener('animationend', () => btn.classList.remove(cls), { once: true });
}

function playNext() {
  bounceCtrl($('nextBtn'), 'next'); bounceCtrl($('immNext'), 'next');
  if (!state.queue.length) return;
  if (state.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  let n = state.current_index + 1;
  if (n >= state.queue.length) { if (state.repeat === 'all') n = 0; else return; }
  playIndex(n);
}
function playPrev() {
  bounceCtrl($('prevBtn'), 'prev'); bounceCtrl($('immPrev'), 'prev');
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  let p = state.current_index - 1;
  if (p < 0) p = state.repeat === 'all' ? state.queue.length - 1 : 0;
  playIndex(p);
}

// ── Audio events ───────────────────────────────────────────────────────────
[audioA, audioB].forEach(el => {
  el.addEventListener('playing', () => { if (el === audio) setPlayIcon(true); });
  el.addEventListener('pause', () => { if (el === audio) setPlayIcon(false); });
  // El elemento que se apaga en un crossfade también emite 'ended': si no se
  // filtrara, saltaría DOS pistas.
  el.addEventListener('ended', () => { if (el === audio) playNext(); });
  el.addEventListener('timeupdate', () => { if (el === audio) { updateProgress(); maybeCrossfade(); } });
  el.addEventListener('durationchange', () => { if (el === audio) updateProgress(); });
});
// (el manejador de 'error' con la recuperación automática vive junto a
// loadAndPlay/trySrc, más arriba)

function updateProgress() {
  const { currentTime: ct, duration: dur } = audio;
  const pct = dur ? (ct / dur) * 100 : 0;
  const val = dur ? Math.round((ct / dur) * 1000) : 0;
  $('pbProgFill').style.width = pct + '%';
  $('immProgFill').style.width = pct + '%';
  $('pbProgRange').value = val;
  $('immProgRange').value = val;
  $('pbTimeCur').textContent = fmt(ct);
  $('pbTimeDur').textContent = fmt(dur);
  $('immTimeCur').textContent = fmt(ct);
  // En la inmersiva el label derecho es lo que QUEDA, en negativo. Sin
  // duración todavía (metadatos sin cargar) no hay resta posible: se deja el
  // 0:00 de siempre en vez de un "-0:00" que parpadearía en cada pista.
  $('immTimeDur').textContent = dur ? '-' + fmt(Math.max(0, dur - ct)) : fmt(0);
}

function setVolume(v) {
  v = Math.max(0, Math.min(1, v));
  state.volume = v;
  // Durante un fundido las rampas mandan sobre el nivel; tocarlo aquí daría un
  // salto. El valor nuevo se aplica igualmente al acabar la rampa.
  if (!crossfading) setLevel(audio, v);
  // La barra del dock es vertical (crece hacia arriba) y la inmersiva
  // horizontal, así que cada relleno se pinta por el eje de su pista.
  document.querySelectorAll('.js-vol-fill').forEach(el => {
    const vertical = el.closest('.js-vol-track')?.classList.contains('vertical');
    el.style[vertical ? 'height' : 'width'] = (v * 100) + '%';
  });
  // sync mute icon to actual volume
  const muted = v === 0;
  document.querySelectorAll('.js-mute-btn').forEach(btn => {
    btn.classList.toggle('muted', muted);
    btn.querySelector('.icon-vol').style.display = muted ? 'none' : 'block';
    btn.querySelector('.icon-mute').style.display = muted ? 'block' : 'none';
  });
}

// ── Seek inputs ────────────────────────────────────────────────────────────
$('pbProgRange').addEventListener('input', e => { if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration; });
$('immProgRange').addEventListener('input', e => { if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration; });

// ── Volume — tracks via pointer drag (dock vertical + immersive horizontal) ─
let prevVol = 1;

function volFromPointer(track, clientX, clientY) {
  const rect = track.getBoundingClientRect();
  // En vertical el 100% está ARRIBA, de ahí el 1 - …
  const v = track.classList.contains('vertical')
    ? 1 - (clientY - rect.top) / rect.height
    : (clientX - rect.left) / rect.width;
  setVolume(v);
  saveState();
}

document.querySelectorAll('.js-vol-track').forEach(track => {
  track.addEventListener('pointerdown', e => {
    e.preventDefault();
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
    volFromPointer(track, e.clientX, e.clientY);
  });
  track.addEventListener('pointermove', e => {
    if (track.classList.contains('dragging')) volFromPointer(track, e.clientX, e.clientY);
  });
  track.addEventListener('pointerup', () => {
    track.classList.remove('dragging');
  });
  // scroll wheel over the volume = adjust
  track.addEventListener('wheel', e => {
    e.preventDefault();
    setVolume(state.volume + (e.deltaY < 0 ? .05 : -.05));
    saveState();
  }, { passive: false });
});

// ── Mute toggle ────────────────────────────────────────────────────────────
document.querySelectorAll('.js-mute-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (audio.volume > 0) {
      prevVol = audio.volume;
      setVolume(0);
    } else {
      setVolume(prevVol || 0.7);
    }
    saveState();
  });
});

// ── Control buttons ────────────────────────────────────────────────────────
$('playBtn').addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
$('prevBtn').addEventListener('click', playPrev);
$('nextBtn').addEventListener('click', playNext);
$('immPlay').addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
$('immPrev').addEventListener('click', playPrev);
$('immNext').addEventListener('click', playNext);

// ── Shuffle / repeat — mirrored between mini bar and immersive view ────────
function syncShuffleRepeatUI() {
  document.querySelectorAll('.js-shuffle-btn').forEach(b => b.classList.toggle('active', state.shuffle));
  document.querySelectorAll('.js-repeat-btn').forEach(b => {
    b.classList.toggle('active', state.repeat !== 'none');
    // 'one' y 'all' se tiñen igual; el punto que dibuja .repeat-one es lo
    // único que los distingue de un vistazo.
    b.classList.toggle('repeat-one', state.repeat === 'one');
    b.title = state.repeat === 'one' ? 'Repetir una' : state.repeat === 'all' ? 'Repetir todo' : 'Sin repetir';
  });
}

document.querySelectorAll('.js-shuffle-btn').forEach(btn => btn.addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  syncShuffleRepeatUI();
  bounceCtrl(btn, 'toggle');
  if (state.shuffle && state.queue.length) shuffleFrom(state.current_index);
  saveState();
}));

document.querySelectorAll('.js-repeat-btn').forEach(btn => btn.addEventListener('click', () => {
  const m = ['none', 'all', 'one'];
  state.repeat = m[(m.indexOf(state.repeat) + 1) % 3];
  syncShuffleRepeatUI();
  bounceCtrl(btn, 'toggle');
  saveState();
}));

// ── Window ─────────────────────────────────────────────────────────────────
$('closeBtn').addEventListener('click', () => appWindow.close());
$('minBtn').addEventListener('click', () => appWindow.minimize());
$('maxBtn').addEventListener('click', () => appWindow.toggleMaximize());
$('sidebarToggle').addEventListener('click', () => $('sidebar').classList.toggle('collapsed'));

// Sin decoraciones nativas, la ventana dibuja su propio borde redondeado de
// 20px "en modo ventana" — pero maximizada debe pegar a los bordes de la
// pantalla sin esquinas ni borde, si no algunos compositores dejan un hilo
// de escritorio visible entre la ventana y la pantalla (las "franjas").
async function syncMaximizedState() {
  const maxed = await appWindow.isMaximized().catch(() => false);
  app.classList.toggle('maximized', maxed);
}
syncMaximizedState();
appWindow.onResized(syncMaximizedState).catch(() => { });

// ── Immersive ──────────────────────────────────────────────────────────────
// Con sitio, la cola vive dentro del inmersivo como columna fija: se mueve
// con él al arrastrar para cerrar y comparte su fondo. En estrecho no cabe
// junto a la carátula y sigue siendo el popover de siempre.
const immWide = window.matchMedia('(min-width: 900px)');
function openImmersive() {
  $('immersive').classList.add('active');
  syncImmFavorite();
  if (!immWide.matches) return;
  $('immersive').appendChild($('queuePanel'));
  renderQueuePanel();
  $('queuePanel').classList.add('active');
  document.querySelectorAll('.js-queue-btn').forEach(b => b.classList.add('active'));
}

// La cola se abre POR ENCIMA del inmersivo; al salir hay que cerrarla también.
// Antes seguía abierta sobre la biblioteca, tapando media ventana sin que se
// hubiera pedido desde ahí.
function closeImmersive() {
  $('immersive').classList.remove('active');
  $('immersive').style.transform = '';
  closeQueuePanel();
  app.appendChild($('queuePanel'));
}

$('pbArt').addEventListener('click', openImmersive);
$('immClose').addEventListener('click', closeImmersive);

// Corazón: hasta ahora sólo se podía marcar favorito desde la tabla, justo lo
// que no se ve estando en pantalla completa.
function syncImmFavorite() {
  const t = state.queue[state.current_index];
  const btn = $('immFav');
  const on = !!t && isFavorite(t.path);
  btn.classList.toggle('active', on);
  btn.querySelector('svg').setAttribute('fill', on ? 'currentColor' : 'none');
}
$('immFav').addEventListener('click', () => {
  const t = state.queue[state.current_index];
  if (!t) return;
  toggleFavorite(t.path);
  syncImmFavorite();
});

// Arrastrar hacia abajo para cerrar. Con rozamiento al tirar hacia arriba (las
// cosas no chocan contra un muro invisible) y descarte por velocidad: un gesto
// rápido y corto basta, no hace falta llegar al umbral.
(function immersiveDrag() {
  const el = $('immersive');
  let startY = 0, startAt = 0, offset = 0, dragging = false;

  const damp = d => (d < 0 ? -Math.pow(-d, .7) : d);

  el.addEventListener('pointerdown', e => {
    // Sólo desde zonas muertas: no robar el gesto a botones ni a los sliders.
    if (e.target.closest('button, input, .imm-prog-wrap, .imm-vol-track, .imm-vol-row, .queue-panel')) return;
    if (dragging) return;                       // multitáctil: se ignora el segundo dedo
    dragging = true;
    startY = e.clientY; startAt = Date.now(); offset = 0;
    el.setPointerCapture(e.pointerId);          // el arrastre sigue aunque salga del elemento
    el.style.transition = 'none';
  });

  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    offset = damp(e.clientY - startY);
    el.style.transform = `translateY(${offset}px)`;
  });

  const end = e => {
    if (!dragging) return;
    dragging = false;
    el.style.transition = '';
    const velocity = offset / Math.max(1, Date.now() - startAt);
    if (offset > 140 || velocity > .5) closeImmersive();
    else el.style.transform = '';
    try { el.releasePointerCapture(e.pointerId); } catch (_) { }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
})();

// ── Queue panel ("Up next") ─────────────────────────────────────────────────
function renderQueuePanel() {
  const list = $('qpList'); const empty = $('qpEmpty');
  list.innerHTML = '';
  const upcoming = state.queue.slice(state.current_index + 1);
  if (!upcoming.length) { empty.classList.add('show'); list.style.display = 'none'; return; }
  empty.classList.remove('show'); list.style.display = '';
  upcoming.forEach((t, i) => {
    const realIdx = state.current_index + 1 + i;
    const item = document.createElement('div');
    item.className = 'qp-item';
    const coverHtml = t.cover
      ? `<img class="qp-item-cover" src="${esc(t.cover)}" loading="lazy" alt="">`
      : `<div class="qp-item-cover qp-item-cover-ph"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/></svg></div>`;
    item.innerHTML = `<span class="qp-item-num">${i + 1}</span>
      ${coverHtml}
      <div class="qp-item-info">
        <div class="qp-item-title">${esc(t.title || t.path.split('/').pop())}</div>
        <div class="qp-item-artist">${esc(t.artist || '—')}</div>
      </div>
      <button class="qp-item-rm" title="Quitar"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 18 18 6M6 6l12 12"/></svg></button>`;
    item.addEventListener('click', e => { if (e.target.closest('.qp-item-rm')) return; playIndex(realIdx); });
    item.querySelector('.qp-item-rm').addEventListener('click', e => {
      e.stopPropagation();
      state.queue.splice(realIdx, 1);
      renderQueuePanel(); saveState();
    });
    list.appendChild(item);
  });
}

function closeQueuePanel() {
  $('queuePanel').classList.remove('active');
  document.querySelectorAll('.js-queue-btn').forEach(b => b.classList.remove('active'));
}

document.querySelectorAll('.js-queue-btn').forEach(btn => btn.addEventListener('click', () => {
  renderQueuePanel();
  $('queuePanel').classList.toggle('active');
  const open = $('queuePanel').classList.contains('active');
  document.querySelectorAll('.js-queue-btn').forEach(b => b.classList.toggle('active', open));
}));
$('qpClose').addEventListener('click', closeQueuePanel);

// ── Search ─────────────────────────────────────────────────────────────────
let _searchDebounce = null;
$('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value.trim().toLowerCase();
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(() => {
    if (currentView !== 'songs') showView('songs');
    else renderSongs();
  }, 120);
});

// ── Sidebar nav ────────────────────────────────────────────────────────────
document.querySelectorAll('.sb-item[data-view]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ── Add folder ─────────────────────────────────────────────────────────────
async function addFolder() {
  const folder = await dialogOpen({ directory: true, multiple: false }).catch(() => null);
  if (!folder || state.music_folders.includes(folder)) return;
  state.music_folders.push(folder);
  renderFolders(); await saveState(); await scanAll();
}
$('addFolderBtn').addEventListener('click', addFolder);
$('emptyAddBtn').addEventListener('click', addFolder);
$('settingsAddFolderBtn').addEventListener('click', addFolder);

// ── Import individual files (into the library, or straight into a playlist) ─
const AUDIO_FILTER_EXTS = ['mp3', 'flac', 'ogg', 'opus', 'm4a', 'aac', 'wav', 'wv', 'ape', 'mpc'];

async function importFiles(playlistId) {
  const picked = await dialogOpen({
    multiple: true, directory: false,
    filters: [{ name: 'Audio', extensions: AUDIO_FILTER_EXTS }],
  }).catch(() => null);
  if (!picked) return;
  const paths = Array.isArray(picked) ? picked : [picked];
  if (!paths.length) return;

  const byPath = new Map(library.map(t => [t.path, t]));
  const importedByPath = new Map(state.imported_tracks.map(t => [t.path, t]));
  const added = [];
  for (const p of paths) {
    let t = byPath.get(p);
    if (!t) {
      t = await invoke('read_track_meta', { path: p }).catch(() => ({ path: p }));
      if (t.cover) t.cover = await makeThumb(t.cover);
      library.push(t);
      byPath.set(p, t);
    }
    added.push(t);
    // Se guarda siempre, aunque ya esté en una carpeta escaneada — scanAll()
    // lo deduplica por path, así que no pasa nada si queda de más. Sin esto,
    // los archivos importados fuera de cualquier carpeta registrada
    // desaparecían de la biblioteca (y de cualquier lista) al reiniciar.
    if (!importedByPath.has(p)) { state.imported_tracks.push(t); importedByPath.set(p, t); }
  }

  if (playlistId) {
    const pl = state.playlists.find(x => x.id === playlistId);
    if (pl) added.forEach(t => { if (!pl.tracks.includes(t.path)) pl.tracks.push(t.path); });
  }

  renderSongs(); renderAlbums(); renderArtists(); renderFavorites(); renderHome();
  if (playlistId) showPlaylistView(playlistId);
  await saveState();
}

$('importFilesBtn').addEventListener('click', () => importFiles(null));
$('plImportBtn').addEventListener('click', () => importFiles(activePlaylistId));

function renderFolders() {
  const list = $('foldersList'); list.innerHTML = '';
  state.music_folders.forEach(f => {
    const row = document.createElement('div');
    row.className = 'folder-row';
    row.innerHTML = `<span class="folder-path" title="${esc(f)}">${esc(f)}</span><button class="folder-rm" title="Quitar"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 18 18 6M6 6l12 12"/></svg></button>`;
    row.querySelector('.folder-rm').addEventListener('click', async () => {
      state.music_folders = state.music_folders.filter(x => x !== f);
      renderFolders(); await saveState(); await scanAll();
    });
    list.appendChild(row);
  });
}

// ── Shuffle all ────────────────────────────────────────────────────────────
$('shuffleAllBtn').addEventListener('click', () => {
  if (!library.length) return;
  state.shuffle = true; syncShuffleRepeatUI();
  playTracklist(library, Math.floor(Math.random() * library.length));
});

// ── Settings ───────────────────────────────────────────────────────────────
// Desplegable propio (el nativo no se puede estilar en WebKitGTK, ver style.css)
function initPicker(id, onChange) {
  const root = $(id);
  const btn = root.querySelector('.s-picker-btn');
  const label = root.querySelector('.s-picker-label');
  const menu = root.querySelector('.s-picker-menu');
  const opts = [...menu.querySelectorAll('.s-picker-opt')];

  const paint = value => {
    const opt = opts.find(o => o.dataset.value === value) || opts[0];
    root.dataset.value = opt.dataset.value;
    label.textContent = opt.textContent;
    opts.forEach(o => o.classList.toggle('active', o === opt));
  };

  const close = () => root.classList.remove('open');

  const open = () => {
    document.querySelectorAll('.s-picker.open').forEach(p => p !== root && p.classList.remove('open'));
    // El menú es fixed: se coloca bajo el botón, alineado a su borde derecho, y
    // se sube encima si no cabe abajo. El origen del zoom acompaña a esa esquina.
    const r = btn.getBoundingClientRect();
    menu.style.left = 'auto';
    menu.style.right = (window.innerWidth - r.right) + 'px';
    root.classList.add('open');
    const below = window.innerHeight - r.bottom > menu.offsetHeight + 16;
    menu.style.top = below ? (r.bottom + 6) + 'px' : (r.top - menu.offsetHeight - 6) + 'px';
    menu.style.setProperty('--picker-origin', below ? 'top right' : 'bottom right');
  };

  btn.addEventListener('click', e => {
    e.stopPropagation();
    root.classList.contains('open') ? close() : open();
  });
  menu.addEventListener('click', e => {
    const opt = e.target.closest('.s-picker-opt');
    if (!opt) return;
    close();
    paint(opt.dataset.value);
    onChange(opt.dataset.value);
  });
  document.addEventListener('click', e => { if (!root.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', close);

  paint(root.dataset.value);
  return { set: paint };
}

const themePicker = initPicker('themePicker', async v => { state.theme = v; await applyTheme(v); saveState(); });
const visualPicker = initPicker('visualPicker', v => { state.visual = v; applyVisual(v); saveState(); });
// Crossfade: deslizador de 0 a 12 s. Al arrastrar se actualiza el estado en el
// momento (para que el próximo relevo ya use el valor nuevo) pero el guardado a
// disco espera a soltar: si no, un arrastre escribiría el state.json ~60 veces.
function paintCrossfade() {
  const r = $('crossfadeRange');
  const v = Number(r.value) || 0;
  r.style.setProperty('--pct', (v / Number(r.max)) * 100 + '%');
  $('crossfadeVal').textContent = v ? `${v} s` : T.off;
}

function setCrossfade(v, persist) {
  state.crossfade = Number(v) || 0;
  if (state.crossfade) initWebAudio(); else cancelCrossfade();
  paintCrossfade();
  if (persist) saveState();
}

$('crossfadeRange').addEventListener('input', e => setCrossfade(e.target.value, false));
$('crossfadeRange').addEventListener('change', e => setCrossfade(e.target.value, true));

// ── Context menu ───────────────────────────────────────────────────────────
const ctx = $('ctx');
function showCtx(x, y, track) {
  ctxTrack = track;
  ctx.style.left = x + 'px'; ctx.style.top = y + 'px';
  // El menú sale del cursor, no del centro: se ancla a la esquina que toca
  // según el cuadrante de la pantalla en el que se ha hecho clic.
  const vertical = y > window.innerHeight / 2 ? 'bottom' : 'top';
  const horizontal = x > window.innerWidth / 2 ? 'right' : 'left';
  ctx.style.setProperty('--ctx-origin', `${vertical} ${horizontal}`);
  ctx.classList.add('active');
  const pls = $('ctxPls'); pls.innerHTML = '';
  if (!state.playlists.length) {
    pls.innerHTML = `<div style="padding:5px 12px;font-size:12px;color:var(--text-2)">${T.noLists}</div>`;
  } else {
    state.playlists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'ctx-item'; item.textContent = pl.name;
      item.addEventListener('click', () => {
        if (!pl.tracks.includes(ctxTrack.path)) pl.tracks.push(ctxTrack.path);
        saveState(); hideCtx();
      });
      pls.appendChild(item);
    });
  }
}
function hideCtx() { ctx.classList.remove('active'); ctxTrack = null; }
document.addEventListener('click', e => { if (!ctx.contains(e.target)) hideCtx(); });

$('ctxPlay').addEventListener('click', () => {
  if (!ctxTrack) return;
  const idx = library.findIndex(t => t.path === ctxTrack.path);
  if (idx >= 0) playTracklist(library, idx);
  hideCtx();
});
$('ctxPlayNext').addEventListener('click', () => {
  if (!ctxTrack) return;
  state.queue.splice(state.current_index + 1, 0, ctxTrack);
  renderQueuePanel();
  hideCtx(); saveState();
});

// ── Modal ──────────────────────────────────────────────────────────────────
// Un solo diálogo sirve para los dos casos: el prompt de siempre (un input) y
// el formulario de personalizar lista. openModal() queda como envoltorio para
// no tocar a quien ya lo usaba.
function openFormModal({ title, okLabel, nameValue = '', namePlaceholder, fieldsHtml = '', onReady, onSubmit, onCancel }) {
  modalCancelCb = onCancel;
  $('modalTitle').textContent = title;
  $('modalInput').value = nameValue;
  if (namePlaceholder) $('modalInput').placeholder = namePlaceholder;
  $('modalOk').textContent = okLabel || T.create;
  $('modalFields').innerHTML = fieldsHtml;
  $('modalBox').classList.toggle('modal-form', !!fieldsHtml);
  modalCb = onSubmit;
  $('modalBack').classList.remove('closing');
  $('modalBack').classList.add('active');
  onReady?.();
  $('modalInput').focus();
  $('modalInput').select();
}

function openModal(title, val, cb) {
  openFormModal({ title, nameValue: val, namePlaceholder: T.modalPlaceholder, okLabel: T.create, onSubmit: cb });
}

function closeModal({ cancelled = true } = {}) {
  const back = $('modalBack');
  if (!back.classList.contains('active') || back.classList.contains('closing')) return;
  const cancel = modalCancelCb;
  modalCb = null;
  modalCancelCb = null;
  // Cerrar sin aceptar deshace lo que se estuviera previsualizando en vivo.
  if (cancelled) cancel?.();
  // La salida se anima (140ms) y sólo después se oculta; antes desaparecía
  // de golpe. Más rápida que la entrada: el sistema responde, no delibera.
  back.classList.add('closing');
  const finish = () => {
    back.classList.remove('active', 'closing');
    $('modalFields').innerHTML = '';
    $('modalBox').classList.remove('modal-form');
  };
  if (reducedMotion()) { finish(); return; }
  back.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, 260); // red de seguridad si el animationend no llega
}

function submitModal() {
  const cb = modalCb;
  const value = $('modalInput').value;
  closeModal({ cancelled: false });
  cb?.(value);
}

$('modalCancel').addEventListener('click', () => closeModal());
$('modalOk').addEventListener('click', submitModal);
$('modalInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitModal();
  if (e.key === 'Escape') closeModal();
});
$('modalBack').addEventListener('click', e => { if (e.target === $('modalBack')) closeModal(); });

// ── Keyboard ───────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (['Space', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.code)) markKbAction();
  if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
  if (e.code === 'ArrowRight' && e.shiftKey) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
  else if (e.code === 'ArrowRight') playNext();
  if (e.code === 'ArrowLeft' && e.shiftKey) audio.currentTime = Math.max(0, audio.currentTime - 10);
  else if (e.code === 'ArrowLeft') playPrev();
  if (e.code === 'ArrowUp') setVolume(state.volume + .05);
  if (e.code === 'ArrowDown') setVolume(state.volume - .05);
  if (e.code === 'KeyF') {
    $('immersive').classList.contains('active') ? closeImmersive() : openImmersive();
  }
  if (e.code === 'Escape') { closeImmersive(); closeModal(); }
});

// ── Init ───────────────────────────────────────────────────────────────────
function applyTranslations() {
  // Sidebar nav labels — find last text node to avoid clobbering SVG
  const setSbLabel = (sel, text) => {
    const btn = document.querySelector(sel);
    // last child is the text node after the SVG
    const nodes = [...btn.childNodes].filter(n => n.nodeType === 3);
    if (nodes.length) nodes[nodes.length - 1].textContent = ' ' + text;
  };
  setSbLabel('[data-view="home"]', T.home);
  setSbLabel('[data-view="songs"]', T.songs);
  setSbLabel('[data-view="albums"]', T.albums);
  setSbLabel('[data-view="artists"]', T.artists);
  setSbLabel('[data-view="favorites"]', T.favorites);
  setSbLabel('[data-view="settings"]', T.settings);
  $('searchInput').placeholder = T.searchPlaceholder;
  const setLastText = (id, text) => {
    const el = $(id);
    const nodes = [...el.childNodes].filter(n => n.nodeType === 3);
    if (nodes.length) nodes[nodes.length - 1].textContent = ' ' + text;
    else el.appendChild(document.createTextNode(' ' + text));
  };
  setLastText('addFolderBtn', T.addFolder);
  setLastText('shuffleAllBtn', T.shuffleAll);
  $('importFilesLabel').textContent = T.importFiles;
  $('plImportLabel').textContent = T.importFiles;
  $('plSearchInput').placeholder = T.filterPlaceholder;
  // El click en la portada abre el editor completo, no sólo el selector de imagen
  $('plCoverEditLabel').textContent = T.customize;
  $('plEditLabel').textContent = T.customize;
  $('immFav').title = T.like;
  $('plViewListBtn').title = T.viewList;
  $('plViewGridBtn').title = T.viewGrid;
  $('plDensityBtn').title = T.density;
  $('plEmptySub').textContent = T.noResults;
  $('emptyAddBtn').textContent = T.addFolder;
  $('emptyState').querySelector('.empty-title').textContent = T.emptyTitle;
  $('emptyState').querySelector('.empty-sub').textContent = T.emptySub;
  $('pbTitle').textContent = T.noPlayback;
  $('immTitle').textContent = T.noPlayback;
  $('deletePlBtn').textContent = T.deletePlaylist;
  $('settingsAddFolderBtn').textContent = '+ ' + T.addFolder;
  // Settings labels
  const srows = document.querySelectorAll('.settings-row');
  srows[0].querySelector('.sr-title').textContent = T.theme;
  srows[0].querySelector('.sr-sub').textContent = T.themeSub;
  srows[1].querySelector('.sr-title').textContent = T.visual;
  srows[1].querySelector('.sr-sub').textContent = T.visualSub;
  document.querySelector('.sc-title').textContent = T.musicFolders;
  // Select options
  const setOpts = (picker, texts) => {
    picker.querySelectorAll('.s-picker-opt').forEach((o, i) => { o.textContent = texts[i]; });
  };
  setOpts($('themePicker'), [T.themeAuto, T.themeDark, T.themeLight]);
  setOpts($('visualPicker'), [T.visualOled, T.visualBlur]);
  $('crossfadeTitle').textContent = T.crossfade;
  $('crossfadeSub').textContent = T.crossfadeSub;
  themePicker.set(state.theme);
  visualPicker.set(state.visual);
  paintCrossfade();
  // Track table heads
  document.querySelectorAll('.th-title').forEach(el => el.textContent = T.title);
  document.querySelectorAll('.th-artist').forEach(el => el.textContent = T.artist);
  document.querySelectorAll('.th-album').forEach(el => el.textContent = T.album);
  // Views titles
  document.querySelector('#view-songs .view-title').textContent = T.songs;
  document.querySelector('#view-albums .view-title').textContent = T.albums;
  document.querySelector('#view-artists .view-title').textContent = T.artists;
  document.querySelector('#view-settings .view-title').textContent = T.settings;
  $('homeTitle').textContent = T.home;
  $('favTitle').textContent = T.favorites;
  $('favThTitle').textContent = T.title;
  $('favThArtist').textContent = T.artist;
  $('favThAlbum').textContent = T.album;
  $('favEmptyTitle').textContent = T.favEmptyTitle;
  $('favEmptySub').textContent = T.favEmptySub;
  $('resumeLabel').textContent = T.resumeLabel;
  $('historyTitle').textContent = T.historyTitle;
  $('historyEmptySub').textContent = T.historyEmptySub;
  $('homeShuffleLabel').textContent = T.shuffleAll;
  $('qpTitle').textContent = T.queueTitle;
  $('qpEmpty').textContent = T.queueEmpty;
  // Sidebar section title
  document.querySelector('.sb-section-title').firstChild.textContent = T.playlists + ' ';
  // New playlist btn
  $('newPlaylistBtn').title = T.newPlaylist;
  // ctx
  $('ctxPlay').textContent = T.ctxPlay;
  $('ctxPlayNext').textContent = T.ctxPlayNext;
  document.querySelector('.ctx-label').textContent = T.ctxAddTo;
  // modal
  $('modalTitle').textContent = T.modalNewPlaylist;
  $('modalInput').placeholder = T.modalPlaceholder;
  $('modalCancel').textContent = T.cancel;
  $('modalOk').textContent = T.create;
}

// Cabeceras ordenables de cada vista
wireSortHead('songsHead', 'songs', () => renderSongs());
wireSortHead('favHead', 'favorites', () => renderFavorites());
wireSortHead('plHead', 'playlist', () => { if (activePlaylistId) showPlaylistView(activePlaylistId); });
wireSortHead('adHead', 'album', () => { if (currentAlbum) showAlbumDetail(currentAlbum); });
wireSortHead('artHead', 'artist', () => { if (currentArtist) showArtistDetail(currentArtist); });

async function init() {
  await loadState();
  await applyTheme(state.theme);
  applyVisual(state.visual);
  setVolume(state.volume);
  applyTranslations();

  themePicker.set(state.theme);
  visualPicker.set(state.visual);
  $('crossfadeRange').value = state.crossfade || 0;
  paintCrossfade();
  syncShuffleRepeatUI();

  showView('songs');
  updatePlaylistNav();
  renderFolders();
  renderQueuePanel();

  // La ventana se muestra ANTES de escanear. Antes se hacía al revés y con una
  // biblioteca grande el reproductor no aparecía en pantalla durante minutos,
  // dando la sensación de que no había arrancado.
  await appWindow.show();

  if (state.music_folders.length || state.imported_tracks.length) {
    scanAll();
  } else {
    $('emptyState').classList.add('show');
    $('trackTable').style.display = 'none';
  }
}

init();
