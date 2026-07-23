'use strict';

// ── Tauri ─────────────────────────────────────────────────────────────────
const { invoke } = window.__TAURI__.core;
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
}, { passive:false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && ['+','-','=','0'].includes(e.key)) e.preventDefault();
}, { passive:false });

// ── i18n ───────────────────────────────────────────────────────────────────
const LANG = navigator.language.startsWith('es') ? 'es' : 'en';
const T = {
  es: {
    songs:'Canciones', albums:'Álbumes', artists:'Artistas',
    playlists:'Listas', settings:'Ajustes',
    addFolder:'Añadir carpeta', playAll:'Reproducir todo',
    newPlaylist:'Nueva lista', deletePlaylist:'Eliminar lista',
    emptyTitle:'Tu biblioteca está vacía',
    emptySub:'Añade una carpeta con música para comenzar',
    searchPlaceholder:'Buscar en biblioteca…',
    title:'Título', artist:'Artista', album:'Álbum',
    noPlayback:'Sin reproducción',
    theme:'Tema', themeSub:'Claro, oscuro o del sistema',
    visual:'Modo visual', visualSub:'OLED (negro puro) o Blur (color dinámico del álbum)',
    themeAuto:'Automático', themeDark:'Oscuro', themeLight:'Claro',
    visualOled:'OLED', visualBlur:'Blur',
    accent:'Color de acento', accentSub:'Color de la interfaz cuando no hay color dinámico',
    musicFolders:'Carpetas de música',
    queue:'Cola', songs_count: n => `${n} canción${n!==1?'es':''}`,
    albumType:'Álbum', artistType:'Artista',
    shuffleAll:'Reproducir todo',
    modalNewPlaylist:'Nueva lista', modalPlaceholder:'Nombre de la lista…',
    cancel:'Cancelar', create:'Crear',
    ctxPlay:'Reproducir', ctxPlayNext:'Reproducir a continuación',
    ctxAddTo:'Añadir a lista', noLists:'Sin listas',
  },
  en: {
    songs:'Songs', albums:'Albums', artists:'Artists',
    playlists:'Playlists', settings:'Settings',
    addFolder:'Add folder', playAll:'Play all',
    newPlaylist:'New playlist', deletePlaylist:'Delete playlist',
    emptyTitle:'Your library is empty',
    emptySub:'Add a folder with music to get started',
    searchPlaceholder:'Search library…',
    title:'Title', artist:'Artist', album:'Album',
    noPlayback:'Not playing',
    theme:'Theme', themeSub:'Light, dark or system',
    visual:'Visual mode', visualSub:'OLED (pure black) or Blur (dynamic album color)',
    themeAuto:'Automatic', themeDark:'Dark', themeLight:'Light',
    visualOled:'OLED', visualBlur:'Blur',
    accent:'Accent color', accentSub:'Interface color when there is no dynamic color',
    musicFolders:'Music folders',
    queue:'Queue', songs_count: n => `${n} song${n!==1?'s':''}`,
    albumType:'Album', artistType:'Artist',
    shuffleAll:'Shuffle all',
    modalNewPlaylist:'New playlist', modalPlaceholder:'Playlist name…',
    cancel:'Cancel', create:'Create',
    ctxPlay:'Play', ctxPlayNext:'Play next',
    ctxAddTo:'Add to playlist', noLists:'No playlists',
  }
}[LANG];

// ── State ──────────────────────────────────────────────────────────────────
let state = {
  theme: 'auto', visual: 'oled',
  accent: '#7c5cfc',
  playlists: [], music_folders: [],
  volume: 1.0, queue: [], current_index: -1,
  shuffle: false, repeat: 'none',
};

const ACCENT_PRESETS = ['#7c5cfc','#0a84ff','#34c759','#ff9f0a','#ff453a','#ff2d92','#5ac8fa'];

let library = [];
let currentView = 'songs';
let activePlaylistId = null;
let ctxTrack = null;
let modalCb = null;
let searchQuery = '';

// ── Audio ──────────────────────────────────────────────────────────────────
const audio = document.getElementById('audioEl');

// ── DOM shortcuts ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const app = $('app');

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = s => { if(!s||isNaN(s)) return '0:00'; s=Math.floor(s); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Color extraction ───────────────────────────────────────────────────────
function extractColor(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 24;
        const cx = c.getContext('2d'); cx.drawImage(img,0,0,24,24);
        const d = cx.getImageData(0,0,24,24).data;
        let r=0,g=0,b=0,n=0;
        for (let i=0;i<d.length;i+=8) {
          const lum=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
          if(lum<20||lum>235) continue;
          r+=d[i];g+=d[i+1];b+=d[i+2];n++;
        }
        if(!n){resolve(null);return;}
        r=Math.round(r/n);g=Math.round(g/n);b=Math.round(b/n);
        const mid=(r+g+b)/3,f=1.55;
        r=Math.min(255,Math.round(mid+(r-mid)*f));
        g=Math.min(255,Math.round(mid+(g-mid)*f));
        b=Math.min(255,Math.round(mid+(b-mid)*f));
        resolve({hex:`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`,rgb:`${r},${g},${b}`});
      } catch { resolve(null); }
    };
    img.onerror=()=>resolve(null);
    img.src=src;
  });
}

