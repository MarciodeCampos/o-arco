/**
 * app.js — HARMONIA Player
 * Vanilla JS, sem framework
 * Carrega catalog/index.json → arc_N.json sob demanda
 */

const BASE = './catalog';
let index = null;
let currentArcData = null;
let currentArcNum  = null;
let currentVolume  = 1;
let playlist       = [];
let currentIdx     = -1;
let isPlaying      = false;
let isShuffle      = false;

const audio    = document.getElementById('audio');
const coverImg = document.getElementById('cover-img');
const coverBg  = document.getElementById('cover-bg');
const playPulse= document.getElementById('play-pulse');

// ── Format helpers ──────────────────────────────────────────────
const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

// ── Load catalog index ──────────────────────────────────────────
async function loadIndex() {
  const res = await fetch(`${BASE}/index.json`);
  index = await res.json();

  document.getElementById('header-meta').textContent =
    `${index.meta.total_songs.toLocaleString()} tracks · ${index.meta.total_arcs} arcos · ${index.meta.total_volumes} volumes`;

  renderArcNav();
}

// ── Render arc navigation ───────────────────────────────────────
function renderArcNav() {
  const nav = document.getElementById('arc-nav');
  nav.innerHTML = '';
  index.arcs.forEach(arc => {
    const btn = document.createElement('button');
    btn.className = 'arc-btn';
    btn.dataset.arcNum = arc.num;
    btn.innerHTML = `<span>${arc.emoji}</span> ${arc.name} <span class="arc-count">${arc.count}</span>`;
    btn.addEventListener('click', () => selectArc(arc.num));
    nav.appendChild(btn);
  });
}

// ── Select arc ─────────────────────────────────────────────────
async function selectArc(arcNum) {
  if (arcNum === currentArcNum) return;
  currentArcNum = arcNum;
  currentVolume = 1;

  // Update nav active state
  document.querySelectorAll('.arc-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.arcNum) === arcNum);
  });

  // Load arc data
  const res = await fetch(`${BASE}/arc_${arcNum}.json`);
  currentArcData = await res.json();

  const arcMeta = index.arcs.find(a => a.num === arcNum);
  document.getElementById('panel-arc-name').textContent =
    `${arcMeta.emoji} ${arcMeta.name}`;
  document.getElementById('panel-count').textContent =
    `${arcMeta.count} tracks · ${arcMeta.volumes} volumes`;

  renderVolumeNav();
  selectVolume(1);
}

// ── Volume navigation ───────────────────────────────────────────
function renderVolumeNav() {
  const arcMeta = index.arcs.find(a => a.num === currentArcNum);
  const volNav  = document.getElementById('volume-nav');
  volNav.innerHTML = '';

  for (let v = 1; v <= arcMeta.volumes; v++) {
    const btn = document.createElement('button');
    btn.className = 'vol-btn';
    btn.dataset.vol = v;
    btn.textContent = `Vol.${v}`;
    btn.addEventListener('click', () => selectVolume(v));
    volNav.appendChild(btn);
  }
}

function selectVolume(vol) {
  currentVolume = vol;
  document.querySelectorAll('.vol-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.vol) === vol);
  });

  // Filter songs for this volume
  playlist = currentArcData.songs.filter(s => s.volume === vol);
  renderTrackList();

  // Pre-select first track (show info + cover) but don't autoplay
  // Mobile browsers block autoplay — user must tap Play
  if (playlist.length > 0) loadTrack(0, false);
}

// ── Render track list ───────────────────────────────────────────
function renderTrackList() {
  const list = document.getElementById('track-list');
  list.innerHTML = '';

  if (!playlist.length) {
    list.innerHTML = '<div class="empty-state">Sem tracks neste volume</div>';
    return;
  }

  playlist.forEach((track, i) => {
    const item = document.createElement('div');
    item.className = 'track-item';
    item.dataset.idx = i;

    const dur = track.duration_s ? fmt(track.duration_s) : '—';
    const trackUrl = `./track.html?arc=${currentArcNum}&id=${track.id}`;
    item.innerHTML = `
      <span class="ti-num">${track.num}</span>
      <img class="ti-thumb" src="${track.image_url || ''}" alt="" loading="lazy"
           onerror="this.style.background='rgba(255,255,255,0.05)'"/>
      <div class="ti-info">
        <div class="ti-title">${escHtml(track.title)}</div>
        <div class="ti-dur">${dur}</div>
      </div>
      <a class="ti-link" href="${trackUrl}" target="_blank"
         title="Página da música" onclick="event.stopPropagation()">↗</a>
    `;
    item.addEventListener('click', () => loadTrack(i));
    list.appendChild(item);
  });
}

