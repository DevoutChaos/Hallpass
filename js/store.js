// Persists the whole app state as one record in IndexedDB on this device.
// Falls back to localStorage if IndexedDB is unavailable. Nothing leaves the device.

const DB_NAME = 'hallpass';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'hallpass-state';

export const defaultRules = () => ({ maxBoys: 2, maxGirls: 2, maxTotal: 4, cooldownMins: 45 });

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function freshState() {
  return { schema: 1, pin: null, mode: 'settings', activeClassId: null, classes: [], log: [] };
}

const limit = (v, fallback) => (v === null ? null : Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback);

// Accepts anything (stored data or an imported backup) and returns a valid state, or throws.
export function normalise(raw) {
  if (raw == null) return freshState();
  if (typeof raw !== 'object' || !Array.isArray(raw.classes) || !Array.isArray(raw.log)) {
    throw new Error('Not a Hallpass backup');
  }
  const d = defaultRules();
  const classes = raw.classes
    .filter(c => c && typeof c.name === 'string' && Array.isArray(c.children))
    .map(c => ({
      id: String(c.id || newId()),
      name: c.name,
      children: c.children
        .filter(k => k && typeof k.name === 'string')
        .map(k => ({ id: String(k.id || newId()), name: k.name, gender: k.gender === 'M' || k.gender === 'F' ? k.gender : '' })),
      rules: {
        maxBoys: limit(c.rules?.maxBoys, d.maxBoys),
        maxGirls: limit(c.rules?.maxGirls, d.maxGirls),
        maxTotal: limit(c.rules?.maxTotal, d.maxTotal),
        cooldownMins: limit(c.rules?.cooldownMins, d.cooldownMins) ?? 0,
      },
    }));
  const log = raw.log
    .filter(e => e && typeof e.outAt === 'number' && typeof e.childName === 'string')
    .map(e => ({
      id: String(e.id || newId()),
      classId: String(e.classId ?? ''),
      className: String(e.className ?? ''),
      childId: String(e.childId ?? ''),
      childName: e.childName,
      gender: e.gender === 'M' || e.gender === 'F' ? e.gender : '',
      outAt: e.outAt,
      backAt: typeof e.backAt === 'number' ? e.backAt : null,
      ...(e.override === true && { override: true }),
    }));
  const activeClassId = classes.some(c => c.id === raw.activeClassId) ? raw.activeClassId : classes[0]?.id ?? null;
  return {
    schema: 1,
    pin: typeof raw.pin === 'string' && /^\d{4}$/.test(raw.pin) ? raw.pin : null,
    mode: raw.mode === 'class' && activeClassId ? 'class' : 'settings',
    activeClassId,
    classes,
    log,
  };
}

let dbPromise = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadState() {
  navigator.storage?.persist?.().catch(() => {});
  try {
    dbPromise = openDb();
    const db = await dbPromise;
    const value = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return normalise(value);
  } catch {
    dbPromise = null;
    try {
      return normalise(JSON.parse(localStorage.getItem(LS_KEY)));
    } catch {
      return freshState();
    }
  }
}

export function saveState(state) {
  if (dbPromise) {
    dbPromise
      .then(db => db.transaction(STORE, 'readwrite').objectStore(STORE).put(state, KEY))
      .catch(err => console.error('Save failed', err));
  } else {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Save failed', err);
    }
  }
}
