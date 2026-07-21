// overlay.js — renders the transparent OBS overlay from live Firebase data.

let track = null;
let lastLapNumber = null;
let lastDeltaSign = null;
let mapCtx = null;

function $(id) { return document.getElementById(id); }

function pointAtDist(trk, dist) {
  const pts = trk.points;
  if (dist <= pts[0].dist) return pts[0];
  if (dist >= pts[pts.length - 1].dist) return pts[pts.length - 1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (dist >= pts[i].dist && dist <= pts[i + 1].dist) {
      const t = (dist - pts[i].dist) / (pts[i + 1].dist - pts[i].dist || 1);
      return { x: pts[i].x + t * (pts[i + 1].x - pts[i].x), y: pts[i].y + t * (pts[i + 1].y - pts[i].y) };
    }
  }
  return pts[pts.length - 1];
}

function trackBounds(trk) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  trk.points.forEach((p) => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  return { minX, maxX, minY, maxY };
}

function toCanvasXY(trk, bounds, canvas, p) {
  const pad = 16;
  const w = canvas.width - pad * 2, h = canvas.height - pad * 2;
  const scale = Math.min(w / (bounds.maxX - bounds.minX || 1), h / (bounds.maxY - bounds.minY || 1));
  return {
    x: pad + (p.x - bounds.minX) * scale,
    y: canvas.height - pad - (p.y - bounds.minY) * scale,
  };
}

function drawMap(liveDist) {
  if (!track || !mapCtx) return;
  const canvas = mapCtx.canvas;
  const bounds = trackBounds(track);
  mapCtx.clearRect(0, 0, canvas.width, canvas.height);

  mapCtx.strokeStyle = '#8a919c';
  mapCtx.lineWidth = 3;
  mapCtx.beginPath();
  track.points.forEach((p, i) => {
    const c = toCanvasXY(track, bounds, canvas, p);
    if (i === 0) mapCtx.moveTo(c.x, c.y); else mapCtx.lineTo(c.x, c.y);
  });
  mapCtx.stroke();

  track.sectors.forEach((s) => {
    const c = toCanvasXY(track, bounds, canvas, pointAtDist(track, s.dist));
    mapCtx.fillStyle = '#f5c518';
    mapCtx.beginPath(); mapCtx.arc(c.x, c.y, 3, 0, Math.PI * 2); mapCtx.fill();
  });

  if (liveDist != null) {
    const c = toCanvasXY(track, bounds, canvas, pointAtDist(track, liveDist));
    mapCtx.fillStyle = '#f5c518';
    mapCtx.beginPath(); mapCtx.arc(c.x, c.y, 7, 0, Math.PI * 2); mapCtx.fill();
    mapCtx.strokeStyle = '#0b0d10';
    mapCtx.lineWidth = 2;
    mapCtx.stroke();
  }
}

function buildLights(count) {
  const wrap = $('ovLights');
  wrap.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    d.className = 'ov-light';
    wrap.appendChild(d);
  }
}

function setLight(index, delta) {
  const wrap = $('ovLights');
  const el = wrap.children[index];
  if (!el) return;
  el.classList.remove('hit-ahead', 'hit-behind');
  el.classList.add(delta <= 0 ? 'hit-ahead' : 'hit-behind');
}

function resetLights() {
  const wrap = $('ovLights');
  Array.from(wrap.children).forEach((el) => el.classList.remove('hit-ahead', 'hit-behind'));
}

function renderLive(data) {
  if (!data) return;

  if (data.lapNumber !== lastLapNumber) {
    resetLights();
    lastLapNumber = data.lapNumber;
  }

  $('ovSpeed').textContent = Math.round(data.speed || 0);
  $('ovLap').textContent = data.lapNumber || 0;
  $('ovLapTime').textContent = fmtTime(data.lapTime);
  $('ovTrackName').textContent = data.trackName || '--';

  const deltaEl = $('ovDelta');
  const sign = data.delta == null ? null : data.delta <= 0 ? 'ahead' : 'behind';
  deltaEl.textContent = data.delta == null ? '--.--' : fmtDelta(data.delta);
  deltaEl.classList.remove('ahead', 'behind');
  if (sign) deltaEl.classList.add(sign);
  if (sign !== lastDeltaSign) {
    deltaEl.classList.add('flash');
    setTimeout(() => deltaEl.classList.remove('flash'), 400);
    lastDeltaSign = sign;
  }

  if (track && data.sectorSplits) {
    track.sectors.forEach((s, i) => {
      const split = data.sectorSplits[s.name];
      if (split) setLight(i, split.delta ?? 0);
    });
  }

  drawMap(data.dist);
}

function connect() {
  const code = $('roomInput').value.trim();
  if (!code) { alert('Enter the same room code used on the phone.'); return; }
  Room.set(code);
  Live.setRoom(code);

  $('setupPanel').style.display = 'none';
  $('overlayRoot').style.display = 'flex';

  Live.onTrack((t) => {
    track = t;
    if (!track) return;
    buildLights(track.sectors.length);
    $('mapWrap').style.display = 'block';
    mapCtx = $('mapCanvas').getContext('2d');
    drawMap(null);
  });

  Live.onLive(renderLive);
}

window.addEventListener('DOMContentLoaded', () => {
  $('roomInput').value = Room.get();
  $('connectBtn').onclick = connect;
});