function hexToRgb(hex){
  const m = hex.replace('#','').match(/.{2}/g);
  if(!m) return '124,92,252';
  return m.map(h=>parseInt(h,16)).join(',');
}

function applyDyn(color) {
  // when no cover color, fall back to the user's accent
  const h = color?.hex || state.accent;
  const rgb = color?.rgb || hexToRgb(state.accent);
  app.style.setProperty('--dyn', h);
  app.style.setProperty('--dyn-rgb', rgb);
}

// Apply user accent as the base (used everywhere there's no dynamic cover color)
function applyAccent(hex) {
  state.accent = hex;
  applyDyn(null);
  renderAccentPicker();
}

function renderAccentPicker() {
  const wrap = $('accentSwatches');
  if(!wrap) return;
  wrap.innerHTML='';
  let matchedPreset=false;
  ACCENT_PRESETS.forEach(c=>{
    const sw=document.createElement('div');
    sw.className='accent-swatch'+(c.toLowerCase()===state.accent.toLowerCase()?' active':'');
    if(c.toLowerCase()===state.accent.toLowerCase()) matchedPreset=true;
    sw.style.background=c;
    sw.addEventListener('click',()=>{ applyAccent(c); saveState(); });
    wrap.appendChild(sw);
  });
  // custom swatch active state + value sync
  $('accentCustomRing').parentElement.classList.toggle('active', !matchedPreset);
  $('accentColorInput').value = state.accent;
}

// ── Theme / visual ─────────────────────────────────────────────────────────
async function applyTheme(t) {
  let r=t;
  if(t==='auto') r=await invoke('detect_system_theme').catch(()=>'dark');
  app.classList.toggle('light-mode', r==='light');
}
function applyVisual(v) {
  app.classList.toggle('oled-mode', v==='oled');
  app.classList.toggle('blur-mode', v==='blur');
}

// ── State ──────────────────────────────────────────────────────────────────
async function saveState() {
  await invoke('save_state',{state:{...state,queue:state.queue.map(t=>t.path)}}).catch(()=>{});
}
async function loadState() {
  const s = await invoke('load_state').catch(()=>({}));
  ['theme','visual','accent','playlists','music_folders','volume','shuffle','repeat'].forEach(k=>{
    if(s[k]!==undefined) state[k]=s[k];
  });
}

// ── Scanning ───────────────────────────────────────────────────────────────
async function scanAll() {
  library=[];
  for(const f of state.music_folders) {
    const tracks=await invoke('scan_folder',{folder:f}).catch(()=>[]);
    library.push(...tracks);
  }
  const seen=new Set();
  library=library.filter(t=>{if(seen.has(t.path))return false;seen.add(t.path);return true;});
  renderSongs();
  renderAlbums();
  renderArtists();
  updatePlaylistNav();
}

// ── View switching ─────────────────────────────────────────────────────────
function showView(name) {
  currentView=name;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
  document.querySelectorAll('.sb-pl-item').forEach(b=>b.classList.remove('active'));
  const v=$(`view-${name}`);
  if(v) v.classList.add('active');
}

function showDetailView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sb-pl-item').forEach(b=>b.classList.remove('active'));
  const v=$(`view-${name}`);
  if(v) v.classList.add('active');
}

