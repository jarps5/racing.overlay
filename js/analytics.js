// analytics.js — post-session lap comparison.

let laps = [];
let selectedA = null;
let selectedB = null;

function $(id) { return document.getElementById(id); }

async function populateTrackSelect() {
  const tracks = await DB.getAllTracks();
  const sel = $('trackSelect');
  sel.innerHTML = '';
  if (tracks.length === 0) {
    sel.innerHTML = '<option>No tracks yet</option>';
    return;
  }
  tracks.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
  const pre = SelectedTrack.get();
  if (pre && tracks.some((t) => t.id === pre)) sel.value = pre;
  await loadLapsForSelectedTrack();
}

async function loadLapsForSelectedTrack() {
  const trackId = $('trackSelect').value;
  laps = await DB.getLapsForTrack(trackId);
  laps.sort((a, b) => a.lapTime - b.lapTime);
  selectedA = laps[0]?.id || null;
  selectedB = laps[1]?.id || null;
  renderLapRows();
  renderCharts();
}

function renderLapRows() {
  const wrap = $('lapRows');
  wrap.innerHTML = '';
  if (laps.length === 0) {
    wrap.innerHTML = '<p style="color:var(--text-dim);">No laps recorded for this track yet.</p>';
    return;
  }
  laps.forEach((l, i) => {
    const row = document.createElement('div');
    row.className = 'lap-row';
    const date = new Date(l.date).toLocaleString();
    row.innerHTML = `
      <div class="mono" style="width:36px;">#${i + 1}</div>
      <div class="mono" style="width:110px;">${fmtTime(l.lapTime)}</div>
      <div style="flex:1; color:var(--text-dim); font-size:13px;">${date}</div>
      <button class="secondary aBtn" data-id="${l.id}">${selectedA === l.id ? 'A ✓' : 'Set A'}</button>
      <button class="secondary bBtn" data-id="${l.id}">${selectedB === l.id ? 'B ✓' : 'Set B'}</button>
      <button class="danger delBtn" data-id="${l.id}">Delete</button>
    `;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('.aBtn').forEach((b) => b.onclick = (e) => { selectedA = e.target.dataset.id; renderLapRows(); renderCharts(); });
  wrap.querySelectorAll('.bBtn').forEach((b) => b.onclick = (e) => { selectedB = e.target.dataset.id; renderLapRows(); renderCharts(); });
  wrap.querySelectorAll('.delBtn').forEach((b) => b.onclick = async (e) => {
    if (!confirm('Delete this lap?')) return;
    await DB.deleteLap(e.target.dataset.id);
    await loadLapsForSelectedTrack();
  });
}

function lapById(id) { return laps.find((l) => l.id === id) || null; }

function speedAtDist(lap, dist) {
  const s = lap.samples;
  if (!s.length) return 0;
  if (dist <= s[0].dist) return s[0].speed;
  if (dist >= s[s.length - 1].dist) return s[s.length - 1].speed;
  for (let i = 0; i < s.length - 1; i++) {
    if (dist >= s[i].dist && dist <= s[i + 1].dist) {
      const t = (dist - s[i].dist) / (s[i + 1].dist - s[i].dist || 1);
      return s[i].speed + t * (s[i + 1].speed - s[i].speed);
    }
  }
  return s[s.length - 1].speed;
}

function timeAtDist(lap, dist) {
  const s = lap.samples;
  if (!s.length) return null;
  if (dist <= s[0].dist) return s[0].t;
  if (dist >= s[s.length - 1].dist) return s[s.length - 1].t;
  for (let i = 0; i < s.length - 1; i++) {
    if (dist >= s[i].dist && dist <= s[i + 1].dist) {
      const t = (dist - s[i].dist) / (s[i + 1].dist - s[i].dist || 1);
      return s[i].t + t * (s[i + 1].t - s[i].t);
    }
  }
  return s[s.length - 1].t;
}

function drawAxes(ctx, canvas, xLabel, yLabel) {
  ctx.strokeStyle = '#262b33';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  ctx.fillStyle = '#8a919c';
  ctx.font = '11px monospace';
  ctx.fillText(xLabel, canvas.width - ctx.measureText(xLabel).width - 8, canvas.height - 8);
  ctx.save();
  ctx.translate(14, 16);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function renderSpeedChart() {
  const canvas = $('speedChart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawAxes(ctx, canvas, 'distance →', 'speed (km/h)');

  const a = lapById(selectedA), b = lapById(selectedB);
  if (!a) return;
  const maxDist = Math.max(...(a.samples.map((s) => s.dist)), ...(b ? b.samples.map((s) => s.dist) : [0]));
  const maxSpeed = Math.max(1, ...(a.samples.map((s) => s.speed)), ...(b ? b.samples.map((s) => s.speed) : [0]));
  const pad = 30;

  function plot(lap, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    lap.samples.forEach((s, i) => {
      const x = pad + (s.dist / maxDist) * (canvas.width - pad * 2);
      const y = canvas.height - pad - (s.speed / maxSpeed) * (canvas.height - pad * 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  plot(a, '#f5c518');
  if (b) plot(b, '#21c567');

  ctx.font = '12px monospace';
  ctx.fillStyle = '#f5c518'; ctx.fillText('A', canvas.width - 40, 20);
  if (b) { ctx.fillStyle = '#21c567'; ctx.fillText('B', canvas.width - 24, 20); }
}

function renderDeltaChart() {
  const canvas = $('deltaChart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawAxes(ctx, canvas, 'distance →', 'delta B-A (s)');

  const a = lapById(selectedA), b = lapById(selectedB);
  if (!a || !b) return;
  const maxDist = Math.min(a.samples[a.samples.length - 1].dist, b.samples[b.samples.length - 1].dist);
  const N = 200;
  const deltas = [];
  for (let i = 0; i <= N; i++) {
    const dist = (i / N) * maxDist;
    const ta = timeAtDist(a, dist), tb = timeAtDist(b, dist);
    if (ta == null || tb == null) continue;
    deltas.push({ dist, delta: (tb - ta) / 1000 });
  }
  if (!deltas.length) return;
  const maxAbs = Math.max(0.5, ...deltas.map((d) => Math.abs(d.delta)));
  const pad = 30;
  const zeroY = canvas.height / 2;

  ctx.strokeStyle = '#262b33';
  ctx.beginPath(); ctx.moveTo(pad, zeroY); ctx.lineTo(canvas.width - pad, zeroY); ctx.stroke();

  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 2;
  ctx.beginPath();
  deltas.forEach((d, i) => {
    const x = pad + (d.dist / maxDist) * (canvas.width - pad * 2);
    const y = zeroY - (d.delta / maxAbs) * (canvas.height / 2 - pad);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderCharts() {
  renderSpeedChart();
  renderDeltaChart();
}

async function exportAllLaps() {
  const blob = new Blob([JSON.stringify(laps, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'laps.json';
  a.click();
}

function importLapsFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      const arr = Array.isArray(imported) ? imported : [imported];
      for (const l of arr) await DB.saveLap(l);
      await loadLapsForSelectedTrack();
      alert(`Imported ${arr.length} lap(s).`);
    } catch (e) {
      alert('Invalid laps JSON file.');
    }
  };
  reader.readAsText(file);
}

window.addEventListener('DOMContentLoaded', () => {
  $('trackSelect').onchange = loadLapsForSelectedTrack;
  $('exportAllBtn').onclick = exportAllLaps;
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = (e) => { if (e.target.files[0]) importLapsFile(e.target.files[0]); };
  populateTrackSelect();
});
