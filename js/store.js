// Everything WordSteps remembers lives on this device, in IndexedDB:
//   kv        settings and each activity's current level, by name
//   sessions  one record per finished session
//   trials    one record per question answered (for the progress grid)
//   photos    a grown-up's photo for a word, as JPEG bytes (ArrayBuffers:
//             some Safari sessions refuse Blobs)

const DB = 'wordsteps';
const STORES = ['kv', 'sessions', 'trials', 'photos'];

let dbp = null;
function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('kv');
      d.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
      d.createObjectStore('trials', { keyPath: 'id', autoIncrement: true });
      d.createObjectStore('photos');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const get = (key) => tx('kv', 'readonly', (s) => s.get(key));
export const set = (key, value) => tx('kv', 'readwrite', (s) => s.put(value, key));

export const DEFAULT_SETTINGS = {
  showWord: true,     // the written word under each picture
  trials: 8,          // questions in a session (each word in the set twice)
  promptAfter: 6,     // seconds before the right answer is shown, 0 = never
  rewards: true,      // stars and a chime after each right answer
  pictures: 'ai',     // 'ai' = AI pictures where there is one, 'symbols' = ARASAAC
};
export async function settings() { return { ...DEFAULT_SETTINGS, ...(await get('settings')) }; }
export async function saveSettings(s) { await set('settings', s); }

// The number of pictures to choose from, per activity and set: 1 to 4.
export async function level(activity, setId) { return (await get(`level:${activity}:${setId}`)) ?? 2; }
export async function setLevel(activity, setId, n) { await set(`level:${activity}:${setId}`, Math.max(1, Math.min(4, n))); }

export async function currentSet() { return (await get('currentSet')) ?? 1; }
export async function setCurrentSet(id) { await set('currentSet', id); }

/** Saves a finished session and its trials, returns the session's id. */
export async function saveSession(session, trials) {
  const id = await tx('sessions', 'readwrite', (s) => s.add(session));
  await tx('trials', 'readwrite', (s) => { for (const t of trials) s.add({ ...t, session: id }); });
  return id;
}
export const allSessions = () => tx('sessions', 'readonly', (s) => s.getAll());
export const allTrials = () => tx('trials', 'readonly', (s) => s.getAll());

export const getPhoto = (word) => tx('photos', 'readonly', (s) => s.get(word));
export const setPhoto = (word, data) => tx('photos', 'readwrite', (s) => s.put(data, word));
export const removePhoto = (word) => tx('photos', 'readwrite', (s) => s.delete(word));
export const photoWords = () => tx('photos', 'readonly', (s) => s.getAllKeys());

// ---------- Backup ----------

const toB64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0)).buffer;

export async function backup() {
  const out = { app: 'wordsteps', version: 1, saved: new Date().toISOString(), kv: {}, sessions: [], trials: [], photos: {} };
  const d = await db();
  await new Promise((resolve, reject) => {
    const t = d.transaction(STORES, 'readonly');
    const kv = t.objectStore('kv');
    kv.getAllKeys().onsuccess = (e) => { for (const k of e.target.result) kv.get(k).onsuccess = (g) => { out.kv[k] = g.target.result; }; };
    t.objectStore('sessions').getAll().onsuccess = (e) => { out.sessions = e.target.result; };
    t.objectStore('trials').getAll().onsuccess = (e) => { out.trials = e.target.result; };
    const ph = t.objectStore('photos');
    ph.getAllKeys().onsuccess = (e) => { for (const k of e.target.result) ph.get(k).onsuccess = (g) => { out.photos[k] = toB64(g.target.result); }; };
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
  return out;
}

/** Replaces everything on this device with a backup. */
export async function restore(data) {
  if (data?.app !== 'wordsteps') throw new Error('This isn’t a WordSteps backup.');
  const d = await db();
  await new Promise((resolve, reject) => {
    const t = d.transaction(STORES, 'readwrite');
    for (const s of STORES) t.objectStore(s).clear();
    for (const [k, v] of Object.entries(data.kv || {})) t.objectStore('kv').put(v, k);
    for (const s of data.sessions || []) t.objectStore('sessions').put(s);
    for (const tr of data.trials || []) t.objectStore('trials').put(tr);
    for (const [k, v] of Object.entries(data.photos || {})) t.objectStore('photos').put(fromB64(v), k);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}