// ── Track row builder ──────────────────────────────────────────────────────
function makeRow(track, index, tracks, cols='4col') {
  const div=document.createElement('div');
  div.className='tr'+(cols==='2col'?' tr-2col':cols==='3col'?' tr-3col':'');
  div.dataset.path=track.path;

  const title=esc(track.title||track.path.split('/').pop());
  const artist=esc(track.artist||'—');
  const album=esc(track.album||'—');
  const dur=fmt(track.duration);
  const coverHtml=track.cover
    ?`<img class="tr-cover" src="${esc(track.cover)}" loading="lazy" alt="">`
    :`<div class="tr-cover-ph"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 11V5l7-1.5v6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="2" cy="11" r="1.5" stroke="currentColor" stroke-width="1.2"/><circle cx="9.5" cy="9.5" r="1.5" stroke="currentColor" stroke-width="1.2"/></svg></div>`;

  let inner='';
  if(cols==='2col') {
    inner=`<div class="tr-num">${index+1}</div>
      <div class="tr-play-icon"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 1.5l10 5-10 5V1.5z" fill="currentColor"/></svg></div>
      <div class="tr-eq"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>
      <div class="tr-title-wrap">${coverHtml}<div class="tr-title">${title}</div></div>
      <div class="tr-dur">${dur}</div>`;
  } else if(cols==='3col') {
    inner=`<div class="tr-num">${index+1}</div>
      <div class="tr-play-icon"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 1.5l10 5-10 5V1.5z" fill="currentColor"/></svg></div>
      <div class="tr-eq"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>
      <div class="tr-title-wrap">${coverHtml}<div class="tr-title">${title}</div></div>
      <div class="tr-album">${album}</div>
      <div class="tr-dur">${dur}</div>`;
  } else {
    inner=`<div class="tr-num">${index+1}</div>
      <div class="tr-play-icon"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 1.5l10 5-10 5V1.5z" fill="currentColor"/></svg></div>
      <div class="tr-eq"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>
      <div class="tr-title-wrap">${coverHtml}<div class="tr-title">${title}</div></div>
      <div class="tr-artist">${artist}</div>
      <div class="tr-album">${album}</div>
      <div class="tr-dur">${dur}</div>`;
  }
  div.innerHTML=inner;

  div.addEventListener('click', ()=>playTracklist(tracks, index));
  div.addEventListener('contextmenu', e=>{e.preventDefault(); showCtx(e.clientX, e.clientY, track);});
  return div;
}

function highlightRows() {
  const cur=state.queue[state.current_index];
  document.querySelectorAll('.tr').forEach(r=>{
    const playing=!!(cur&&r.dataset.path===cur.path);
    r.classList.toggle('playing', playing);
  });
}

// ── Songs view ─────────────────────────────────────────────────────────────
// Render por lotes: con bibliotecas grandes construir miles de filas de golpe
// congela la UI. Pinta 250, cede el hilo y sigue; una búsqueda nueva cancela
// el lote pendiente (token de generación).
let _songsRenderGen = 0;
function renderSongs() {
  const tbl=$('trackTable');
  const empty=$('emptyState');
  tbl.innerHTML='';
  const gen=++_songsRenderGen;

  const filtered=searchQuery
    ? library.filter(t=>[t.title,t.artist,t.album].some(s=>(s||'').toLowerCase().includes(searchQuery)))
    : library;

  if(!filtered.length) { empty.classList.add('show'); tbl.style.display='none'; return; }
  empty.classList.remove('show'); tbl.style.display='';

  const CHUNK=250;
  let i=0;
  function renderChunk() {
    if(gen!==_songsRenderGen) return;            // llegó un render más nuevo
    const frag=document.createDocumentFragment();
    const end=Math.min(i+CHUNK, filtered.length);
    for(; i<end; i++) frag.appendChild(makeRow(filtered[i], i, filtered));
    tbl.appendChild(frag);
    if(i<filtered.length) requestAnimationFrame(renderChunk);
    else highlightRows();
  }
  renderChunk();
}

// ── Albums view ────────────────────────────────────────────────────────────
function renderAlbums() {
  const grid=$('albumGrid'); grid.innerHTML='';
  const albums={};
  library.forEach(t=>{
    const key=(t.album||'—')+'|||'+(t.album_artist||t.artist||'—');
    if(!albums[key]) albums[key]={name:t.album||'—',artist:t.album_artist||t.artist||'—',cover:t.cover,tracks:[]};
    albums[key].tracks.push(t);
  });
  Object.values(albums).sort((a,b)=>a.name.localeCompare(b.name)).forEach(alb=>{
    const card=document.createElement('div');
    card.className='album-card';
    card.innerHTML=(alb.cover?`<img src="${esc(alb.cover)}" loading="lazy" alt="">`:`<div class="album-card-ph"><svg width="44" height="44" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="18" stroke="currentColor" stroke-width="1.5" fill="none" opacity=".25"/><circle cx="22" cy="22" r="6" fill="currentColor" opacity=".25"/></svg></div>`)
      +`<div class="album-card-info"><div class="album-card-name">${esc(alb.name)}</div><div class="album-card-artist">${esc(alb.artist)}</div></div>`;
    card.addEventListener('click',()=>showAlbumDetail(alb));
    grid.appendChild(card);
  });
}

