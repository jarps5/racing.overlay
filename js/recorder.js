// recorder.js — the phone-side live timing engine.

let track = null;
let bestLap = null;
let watchId = null;
let lastFix = null;      // {lat,lng,t}
let lastDist = null;
let lapStartTime = null;
let lapNumber = 0;
let currentLapSamples = [];
let sectorsCrossedThisLap = new Set();
let liveEnabled = false;

function $(id) { return document.getElementById(id); }

async function populateTrackSelect() {
  const tracks = await DB.getAllTracks();
  const sel = $('trackSelect');
  sel.innerHTML = '';
  if (tracks.length === 0) {
    sel.innerHTML = '<option>No tracks yet — map one in Track Editor first</option>';
    sel.disabled = true;
    $('startSession').disabled = true;
    return;
  }
  tracks.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} (${t.totalLength.toFixed(0)} m, ${t.sectors.length} sectors)`;
    sel.appendChild(opt);
  });
  const preselect = SelectedTrack.get();
  if (preselect && tracks.some((t) => t.id === preselect)) sel.value = preselect;
}

// Find the time (ms since lap start) a reference lap was at a given distance.
function timeAtDistInLap(lap, dist) {
  const s = lap.samples;
  if (!s || s.length === 0) return null;
  if (dist <= s[0].dist) return s[0].t;
  if (dist >= s[s.length - 1].dist) return s[s.length - 1].t;
  for (let i = 0; i < s.length - 1; i++) {
    if (dist >= s[i].dist && dist <= s[i + 1].dist) {
      const span = s[i + 1].dist - s[i].dist || 1;
      const t = (dist - s[i].dist) / span;
      return s[i].t + t * (s[i + 1].t - s[i].t);
    }
  }
  return s[s.length - 1].t;
}

function updateSectorStrip(splits) {
  const strip = $('sectorStrip');
  strip.innerHTML = '';
  if (!track.sectors.length) {
    strip.innerHTML = '<span style="color:var(--text-dim);">This track has no sector splits.</span>';
    return;
  }
  track.sectors.forEach((s) => {
    const chip = document.createElement('div');
    chip.className = 'sector-chip';
    const split = splits[s.name];
    if (split) {
      chip.classList.add(split.delta <= 0 ? 'ahead' : 'behind');
      chip.textContent = `${s.name}  ${fmtTime(split.time)}  (${fmtDelta(split.delta)}s)`;
    } else {
      chip.textContent = `${s.name}  --`;
    }
    strip.appendChild(chip);
  });
}

async function refreshLapTable() {
  const laps = track ? await DB.getLapsForTrack(track.id) : [];
  laps.sort((a, b) => a.date - b.date);
  const tbody = $('lapTable').querySelector('tbody');
  tbody.innerHTML = '';
  laps.forEach((l, i) => {
    const delta = bestLap ? l.lapTime - bestLap.lapTime : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td><td>${fmtTime(l.lapTime)}</td><td>${delta == null ? '--' : fmtDelta(delta)}</td>`;
    tbody.appendChild(tr);
  });
  $('bestLapVal').textContent = bestLap ? fmtTime(bestLap.lapTime) : '--:--.---';
}

let sectorSplitsThisLap = {};

async function finalizeLap(now) {
  const lapTime = now - lapStartTime;
  const lap = {
    id: 'lap_' + Date.now(),
    trackId: track.id,
    date: Date.now(),
    samples: currentLapSamples,
    lapTime,
    sectorTimes: sectorSplitsThisLap,
  };
  await DB.saveLap(lap);
  if (!bestLap || lapTime < bestLap.lapTime) bestLap = lap;
  await refreshLapTable();
}

