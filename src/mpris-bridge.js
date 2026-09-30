// BookOS Player — puente MPRIS.
//
// El reproductor de verdad es el <audio> de main.js, así que el servidor D-Bus
// (src-tauri/src/mpris.rs) no reproduce nada: es un espejo. Aquí se le empuja
// el estado en cada cambio y se traducen sus órdenes a las funciones que ya
// existen en main.js.
//
// Va en un fichero aparte y no dentro de main.js para que el reproductor siga
// arrancando igual si esto falla: un error aquí no se lleva por delante la UI.
(() => {
  // En Tauri 2 `invoke` cuelga de `core`, no de la raíz como en Tauri 1:
  // leído de la raíz salía undefined y el puente se apagaba entero en
  // silencio, sin MPRIS propio ni isla en el escritorio.
  const invoke = window.__TAURI__?.core?.invoke;
  const event = window.__TAURI__?.event;
  if (!invoke || !event) return;

  const REPEAT_TO_LOOP = { none: 'None', all: 'Playlist', one: 'Track' };
  const LOOP_TO_REPEAT = { None: 'none', Playlist: 'all', Track: 'one' };

  // La carátula viaja como data: URL y pesa; mandar la de una cola de 300
  // canciones en cada latido satura el bus. Solo se manda la de la pista actual
  // y la de sus vecinas, que son las que se ven en la isla.
  const ART_WINDOW = 10;

  function snapshot() {
    const idx = state.current_index;
    const queue = (state.queue || []).map((t, i) => ({
      path: t.path || '',
      title: t.title || (t.path || '').split('/').pop(),
      artist: t.artist || '',
      album: t.album || '',
      art_url: (t.cover && Math.abs(i - idx) <= ART_WINDOW) ? t.cover : '',
      length: Math.round((t.duration || 0) * 1e6),
      favorite: isFavorite(t.path),
    }));

    let status = 'Stopped';
    if (idx >= 0 && queue.length) status = audio.paused ? 'Paused' : 'Playing';

    return {
      status,
      position: Math.round((audio.currentTime || 0) * 1e6),
      // state.volume, no audio.volume: con el grafo de Web Audio montado el nivel
      // vive en un GainNode y el elemento se queda fijo en 1.
      volume: typeof state.volume === 'number' ? state.volume : 1,
      shuffle: !!state.shuffle,
      loop_status: REPEAT_TO_LOOP[state.repeat] || 'None',
      queue,
      index: idx,
    };
  }

  let pending = null;
  let activityCover = '';
  let activityCoverAt = 0;
  let activityQueueKey = '';
  let activityQueueAt = 0;
  function publish() {
    // Se agrupan las ráfagas: al cargar una pista saltan playing/durationchange/
    // timeupdate casi a la vez y no hace falta mandar tres veces lo mismo.
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      const mpris = snapshot();
      invoke('mpris_publish', { state: mpris }).catch(() => { });
      const current = mpris.queue[mpris.index];
      if (!current) {
        invoke('bookos_activity_close', { appId: 'com.bookos.player' }).catch(() => { });
        return;
      }
      const now = Date.now();
      const coverChanged = current.art_url !== activityCover;
      const sendCover = coverChanged || now - activityCoverAt > 30000;
      if (sendCover) { activityCover = current.art_url || ''; activityCoverAt = now; }
      const queueStart = Math.max(0, mpris.index - 2);
      const activityQueue = mpris.queue.slice(queueStart, queueStart + 20);
      // Las carátulas de la cola, igual que la principal: solo cuando cambian
      // las pistas visibles (o cada 30 s por si el escritorio se reinició).
      // Mandarlas en cada latido de 1 s serían varios MB por segundo por D-Bus.
      const queueKey = activityQueue.map(t => t.path + (t.art_url ? '*' : '')).join('\n');
      const sendQueueCovers = queueKey !== activityQueueKey || now - activityQueueAt > 30000;
      if (sendQueueCovers) { activityQueueKey = queueKey; activityQueueAt = now; }
      invoke('bookos_activity_publish', {
        appId: 'com.bookos.player', kind: 'player', state: {
          activo: mpris.status === 'Playing',
          pausado: mpris.status !== 'Playing',
          titulo: current.title || '', subtitulo: current.artist || '',
          posicion_ms: Math.round(mpris.position / 1000),
          duracion_ms: Math.round((current.length || 0) / 1000),
          volumen: Math.round(mpris.volume * 100),
          nivel: mpris.status === 'Playing' ? 0.75 : 0,
          portada: sendCover ? (current.art_url || '') : '',
          cola: activityQueue.map((t, i) => ({
            id: t.path, titulo: t.title, artista: t.artist,
            favorita: !!t.favorite, actual: queueStart + i === mpris.index,
            // La isla solo pinta cuatro filas.
            portada: sendQueueCovers && i < 4 ? (t.art_url || '') : '',
          })),
        }
      }).catch(() => { });
    }, 40);
  }

  ['playing', 'pause', 'ended', 'volumechange', 'seeked', 'durationchange', 'loadedmetadata']
    // A los DOS elementos: main.js los alterna para el crossfade, así que atarse
    // solo al que esté activo al cargar dejaría la isla muda media reproducción.
    .forEach(e => document.querySelectorAll('audio').forEach(el => el.addEventListener(e, publish)));
  // La posición se refresca aparte y despacio: nadie necesita precisión de
  // milisegundo, y Position no emite PropertiesChanged por spec.
  setInterval(() => { if (!audio.paused) publish(); }, 1000);

  // Red de seguridad para los cambios que no pasan por el <audio>: reordenar la
  // cola, marcar un favorito desde la lista, cambiar shuffle o repeat.
  setInterval(publish, 5000);
  window.bookosMprisPublish = publish;

  // Lo llama toggleFavorite() en main.js. Primero se empuja el estado (para que
  // el servidor conozca la pista) y luego se emite FavoriteChanged.
  window.bookosMprisFavorite = (path, value) => {
    invoke('mpris_publish', { state: snapshot() })
      .then(() => invoke('mpris_favorite', { path, value }))
      .catch(() => { });
  };

  function findIndex(path) {
    return (state.queue || []).findIndex(t => t.path === path);
  }

  event.listen('mpris://command', ({ payload }) => {
    const { action, arg } = payload || {};
    switch (action) {
      case 'play': if (audio.paused) audio.play(); break;
      case 'pause': if (!audio.paused) audio.pause(); break;
      case 'playpause': audio.paused ? audio.play() : audio.pause(); break;
      case 'stop': audio.pause(); audio.currentTime = 0; break;
      case 'next': playNext(); break;
      case 'previous': playPrev(); break;
      case 'seek': audio.currentTime = Number(arg || 0) / 1e6; break;
      case 'volume': setVolume(Number(arg || 0)); break;

      case 'shuffle': {
        const on = arg === 'true';
        if (on !== state.shuffle) $('shuffleBtn')?.click();
        break;
      }
      case 'loop': {
        state.repeat = LOOP_TO_REPEAT[arg] || 'none';
        syncShuffleRepeatUI();
        saveState();
        break;
      }

      case 'queue-goto': {
        const i = findIndex(arg);
        if (i >= 0) playIndex(i);
        break;
      }
      case 'queue-remove': {
        const i = findIndex(arg);
        if (i < 0) break;
        state.queue.splice(i, 1);
        // Quitar una pista anterior a la actual desplaza el índice; sin esto
        // la canción que suena pasaría a ser otra.
        if (i < state.current_index) state.current_index--;
        else if (i === state.current_index) state.current_index = Math.min(i, state.queue.length - 1);
        renderQueuePanel();
        saveState();
        break;
      }
      case 'queue-add': {
        let req;
        try { req = JSON.parse(arg); } catch { break; }
        const path = decodeURIComponent(String(req.uri || '').replace(/^file:\/\//, ''));
        const track = library.find(t => t.path === path);
        if (!track) break;
        const at = req.after ? findIndex(req.after) + 1 : 0;
        state.queue.splice(at, 0, track);
        if (at <= state.current_index) state.current_index++;
        if (req.play) playIndex(at);
        renderQueuePanel();
        saveState();
        break;
      }

      case 'favorite': {
        let req;
        try { req = JSON.parse(arg); } catch { break; }
        if (isFavorite(req.path) !== !!req.value) toggleFavorite(req.path, null);
        break;
      }

      case 'raise': window.__TAURI__.window?.getCurrentWindow?.().setFocus?.(); break;
      case 'quit': window.__TAURI__.window?.getCurrentWindow?.().close?.(); break;
    }
    publish();
  });

  // Los mismos controles, pero originados en la isla del compositor.
  event.listen('bookos://activity-action', ({ payload }) => {
    const action = payload?.action;
    const value = payload?.value || '';
    if (action === 'play-pause') audio.paused ? audio.play() : audio.pause();
    else if (action === 'previous') playPrev();
    else if (action === 'next') playNext();
    else if (action === 'seek') audio.currentTime = Number(value) * (audio.duration || 0);
    else if (action === 'volume') setVolume(Number(value) / 100);
    else if (action === 'queue-goto') { const i = findIndex(value); if (i >= 0) playIndex(i); }
    else if (action === 'queue-remove') {
      const i = findIndex(value);
      if (i >= 0) {
        state.queue.splice(i, 1);
        if (i < state.current_index) state.current_index--;
        renderQueuePanel(); saveState();
      }
    } else if (action === 'queue-move-up' || action === 'queue-move-down') {
      const i = findIndex(value);
      const target = i + (action === 'queue-move-up' ? -1 : 1);
      if (i >= 0 && target >= 0 && target < state.queue.length) {
        const currentPath = state.queue[state.current_index]?.path;
        const [track] = state.queue.splice(i, 1);
        state.queue.splice(target, 0, track);
        state.current_index = findIndex(currentPath);
        renderQueuePanel(); saveState();
      }
    } else if (action === 'favorite') {
      const i = findIndex(value); if (i >= 0) toggleFavorite(value, null);
    }
    publish();
  });

  publish();
})();