async function showAlbumDetail(alb) {
  $('adType').textContent=T.albumType;
  $('adTitle').textContent=alb.name;
  $('adMeta').textContent=`${alb.artist} · ${T.songs_count(alb.tracks.length)}`;
  if(alb.cover){
    $('adArt').src=alb.cover;$('adArt').style.display='block';$('adArtPh').style.display='none';
    const color=await extractColor(alb.cover);
    if(color) document.querySelector('.album-detail-header').style.background=`linear-gradient(to bottom,rgba(${color.rgb},.18),transparent)`;
  } else {
    $('adArt').style.display='none';$('adArtPh').style.display='flex';
    document.querySelector('.album-detail-header').style.background='';
  }
  const tbl=$('adTrackTable'); tbl.innerHTML='';
  const sorted=[...alb.tracks].sort((a,b)=>(a.track_number||999)-(b.track_number||999));
  sorted.forEach((t,i)=>tbl.appendChild(makeRow(t,i,sorted,'2col')));
  $('adPlayBtn').onclick=()=>playTracklist(sorted,0);
  $('adShuffleBtn').onclick=()=>{
    state.shuffle=true;$('shuffleBtn').classList.add('active');
    playTracklist(sorted,0);
  };
  showDetailView('album-detail');
  highlightRows();
}

// ── Artists view ───────────────────────────────────────────────────────────
function renderArtists() {
  const grid=$('artistGrid'); grid.innerHTML='';
  const artists={};
  library.forEach(t=>{
    const key=t.artist||'—';
    if(!artists[key]) artists[key]={name:key,count:0,tracks:[]};
    artists[key].count++;
    artists[key].tracks.push(t);
  });
  Object.values(artists).sort((a,b)=>a.name.localeCompare(b.name)).forEach(art=>{
    const card=document.createElement('div');
    card.className='artist-card';
    card.innerHTML=`<div class="artist-card-avatar">${esc((art.name[0]||'?').toUpperCase())}</div><div class="artist-card-name">${esc(art.name)}</div><div class="artist-card-count">${T.songs_count(art.count)}</div>`;
    card.addEventListener('click',()=>showArtistDetail(art));
    grid.appendChild(card);
  });
}

async function showArtistDetail(art) {
  $('artDetailName').textContent=art.name;
  $('artDetailMeta').textContent=T.songs_count(art.tracks.length);
  $('artAvatarLg').textContent=(art.name[0]||'?').toUpperCase();
  const tbl=$('artTrackTable'); tbl.innerHTML='';
  art.tracks.forEach((t,i)=>tbl.appendChild(makeRow(t,i,art.tracks,'3col')));
  $('artPlayBtn').onclick=()=>playTracklist(art.tracks,0);
  showDetailView('artist-detail');
  highlightRows();
}

// ── Playlists ──────────────────────────────────────────────────────────────
function updatePlaylistNav() {
  const nav=$('playlistNav'); nav.innerHTML='';
  state.playlists.forEach(pl=>{
    const btn=document.createElement('button');
    btn.className='sb-pl-item'+(activePlaylistId===pl.id?' active':'');
    btn.dataset.id=pl.id;
    btn.innerHTML=`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="8" height="1.5" rx=".75" fill="currentColor"/><rect x="1" y="5.5" width="8" height="1.5" rx=".75" fill="currentColor"/><rect x="1" y="9" width="5" height="1.5" rx=".75" fill="currentColor"/><circle cx="11" cy="10.5" r="2.5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>${esc(pl.name)}`;
    btn.addEventListener('click',()=>showPlaylistView(pl.id));
    nav.appendChild(btn);
  });
}

function showPlaylistView(id) {
  activePlaylistId=id;
  const pl=state.playlists.find(p=>p.id===id);
  if(!pl) return;
  $('plViewTitle').textContent=pl.name;
  const tracks=pl.tracks.map(p=>library.find(t=>t.path===p)).filter(Boolean);
  const tbl=$('plTrackTable'); tbl.innerHTML='';
  tracks.forEach((t,i)=>tbl.appendChild(makeRow(t,i,tracks)));
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.sb-pl-item').forEach(b=>b.classList.toggle('active',b.dataset.id===id));
  showDetailView('playlist');
  highlightRows();
}

$('newPlaylistBtn').addEventListener('click',()=>{
  openModal(T.modalNewPlaylist,'',name=>{
    if(!name.trim()) return;
    state.playlists.push({id:uid(),name:name.trim(),tracks:[]});
    updatePlaylistNav();saveState();
  });
});

$('deletePlBtn').addEventListener('click',()=>{
  if(!activePlaylistId) return;
  state.playlists=state.playlists.filter(p=>p.id!==activePlaylistId);
  activePlaylistId=null;
  updatePlaylistNav();
  showView('songs');saveState();
});

// ── Playback ───────────────────────────────────────────────────────────────
function playTracklist(tracks, idx) {
  state.queue=[...tracks];
  state.current_index=idx;
  if(state.shuffle) shuffleFrom(idx);
  loadAndPlay(state.current_index);
  saveState();
}

