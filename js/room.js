// room.js — small shared helpers used across pages.

const Room = {
  get() { return localStorage.getItem('ro_room') || ''; },
  set(code) { localStorage.setItem('ro_room', code); },
};

const SelectedTrack = {
  get() { return localStorage.getItem('ro_track_id') || ''; },
  set(id) { localStorage.setItem('ro_track_id', id); },
};

function fmtTime(ms) {
  if (ms == null || isNaN(ms)) return '--:--.---';
  const sign = ms < 0 ? '-' : '';
  ms = Math.abs(ms);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor(ms % 1000);
  return `${sign}${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(3, '0')}`;
}

function fmtDelta(ms) {
  if (ms == null || isNaN(ms)) return '--.--';
  const sign = ms >= 0 ? '+' : '-';
  return `${sign}${(Math.abs(ms) / 1000).toFixed(2)}`;
}