// ── Load + play track ───────────────────────────────────────────
function loadTrack(idx, autoplay = true) {
  currentIdx = idx;
  const track = playlist[idx];
  if (!track) return;

  // Update active state in list
  document.querySelectorAll('.track-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });

  // Scroll into view
  const activeEl = document.querySelector('.track-item.active');
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  // Cover
  coverImg.src = track.image_url || '';
  coverBg.style.background = currentArcData.arc.color || '#7700ff';

  // Now playing info
  document.getElementById('np-arc').textContent =
    `${currentArcData.arc.emoji} ${currentArcData.arc.label || currentArcData.arc.name} — Vol.${track.volume}`;
  document.getElementById('np-title').textContent = track.title;
  document.getElementById('np-caption').textContent = track.caption || '';
  document.getElementById('np-meta').innerHTML = [
    track.model   ? `<span>${track.model}</span>`   : '',
    track.duration_s ? `<span>${fmt(track.duration_s)}</span>` : '',
    track.play_count > 0 ? `<span>▶ ${track.play_count}</span>` : '',
    track.score ? `<span>★ ${track.score}</span>` : '',
  ].join('');

  // Audio — sempre carrega, só toca se autoplay=true
  audio.src = track.audio_url;
  audio.load();

  if (autoplay) {
    audio.play().then(() => {
      setPlaying(true);
    }).catch(e => {
      // Mobile bloqueou autoplay — usuário precisa tocar em Play
      console.warn('Autoplay bloqueado (mobile):', e);
      setPlaying(false);
    });
  } else {
    setPlaying(false);
  }
}

// ── Playback state ──────────────────────────────────────────────
function setPlaying(state) {
  isPlaying = state;
  document.getElementById('btn-play').textContent = state ? '⏸' : '▶';
  playPulse.classList.toggle('active', state);
}

// ── Controls ────────────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click', () => {
  if (!audio.src) return;
  if (isPlaying) { audio.pause(); setPlaying(false); }
  else { audio.play(); setPlaying(true); }
});

document.getElementById('btn-next').addEventListener('click', () => {
  if (isShuffle) loadTrack(Math.floor(Math.random() * playlist.length));
  else if (currentIdx < playlist.length - 1) loadTrack(currentIdx + 1);
});

document.getElementById('btn-prev').addEventListener('click', () => {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (currentIdx > 0) loadTrack(currentIdx - 1);
});

document.getElementById('btn-shuffle').addEventListener('click', function() {
  isShuffle = !isShuffle;
  this.classList.toggle('active', isShuffle);
});

// ── Progress bar ────────────────────────────────────────────────
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('time-cur').textContent = fmt(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
  document.getElementById('time-dur').textContent = fmt(audio.duration);
});

audio.addEventListener('ended', () => {
  if (isShuffle) loadTrack(Math.floor(Math.random() * playlist.length));
  else if (currentIdx < playlist.length - 1) loadTrack(currentIdx + 1);
  else setPlaying(false);
});

// Click on progress bar
document.getElementById('progress-bar').addEventListener('click', (e) => {
  if (!audio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct  = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pct * audio.duration;
});

// ── Volume ──────────────────────────────────────────────────────
const volSlider = document.getElementById('volume');
audio.volume = volSlider.value;
volSlider.addEventListener('input', () => { audio.volume = volSlider.value; });

// ── Keyboard shortcuts ──────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space')       { e.preventDefault(); document.getElementById('btn-play').click(); }
  if (e.code === 'ArrowRight')  document.getElementById('btn-next').click();
  if (e.code === 'ArrowLeft')   document.getElementById('btn-prev').click();
});

// ── HTML escape helper ──────────────────────────────────────────
function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ────────────────────────────────────────────────────────
loadIndex().then(() => {
  // Auto-select first arc
  if (index.arcs.length) selectArc(index.arcs[0].num);
});