function playIndex(idx) {
  if(idx<0||idx>=state.queue.length) return;
  state.current_index=idx;
  loadAndPlay(idx);saveState();
}

async function loadAndPlay(idx) {
  let t=state.queue[idx];
  if(!t) return;
  if(!t.title&&!t.duration) {
    t=await invoke('read_track_meta',{path:t.path}).catch(()=>t);
    state.queue[idx]=t;
  }
  // Load bytes from Rust → Blob URL, wait until ready, then play (no clipped intros)
  try {
    if (audio._blobUrl) { URL.revokeObjectURL(audio._blobUrl); audio._blobUrl=null; }
    const buf = await invoke('read_audio_bytes',{path:t.path}); // ArrayBuffer
    const blob = new Blob([buf]);
    const url = URL.createObjectURL(blob);
    audio._blobUrl = url;
    audio.src = url;
    // wait for enough data so the start isn't dropped
    await new Promise((resolve)=>{
      const ok=()=>{audio.removeEventListener('canplay',ok);audio.removeEventListener('error',ok);resolve();};
      audio.addEventListener('canplay',ok,{once:true});
      audio.addEventListener('error',ok,{once:true});
      audio.load();
    });
    await audio.play();
  } catch(err){
    console.error('playback failed:', err);
  }
  updateNowPlaying(t);
  highlightRows();
  saveState();
  // Extract dominant color off the critical path (don't block playback start)
  extractColor(t.cover||null).then(applyDyn);
}

function updateNowPlaying(t) {
  const title=t.title||t.path.split('/').pop();
  const artist=t.artist||'—';
  // player bar
  $('pbTitle').textContent=title;
  $('pbArtist').textContent=artist;
  if(t.cover){
    $('pbArtImg').src=t.cover;$('pbArtImg').style.display='block';$('pbArtPh').style.display='none';
  } else {
    $('pbArtImg').style.display='none';$('pbArtPh').style.display='flex';
  }
  // immersive
  $('immTitle').textContent=title;
  $('immArtist').textContent=artist;
  $('immAlbum').textContent=t.album||'';
  if(t.cover){
    $('immArt').src=t.cover;$('immArt').style.display='block';$('immArtPh').style.display='none';
    $('immBg').style.backgroundImage=`url('${t.cover}')`;
  } else {
    $('immArt').style.display='none';$('immArtPh').style.display='flex';
    $('immBg').style.backgroundImage='';
  }
}

function setPlayIcon(playing) {
  [$('playBtn'),$('immPlay')].forEach(btn=>{
    btn.querySelector('.icon-play').style.display=playing?'none':'block';
    btn.querySelector('.icon-pause').style.display=playing?'block':'none';
  });
  document.querySelectorAll('.tr.playing').forEach(r=>r.classList.toggle('paused',!playing));
}

function shuffleFrom(idx) {
  const first=state.queue[idx];
  const rest=state.queue.filter((_,i)=>i!==idx);
  for(let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];}
  state.queue=[first,...rest];state.current_index=0;
}

function playNext() {
  if(!state.queue.length) return;
  if(state.repeat==='one'){audio.currentTime=0;audio.play();return;}
  let n=state.current_index+1;
  if(n>=state.queue.length){if(state.repeat==='all')n=0;else return;}
  playIndex(n);
}
function playPrev() {
  if(audio.currentTime>3){audio.currentTime=0;return;}
  let p=state.current_index-1;
  if(p<0) p=state.repeat==='all'?state.queue.length-1:0;
  playIndex(p);
}

// ── Audio events ───────────────────────────────────────────────────────────
audio.addEventListener('playing',()=>setPlayIcon(true));
audio.addEventListener('pause',()=>setPlayIcon(false));
audio.addEventListener('ended',playNext);
audio.addEventListener('timeupdate',updateProgress);
audio.addEventListener('durationchange',updateProgress);
audio.addEventListener('error',()=>{
  const e=audio.error;
  console.error('audio error code', e&&e.code, e&&e.message);
});

function updateProgress() {
  const {currentTime:ct,duration:dur}=audio;
  const pct=dur?(ct/dur)*100:0;
  const val=dur?Math.round((ct/dur)*1000):0;
  $('pbProgFill').style.width=pct+'%';
  $('immProgFill').style.width=pct+'%';
  $('pbProgRange').value=val;
  $('immProgRange').value=val;
  $('pbTimeCur').textContent=fmt(ct);
  $('pbTimeDur').textContent=fmt(dur);
  $('immTimeCur').textContent=fmt(ct);
  $('immTimeDur').textContent=fmt(dur);
}

