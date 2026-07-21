// editor.js — record a lap, auto-build the track line, then place sectors.

let watchId = null;
let rawPoints = [];
let currentTrack = null; // the track being edited/previewed
let canvas, ctx;
let hoverMarker = null;

const els = {};

function $(id) { return document.getElementById(id); }

async function refreshTrackList() {
  const tracks = await DB.getAllTracks();
  const list = $('trackList');
  if (tracks.length === 0) {
    list.innerHTML = '<p style="color:var(--text-dim);">No tracks saved yet.</p>';
    return;
  }
  list.innerHTML = '';
  tracks.forEach((t) => {
    const div = document.createElement('div');
    div.className = 'card-link';
    div.style.marginBottom = '8px';
    div.style.cursor = 'pointer';
    div.innerHTML = `<h3>${t.name}</h3><p>${(t.totalLength).toFixed(0)} m · ${t.sectors.length} sector split(s)</p>`;
    div.onclick = () => loadTrackForEditing(t);
    list.appendChild(div);
  });
}

function updateRecStats() {
  $('ptCount').textContent = rawPoints.length;
  let dist = 0;
  for (let i = 1; i < rawPoints.length; i++) {
    dist += Geo.haversine(rawPoints[i - 1].lat, rawPoints[i - 1].lng, rawPoints[i].lat, rawPoints[i].lng);
  }
  $('ptDist').textContent = dist.toFixed(0) + ' m';
}

function startRecording() {
  if (!navigator.geolocation) { alert('Geolocation not available in this browser.'); return; }
  rawPoints = [];
  $('startRec').disabled = true;
  $('stopRec').disabled = false;
  $('recStatus').textContent = 'recording';
  $('recStatus').className = 'pill live';
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      rawPoints.push({ lat: latitude, lng: longitude, t: Date.now() });
      $('ptAcc').textContent = accuracy ? accuracy.toFixed(0) + ' m' : '--';
      updateRecStats();
    },
    (err) => { console.error(err); alert('GPS error: ' + err.message); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
}

function stopRecording() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  $('startRec').disabled = false;
  $('stopRec').disabled = true;
  $('recStatus').textContent = 'idle';
  $('recStatus').className = 'pill off';

  if (rawPoints.length < 5) {
    alert('Not enough points captured — drive a bit longer next time.');
    return;
  }
  const track = Geo.buildTrack(rawPoints, 'New track');
  loadTrackForEditing(track, /*isNew=*/true);
}

function loadTrackForEditing(track, isNew) {
  currentTrack = JSON.parse(JSON.stringify(track)); // clone so cancel-free edits are safe
  $('trackPanel').style.display = 'block';
  $('trackName').value = currentTrack.name;
  $('deleteBtn').style.display = isNew ? 'none' : 'inline-block';
  drawTrack();
  renderSectorList();
  $('trackPanel').scrollIntoView({ behavior: 'smooth' });
}

// ---- Canvas drawing + click-to-place sectors ----

function trackBounds(track) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  track.points.forEach((p) => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  return { minX, maxX, minY, maxY };
}

function toCanvasXY(track, bounds, p) {
  const pad = 30;
  const w = canvas.width - pad * 2, h = canvas.height - pad * 2;
  const scale = Math.min(w / (bounds.maxX - bounds.minX || 1), h / (bounds.maxY - bounds.minY || 1));
  const cx = pad + (p.x - bounds.minX) * scale;
  // flip Y so north is up
  const cy = canvas.height - pad - (p.y - bounds.minY) * scale;
  return { x: cx, y: cy };
}

function drawTrack() {
  if (!currentTrack) return;
  const bounds = trackBounds(currentTrack);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // path
  ctx.strokeStyle = '#8a919c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  currentTrack.points.forEach((p, i) => {
    const c = toCanvasXY(currentTrack, bounds, p);
    if (i === 0) ctx.moveTo(c.x, c.y); else ctx.lineTo(c.x, c.y);
  });
  ctx.stroke();

  // start/finish
  const startC = toCanvasXY(currentTrack, bounds, currentTrack.points[0]);
  ctx.fillStyle = '#21c567';
  ctx.beginPath(); ctx.arc(startC.x, startC.y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8eaed';
  ctx.font = '12px monospace';
  ctx.fillText('START/FINISH', startC.x + 10, startC.y - 8);

  // sectors
  currentTrack.sectors.forEach((s, idx) => {
    const pt = pointAtDist(currentTrack, s.dist);
    const c = toCanvasXY(currentTrack, bounds, pt);
    ctx.fillStyle = '#f5c518';
    ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8eaed';
    ctx.fillText(s.name, c.x + 8, c.y + 4);
  });
}

function pointAtDist(track, dist) {
  const pts = track.points;
  for (let i = 0; i < pts.length - 1; i++) {
    if (dist >= pts[i].dist && dist <= pts[i + 1].dist) {
      const t = (dist - pts[i].dist) / (pts[i + 1].dist - pts[i].dist || 1);
      return {
        x: pts[i].x + t * (pts[i + 1].x - pts[i].x),
        y: pts[i].y + t * (pts[i + 1].y - pts[i].y),
      };
    }
  }
  return pts[pts.length - 1];
}

