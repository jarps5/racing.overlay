// overlay.js — subscribes to Firebase live packets + the track, and feeds
// them into the shared widget dashboard. Layout itself is also stored in
// Firebase (rooms/{room}/layout) so edits made from any device update what
// OBS is showing immediately — OBS's Browser Source has its own private
// storage, so localStorage alone wouldn't reach it.

let track = null;
let dashboard = null;
let latestLive = {};

function $(id) { return document.getElementById(id); }

const DEFAULT_OVERLAY_LAYOUT = () => {
  const c = () => ({ accent: '#f5c518', text: '#e8eaed', bgAlpha: 0.82 });
  return [
    { id: 'o_speed', type: 'speed', x: 3, y: 70, w: 20, h: 22, colors: c() },
    { id: 'o_delta', type: 'delta', x: 24, y: 70, w: 20, h: 22, colors: c() },
    { id: 'o_lap', type: 'lapcounter', x: 45, y: 78, w: 10, h: 14, colors: c() },
    { id: 'o_elapsed', type: 'elapsed', x: 3, y: 92, w: 20, h: 8, colors: c() },
    { id: 'o_sectors', type: 'sectors', x: 3, y: 60, w: 45, h: 8, colors: c() },
    { id: 'o_map', type: 'trackmap', x: 76, y: 3, w: 20, h: 26, colors: c() },
  ];
};

function connect() {
  const code = $('roomInput').value.trim();
  if (!code) { alert('Enter the same room code used on the phone.'); return; }
  Room.set(code);
  Live.setRoom(code);

  $('setupPanel').style.display = 'none';

  const mount = document.createElement('div');
  mount.id = 'dashboard';
  mount.className = 'ro-dashboard';
  document.body.appendChild(mount);

  dashboard = createDashboard({
    container: mount,
    storage: FirebaseLayoutStorage(DEFAULT_OVERLAY_LAYOUT()),
    registry: WidgetRegistry,
    getData: () => latestLive,
  });
  dashboard.init().then(() => dashboard.update(latestLive));
  attachDashboardToolbar(dashboard, document.body);

  Live.onTrack((t) => {
    track = t;
    latestLive = { ...latestLive, track };
    dashboard.update(latestLive);
  });

  Live.onLive((data) => {
    if (!data) return;
    latestLive = {
      speed: data.speed,
      lapTime: data.lapTime,
      delta: data.delta,
      lapNumber: data.lapNumber,
      bestLapTime: latestLive.bestLapTime, // overlay doesn't track history locally; best shown via delta sign instead
      sectorSplits: data.sectorSplits || {},
      track,
      liveDist: data.dist,
      accuracy: null,
      trackName: data.trackName,
    };
    dashboard.update(latestLive);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  $('roomInput').value = Room.get();
  $('connectBtn').onclick = connect;
});