function setVolume(v) {
  v=Math.max(0,Math.min(1,v));
  audio.volume=v;state.volume=v;
  $('pbVolFill').style.height=(v*100)+'%';
  // sync mute icon to actual volume
  const muted = v === 0;
  $('muteBtn').classList.toggle('muted', muted);
  $('muteBtn').querySelector('.icon-vol').style.display  = muted?'none':'block';
  $('muteBtn').querySelector('.icon-mute').style.display = muted?'block':'none';
}

// ── Seek inputs ────────────────────────────────────────────────────────────
$('pbProgRange').addEventListener('input',e=>{if(audio.duration)audio.currentTime=(e.target.value/1000)*audio.duration;});
$('immProgRange').addEventListener('input',e=>{if(audio.duration)audio.currentTime=(e.target.value/1000)*audio.duration;});

// ── Volume — vertical track via pointer drag ───────────────────────────────
const volTrack = $('pbVolTrack');
let prevVol = 1;

function volFromPointer(clientY){
  const rect = volTrack.getBoundingClientRect();
  // top = 1.0 (max), bottom = 0
  let v = 1 - (clientY - rect.top) / rect.height;
  setVolume(v);
  saveState();
}

volTrack.addEventListener('pointerdown', e=>{
  e.preventDefault();
  volTrack.classList.add('dragging');
  volTrack.setPointerCapture(e.pointerId);
  volFromPointer(e.clientY);
});
volTrack.addEventListener('pointermove', e=>{
  if(volTrack.classList.contains('dragging')) volFromPointer(e.clientY);
});
volTrack.addEventListener('pointerup', e=>{
  volTrack.classList.remove('dragging');
});
// scroll wheel over the volume = adjust
volTrack.addEventListener('wheel', e=>{
  e.preventDefault();
  setVolume(state.volume + (e.deltaY < 0 ? .05 : -.05));
  saveState();
}, {passive:false});

// ── Mute toggle ────────────────────────────────────────────────────────────
$('muteBtn').addEventListener('click',()=>{
  if(audio.volume > 0){
    prevVol = audio.volume;
    setVolume(0);
  } else {
    setVolume(prevVol||0.7);
  }
  saveState();
});

// ── Control buttons ────────────────────────────────────────────────────────
$('playBtn').addEventListener('click',()=>audio.paused?audio.play():audio.pause());
$('prevBtn').addEventListener('click',playPrev);
$('nextBtn').addEventListener('click',playNext);
$('immPlay').addEventListener('click',()=>audio.paused?audio.play():audio.pause());
$('immPrev').addEventListener('click',playPrev);
$('immNext').addEventListener('click',playNext);
$('immSkipBack').addEventListener('click',()=>{audio.currentTime=Math.max(0,audio.currentTime-10);});
$('immSkipFwd').addEventListener('click',()=>{audio.currentTime=Math.min(audio.duration||0,audio.currentTime+10);});

$('shuffleBtn').addEventListener('click',()=>{
  state.shuffle=!state.shuffle;
  $('shuffleBtn').classList.toggle('active',state.shuffle);
  if(state.shuffle&&state.queue.length) shuffleFrom(state.current_index);
  saveState();
});

$('repeatBtn').addEventListener('click',()=>{
  const m=['none','all','one'];
  state.repeat=m[(m.indexOf(state.repeat)+1)%3];
  $('repeatBtn').classList.toggle('active',state.repeat!=='none');
  $('repeatBtn').title=state.repeat==='one'?'Repetir una':state.repeat==='all'?'Repetir todo':'Sin repetir';
  saveState();
});

// ── Window ─────────────────────────────────────────────────────────────────
$('closeBtn').addEventListener('click',()=>appWindow.close());
$('minBtn').addEventListener('click',()=>appWindow.minimize());
$('maxBtn').addEventListener('click',()=>appWindow.toggleMaximize());
$('sidebarToggle').addEventListener('click',()=>$('sidebar').classList.toggle('collapsed'));

// ── Immersive ──────────────────────────────────────────────────────────────
$('pbArt').addEventListener('click',()=>{if(state.current_index>=0)$('immersive').classList.add('active');});
$('immClose').addEventListener('click',()=>$('immersive').classList.remove('active'));

// ── Search ─────────────────────────────────────────────────────────────────
let _searchDebounce=null;
$('searchInput').addEventListener('input',e=>{
  searchQuery=e.target.value.trim().toLowerCase();
  clearTimeout(_searchDebounce);
  _searchDebounce=setTimeout(()=>{
    renderSongs();
    if(currentView!=='songs') showView('songs');
  }, 120);
});

// ── Sidebar nav ────────────────────────────────────────────────────────────
document.querySelectorAll('.sb-item[data-view]').forEach(btn=>{
  btn.addEventListener('click',()=>showView(btn.dataset.view));
});