function nearestTrackPointToCanvasClick(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
  const clickX = (evt.clientX - rect.left) * scaleX;
  const clickY = (evt.clientY - rect.top) * scaleY;
  const bounds = trackBounds(currentTrack);
  let best = null;
  currentTrack.points.forEach((p) => {
    const c = toCanvasXY(currentTrack, bounds, p);
    const d = Math.hypot(c.x - clickX, c.y - clickY);
    if (!best || d < best.d) best = { d, dist: p.dist, canvasX: c.x, canvasY: c.y };
  });
  return best;
}

function handleCanvasClick(evt) {
  if (!currentTrack) return;
  const hit = nearestTrackPointToCanvasClick(evt);
  if (!hit) return;

  // If close to an existing sector marker, remove it instead of adding.
  const REMOVE_RADIUS_M = currentTrack.totalLength * 0.02;
  const existingIdx = currentTrack.sectors.findIndex((s) => Math.abs(s.dist - hit.dist) < REMOVE_RADIUS_M);
  if (existingIdx >= 0) {
    currentTrack.sectors.splice(existingIdx, 1);
  } else {
    const name = 'S' + (currentTrack.sectors.length + 1);
    currentTrack.sectors.push({ name, dist: hit.dist });
    currentTrack.sectors.sort((a, b) => a.dist - b.dist);
    // renumber sequentially
    currentTrack.sectors.forEach((s, i) => (s.name = 'S' + (i + 1)));
  }
  drawTrack();
  renderSectorList();
}

function renderSectorList() {
  const wrap = $('sectorList');
  wrap.innerHTML = '';
  if (currentTrack.sectors.length === 0) {
    wrap.innerHTML = '<p style="color:var(--text-dim);">No sector splits yet — click the track above to add one.</p>';
    return;
  }
  currentTrack.sectors.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'sector-row';
    row.innerHTML = `
      <div class="dot"></div>
      <div class="mono" style="width:40px;">${s.name}</div>
      <input type="text" class="mono distInput" value="${s.dist.toFixed(0)}" data-idx="${i}">
      <span style="color:var(--text-dim);">m along track</span>
      <button class="secondary removeSectorBtn" data-idx="${i}" style="margin-left:auto;">Remove</button>
    `;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('.distInput').forEach((inp) => {
    inp.onchange = (e) => {
      const idx = +e.target.dataset.idx;
      let v = parseFloat(e.target.value);
      v = Math.max(0, Math.min(currentTrack.totalLength, v || 0));
      currentTrack.sectors[idx].dist = v;
      currentTrack.sectors.sort((a, b) => a.dist - b.dist);
      currentTrack.sectors.forEach((s, i2) => (s.name = 'S' + (i2 + 1)));
      drawTrack();
      renderSectorList();
    };
  });
  wrap.querySelectorAll('.removeSectorBtn').forEach((btn) => {
    btn.onclick = (e) => {
      const idx = +e.target.dataset.idx;
      currentTrack.sectors.splice(idx, 1);
      currentTrack.sectors.forEach((s, i2) => (s.name = 'S' + (i2 + 1)));
      drawTrack();
      renderSectorList();
    };
  });
}

async function saveCurrentTrack() {
  currentTrack.name = $('trackName').value.trim() || currentTrack.name;
  await DB.saveTrack(currentTrack);
  SelectedTrack.set(currentTrack.id);
  await refreshTrackList();
  alert('Track saved: ' + currentTrack.name);
}

function exportCurrentTrack() {
  const blob = new Blob([JSON.stringify(currentTrack, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (currentTrack.name || 'track').replace(/\s+/g, '_') + '.json';
  a.click();
}

async function deleteCurrentTrack() {
  if (!confirm('Delete this track?')) return;
  await DB.deleteTrack(currentTrack.id);
  currentTrack = null;
  $('trackPanel').style.display = 'none';
  await refreshTrackList();
}

function importTrackFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const track = JSON.parse(reader.result);
      await DB.saveTrack(track);
      await refreshTrackList();
      alert('Imported: ' + track.name);
    } catch (e) {
      alert('Invalid track JSON file.');
    }
  };
  reader.readAsText(file);
}

window.addEventListener('DOMContentLoaded', () => {
  canvas = $('trackCanvas');
  ctx = canvas.getContext('2d');
  // keep internal canvas resolution crisp regardless of CSS width
  canvas.width = 800; canvas.height = 340;

  $('startRec').onclick = startRecording;
  $('stopRec').onclick = stopRecording;
  $('saveTrackBtn').onclick = saveCurrentTrack;
  $('exportBtn').onclick = exportCurrentTrack;
  $('deleteBtn').onclick = deleteCurrentTrack;
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = (e) => { if (e.target.files[0]) importTrackFile(e.target.files[0]); };
  canvas.onclick = handleCanvasClick;

  refreshTrackList();
});
