// firebase.js — thin wrapper around Firebase Realtime Database.
// Used only for the LIVE link between the recorder (phone) and the
// overlay (OBS/PC). All permanent data (tracks, laps) stays local in
// IndexedDB — Firebase only ever carries the current live packet + the
// active track definition for a session "room".
//
// Requires js/firebase-config.js to be loaded first, and the Firebase
// compat SDK <script> tags to be included on the page (see any of the
// html files for the exact tags).

const Live = (() => {
  let db = null;
  let roomCode = null;

  function ensureInit() {
    if (!db) {
      firebase.initializeApp(firebaseConfig);
      db = firebase.database();
    }
  }

  function setRoom(code) {
    ensureInit();
    roomCode = (code || 'default').trim().toLowerCase().replace(/\s+/g, '-');
    return roomCode;
  }

  function roomRef(path) {
    if (!roomCode) throw new Error('Call Live.setRoom(code) first');
    return db.ref(`rooms/${roomCode}/${path}`);
  }

  // Recorder side: push the latest live packet (overwrites, not appended —
  // we only ever care about the current instant).
  function pushLive(packet) {
    return roomRef('live').set({ ...packet, ts: Date.now() });
  }

  // Recorder side: publish the active track once per session so the
  // overlay can draw the mini-map without needing local access to it.
  function pushTrack(track) {
    return roomRef('track').set(track);
  }

  // Overlay side: subscribe to live packets. Returns an unsubscribe fn.
  function onLive(cb) {
    const ref = roomRef('live');
    const handler = (snap) => cb(snap.val());
    ref.on('value', handler);
    return () => ref.off('value', handler);
  }

  // Overlay side: subscribe to the track definition.
  function onTrack(cb) {
    const ref = roomRef('track');
    const handler = (snap) => cb(snap.val());
    ref.on('value', handler);
    return () => ref.off('value', handler);
  }

  return { setRoom, pushLive, pushTrack, onLive, onTrack };
})();