// ── Add folder ─────────────────────────────────────────────────────────────
async function addFolder() {
  const folder=await dialogOpen({directory:true,multiple:false}).catch(()=>null);
  if(!folder||state.music_folders.includes(folder)) return;
  state.music_folders.push(folder);
  renderFolders();await saveState();await scanAll();
}
$('addFolderBtn').addEventListener('click',addFolder);
$('emptyAddBtn').addEventListener('click',addFolder);
$('settingsAddFolderBtn').addEventListener('click',addFolder);

function renderFolders() {
  const list=$('foldersList'); list.innerHTML='';
  state.music_folders.forEach(f=>{
    const row=document.createElement('div');
    row.className='folder-row';
    row.innerHTML=`<span class="folder-path" title="${esc(f)}">${esc(f)}</span><button class="folder-rm" title="Quitar"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>`;
    row.querySelector('.folder-rm').addEventListener('click',async()=>{
      state.music_folders=state.music_folders.filter(x=>x!==f);
      renderFolders();await saveState();await scanAll();
    });
    list.appendChild(row);
  });
}

// ── Shuffle all ────────────────────────────────────────────────────────────
$('shuffleAllBtn').addEventListener('click',()=>{
  if(!library.length) return;
  state.shuffle=true;$('shuffleBtn').classList.add('active');
  playTracklist(library, Math.floor(Math.random()*library.length));
});

// ── Settings ───────────────────────────────────────────────────────────────
$('themeSelect').addEventListener('change',async e=>{state.theme=e.target.value;await applyTheme(state.theme);saveState();});
$('visualSelect').addEventListener('change',e=>{state.visual=e.target.value;applyVisual(state.visual);saveState();});
$('accentColorInput').addEventListener('input',e=>{ applyAccent(e.target.value); });
$('accentColorInput').addEventListener('change',e=>{ applyAccent(e.target.value); saveState(); });

// ── Context menu ───────────────────────────────────────────────────────────
const ctx=$('ctx');
function showCtx(x,y,track) {
  ctxTrack=track;
  ctx.style.left=x+'px';ctx.style.top=y+'px';
  ctx.classList.add('active');
  const pls=$('ctxPls'); pls.innerHTML='';
  if(!state.playlists.length) {
    pls.innerHTML=`<div style="padding:5px 12px;font-size:12px;color:var(--tx3)">${T.noLists}</div>`;
  } else {
    state.playlists.forEach(pl=>{
      const item=document.createElement('div');
      item.className='ctx-item';item.textContent=pl.name;
      item.addEventListener('click',()=>{
        if(!pl.tracks.includes(ctxTrack.path)) pl.tracks.push(ctxTrack.path);
        saveState();hideCtx();
      });
      pls.appendChild(item);
    });
  }
}
function hideCtx(){ctx.classList.remove('active');ctxTrack=null;}
document.addEventListener('click',e=>{if(!ctx.contains(e.target))hideCtx();});

$('ctxPlay').addEventListener('click',()=>{
  if(!ctxTrack) return;
  const idx=library.findIndex(t=>t.path===ctxTrack.path);
  if(idx>=0) playTracklist(library,idx);
  hideCtx();
});
$('ctxPlayNext').addEventListener('click',()=>{
  if(!ctxTrack) return;
  state.queue.splice(state.current_index+1,0,ctxTrack);
  hideCtx();saveState();
});

// ── Modal ──────────────────────────────────────────────────────────────────
function openModal(title,val,cb) {
  $('modalTitle').textContent=title;$('modalInput').value=val;
  modalCb=cb;$('modalBack').classList.add('active');$('modalInput').focus();
}
function closeModal(){$('modalBack').classList.remove('active');modalCb=null;}
$('modalCancel').addEventListener('click',closeModal);
$('modalOk').addEventListener('click',()=>{if(modalCb)modalCb($('modalInput').value);closeModal();});
$('modalInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'){if(modalCb)modalCb($('modalInput').value);closeModal();}
  if(e.key==='Escape')closeModal();
});
$('modalBack').addEventListener('click',e=>{if(e.target===$('modalBack'))closeModal();});

// ── Keyboard ───────────────────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT') return;
  if(e.code==='Space'){e.preventDefault();audio.paused?audio.play():audio.pause();}
  if(e.code==='ArrowRight'&&e.shiftKey) audio.currentTime=Math.min(audio.duration||0,audio.currentTime+10);
  else if(e.code==='ArrowRight') playNext();
  if(e.code==='ArrowLeft'&&e.shiftKey) audio.currentTime=Math.max(0,audio.currentTime-10);
  else if(e.code==='ArrowLeft') playPrev();
  if(e.code==='ArrowUp') setVolume(state.volume+.05);
  if(e.code==='ArrowDown') setVolume(state.volume-.05);
  if(e.code==='KeyF') $('immersive').classList.toggle('active');
  if(e.code==='Escape'){$('immersive').classList.remove('active');closeModal();}
});

