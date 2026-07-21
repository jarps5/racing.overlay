// db.js — tiny promise wrapper around IndexedDB.
// Stores: 'tracks' (track definitions), 'laps' (completed lap recordings).

const DB = (() => {
  const DB_NAME = 'racing-overlay';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('laps')) {
          const store = db.createObjectStore('laps', { keyPath: 'id' });
          store.createIndex('trackId', 'trackId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function put(store, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function get(store, id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(store) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function getByIndex(store, indexName, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(store, id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    saveTrack: (t) => put('tracks', t),
    getTrack: (id) => get('tracks', id),
    getAllTracks: () => getAll('tracks'),
    deleteTrack: (id) => remove('tracks', id),
    saveLap: (l) => put('laps', l),
    getLapsForTrack: (trackId) => getByIndex('laps', 'trackId', trackId),
    getAllLaps: () => getAll('laps'),
    deleteLap: (id) => remove('laps', id),
  };
})();