function handleFix(pos) {
  const now = Date.now();
  const { latitude, longitude, speed, accuracy } = pos.coords;
  $('accVal').textContent = accuracy ? accuracy.toFixed(0) + ' m' : '--';

  const proj = Geo.projectOntoTrack(track, latitude, longitude);
  let speedKmh;
  if (speed != null && !isNaN(speed) && speed >= 0) {
    speedKmh = speed * 3.6;
  } else if (lastFix) {
    speedKmh = Geo.speedFromFixes(lastFix, { lat: latitude, lng: longitude, t: now });
  } else {
    speedKmh = 0;
  }
  lastFix = { lat: latitude, lng: longitude, t: now };

  if (lapStartTime === null) {
    lapStartTime = now;
    lapNumber = 1;
    lastDist = proj.dist;
    currentLapSamples = [];
    sectorSplitsThisLap = {};
    sectorsCrossedThisLap = new Set();
  } else if (lastDist > track.totalLength * 0.85 && proj.dist < track.totalLength * 0.15) {
    // crossed start/finish -> lap complete
    finalizeLap(now);
    lapNumber += 1;
    lapStartTime = now;
    currentLapSamples = [];
    sectorSplitsThisLap = {};
    sectorsCrossedThisLap = new Set();
  }

  const lapElapsed = now - lapStartTime;
  currentLapSamples.push({ t: lapElapsed, dist: proj.dist, speed: speedKmh });

  // sector crossings
  track.sectors.forEach((s) => {
    if (!sectorsCrossedThisLap.has(s.name) && lastDist < s.dist && proj.dist >= s.dist) {
      sectorsCrossedThisLap.add(s.name);
      let delta = null;
      if (bestLap) {
        const bestT = timeAtDistInLap(bestLap, s.dist);
        if (bestT != null) delta = lapElapsed - bestT;
      }
      sectorSplitsThisLap[s.name] = { time: lapElapsed, delta };
    }
  });

  // continuous delta vs best
  let delta = null;
  if (bestLap) {
    const bestT = timeAtDistInLap(bestLap, proj.dist);
    if (bestT != null) delta = lapElapsed - bestT;
  }

  lastDist = proj.dist;

  // ---- UI ----
  $('speedVal').textContent = speedKmh.toFixed(0);
  $('lapNum').textContent = lapNumber;
  $('lapTime').textContent = fmtTime(lapElapsed);
  const deltaEl = $('deltaVal');
  deltaEl.textContent = delta == null ? '--.--' : fmtDelta(delta);
  deltaEl.className = 'value mono delta' + (delta == null ? '' : delta <= 0 ? ' ahead' : ' behind');
  updateSectorStrip(sectorSplitsThisLap);

  // ---- push to overlay ----
  if (liveEnabled) {
    Live.pushLive({
      trackName: track.name,
      lat: latitude,
      lng: longitude,
      speed: speedKmh,
      dist: proj.dist,
      totalLength: track.totalLength,
      lapNumber,
      lapTime: lapElapsed,
      delta,
      sectorSplits: sectorSplitsThisLap,
    }).catch((e) => console.warn('Live push failed', e));
  }
}

async function startSession() {
  const trackId = $('trackSelect').value;
  track = await DB.getTrack(trackId);
  if (!track) { alert('Pick a track first.'); return; }
  SelectedTrack.set(track.id);

  const laps = await DB.getLapsForTrack(track.id);
  bestLap = laps.length ? laps.reduce((a, b) => (a.lapTime < b.lapTime ? a : b)) : null;

  const roomCode = $('roomInput').value.trim();
  liveEnabled = roomCode.length > 0;
  if (liveEnabled) {
    Room.set(roomCode);
    Live.setRoom(roomCode);
    try {
      await Live.pushTrack(track);
      $('linkPill').textContent = 'live · room "' + roomCode + '"';
    } catch (e) {
      console.warn('Could not reach Firebase — check js/firebase-config.js', e);
      $('linkPill').textContent = 'recording (overlay link failed)';
      $('linkPill').className = 'pill off';
    }
  } else {
    $('linkPill').textContent = 'recording (local only)';
    $('linkPill').className = 'pill off';
  }

  lastFix = null; lastDist = null; lapStartTime = null; lapNumber = 0;
  currentLapSamples = []; sectorSplitsThisLap = {}; sectorsCrossedThisLap = new Set();

  $('setupPanel').style.display = 'none';
  $('livePanel').style.display = 'block';
  await refreshLapTable();

  watchId = navigator.geolocation.watchPosition(handleFix, (err) => {
    console.error(err);
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });

  // keep the screen awake if the browser supports it
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
}

function stopSession() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  $('livePanel').style.display = 'none';
  $('setupPanel').style.display = 'block';
}

window.addEventListener('DOMContentLoaded', () => {
  populateTrackSelect();
  $('roomInput').value = Room.get();
  $('startSession').onclick = startSession;
  $('stopSession').onclick = stopSession;
});