// ── Init ───────────────────────────────────────────────────────────────────
function applyTranslations() {
  // Sidebar nav labels — find last text node to avoid clobbering SVG
  const setSbLabel = (sel, text) => {
    const btn = document.querySelector(sel);
    // last child is the text node after the SVG
    const nodes = [...btn.childNodes].filter(n => n.nodeType === 3);
    if (nodes.length) nodes[nodes.length-1].textContent = ' '+text;
  };
  setSbLabel('[data-view="songs"]', T.songs);
  setSbLabel('[data-view="albums"]', T.albums);
  setSbLabel('[data-view="artists"]', T.artists);
  setSbLabel('[data-view="settings"]', T.settings);
  $('searchInput').placeholder = T.searchPlaceholder;
  const setLastText = (id, text) => {
    const el = $(id);
    const nodes = [...el.childNodes].filter(n => n.nodeType === 3);
    if (nodes.length) nodes[nodes.length-1].textContent = ' '+text;
    else el.appendChild(document.createTextNode(' '+text));
  };
  setLastText('addFolderBtn', T.addFolder);
  setLastText('shuffleAllBtn', T.shuffleAll);
  $('emptyAddBtn').textContent = T.addFolder;
  $('emptyState').querySelector('.empty-title').textContent = T.emptyTitle;
  $('emptyState').querySelector('.empty-sub').textContent = T.emptySub;
  $('pbTitle').textContent = T.noPlayback;
  $('immTitle').textContent = T.noPlayback;
  $('deletePlBtn').textContent = T.deletePlaylist;
  $('settingsAddFolderBtn').textContent = '+ '+T.addFolder;
  // Settings labels
  const srows = document.querySelectorAll('.settings-row');
  srows[0].querySelector('.sr-title').textContent = T.theme;
  srows[0].querySelector('.sr-sub').textContent = T.themeSub;
  srows[1].querySelector('.sr-title').textContent = T.visual;
  srows[1].querySelector('.sr-sub').textContent = T.visualSub;
  if(srows[2]){ srows[2].querySelector('.sr-title').textContent = T.accent; srows[2].querySelector('.sr-sub').textContent = T.accentSub; }
  document.querySelector('.sc-title').textContent = T.musicFolders;
  // Select options
  const th=$('themeSelect'); th.options[0].text=T.themeAuto; th.options[1].text=T.themeDark; th.options[2].text=T.themeLight;
  const vs=$('visualSelect'); vs.options[0].text=T.visualOled; vs.options[1].text=T.visualBlur;
  // Track table heads
  document.querySelectorAll('.th-title').forEach(el=>el.textContent=T.title);
  document.querySelectorAll('.th-artist').forEach(el=>el.textContent=T.artist);
  document.querySelectorAll('.th-album').forEach(el=>el.textContent=T.album);
  // Views titles
  document.querySelector('#view-songs .view-title').textContent=T.songs;
  document.querySelector('#view-albums .view-title').textContent=T.albums;
  document.querySelector('#view-artists .view-title').textContent=T.artists;
  document.querySelector('#view-settings .view-title').textContent=T.settings;
  // Sidebar section title
  document.querySelector('.sb-section-title').firstChild.textContent=T.playlists+' ';
  // New playlist btn
  $('newPlaylistBtn').title=T.newPlaylist;
  // ctx
  $('ctxPlay').textContent=T.ctxPlay;
  $('ctxPlayNext').textContent=T.ctxPlayNext;
  document.querySelector('.ctx-label').textContent=T.ctxAddTo;
  // modal
  $('modalTitle').textContent=T.modalNewPlaylist;
  $('modalInput').placeholder=T.modalPlaceholder;
  $('modalCancel').textContent=T.cancel;
  $('modalOk').textContent=T.create;
}

async function init() {
  await loadState();
  await applyTheme(state.theme);
  applyVisual(state.visual);
  applyAccent(state.accent);
  setVolume(state.volume);
  applyTranslations();

  $('themeSelect').value=state.theme;
  $('visualSelect').value=state.visual;
  $('shuffleBtn').classList.toggle('active',state.shuffle);
  $('repeatBtn').classList.toggle('active',state.repeat!=='none');

  showView('songs');
  updatePlaylistNav();
  renderFolders();

  if(state.music_folders.length) {
    await scanAll();
  } else {
    $('emptyState').classList.add('show');
    $('trackTable').style.display='none';
  }

  await appWindow.show();
}

init();
