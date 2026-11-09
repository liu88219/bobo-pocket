import {
  VaultState,
  Spot,
  PersonalMark,
  InboxItem,
  SpotOverride,
  CuratedVisibility,
  createInitialVaultState,
} from '../types/pocket';
import {
  deriveVaultIdentity,
  encryptVaultPayload,
  decryptVaultPayload,
  normalizePasscode,
  getPasscodeFallbackVariants,
} from './cryptoVault';

const LOCAL_STATE_KEY = 'bobopocket_state_v1';
const LAST_NONEMPTY_STATE_KEY = 'bobopocket_last_nonempty_v1';
const LOCAL_PASSCODE_KEY = 'bobopocket_saved_passcode_v1';

const TEXTDB_UPDATE_URL = 'https://api.textdb.online/update/';
const TEXTDB_READ_URL = 'https://textdb.online';
const TEXTDB_DEV_API_URL = 'https://textdb.dev/api/data';
const NTFY_BASE_URL = 'https://ntfy.sh';

const IDB_NAME = 'BoboPocketDB';
const IDB_KV_STORE = 'kv';
const IDB_PHOTO_STORE = 'photos';
const IDB_STATE_KEY = 'vault_state_v1';
const IDB_PASS_KEY = 'saved_passcode_v1';
const IDB_SNAPSHOTS_KEY = 'history_snapshots_v1';
const IDB_TIMEOUT_MS = 8000;

const CLOUD_CHUNK_PREFIX = 'BPCHUNK1:';
const CLOUD_CHUNK_MAX_CHARS = 40000;
const LOCALSTORAGE_MAX_INLINE_CHARS = 85000;

export type PhotoKind = 'spot' | 'mark' | 'inbox';

export interface LocalHistorySnapshot {
  id: string;
  savedAt: number;
  spotCount: number;
  markCount: number;
  inboxCount: number;
  stateJson: string;
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      await Promise.race([
        navigator.storage.persist(),
        new Promise<void>((resolve) => setTimeout(resolve, 1200)),
      ]);
    }
  } catch {
    // Ignore unsupported environments
  }
}

function withIdbTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, IDB_TIMEOUT_MS);
    promise
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

let cachedDbPromise: Promise<IDBDatabase | null> | null = null;

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (cachedDbPromise) return cachedDbPromise;
  const rawPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_KV_STORE)) db.createObjectStore(IDB_KV_STORE);
        if (!db.objectStoreNames.contains(IDB_PHOTO_STORE)) db.createObjectStore(IDB_PHOTO_STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          cachedDbPromise = null;
        };
        db.onclose = () => {
          cachedDbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        cachedDbPromise = null;
        resolve(null);
      };
      req.onblocked = () => {
        cachedDbPromise = null;
        resolve(null);
      };
    } catch {
      cachedDbPromise = null;
      resolve(null);
    }
  });
  cachedDbPromise = withIdbTimeout(rawPromise, null).then((db) => {
    if (!db) cachedDbPromise = null;
    return db;
  });
  return cachedDbPromise;
}

async function idbPut(storeName: string, key: string, value: string): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  const op = new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      cachedDbPromise = null;
      resolve();
    }
  });
  await withIdbTimeout(op, undefined);
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  const op = new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      cachedDbPromise = null;
      resolve();
    }
  });
  await withIdbTimeout(op, undefined);
}

async function idbGet(storeName: string, key: string): Promise<string | null> {
  const db = await openIdb();
  if (!db) return null;
  const op = new Promise<string | null>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      cachedDbPromise = null;
      resolve(null);
    }
  });
  return withIdbTimeout(op, null);
}

function photoKey(kind: PhotoKind, id: string): string {
  return `${kind}:${id}`;
}

export async function saveLocalPhoto(kind: PhotoKind, id: string, dataUrl: string): Promise<void> {
  await idbPut(IDB_PHOTO_STORE, photoKey(kind, id), dataUrl);
}

export async function getLocalPhoto(kind: PhotoKind, id: string): Promise<string | null> {
  return idbGet(IDB_PHOTO_STORE, photoKey(kind, id));
}

export async function deleteLocalPhoto(kind: PhotoKind, id: string): Promise<void> {
  await idbDelete(IDB_PHOTO_STORE, photoKey(kind, id));
}

export function parseVaultJson(raw: string | null | undefined): VaultState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<VaultState>;
    if (!parsed || typeof parsed !== 'object') return null;
    const base = createInitialVaultState();
    return {
      ...base,
      ...parsed,
      version: 1,
      profile: { ...base.profile, ...(parsed.profile || {}) },
      personalSpots: Array.isArray(parsed.personalSpots) ? parsed.personalSpots : [],
      overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
      marks: parsed.marks && typeof parsed.marks === 'object' ? parsed.marks : {},
      inbox: Array.isArray(parsed.inbox) ? parsed.inbox : [],
      curatedVisibility:
        parsed.curatedVisibility && typeof parsed.curatedVisibility === 'object'
          ? parsed.curatedVisibility
          : {},
      customTags: Array.isArray(parsed.customTags) ? parsed.customTags : [],
      categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : undefined,
      categoriesUpdatedAt: typeof parsed.categoriesUpdatedAt === 'number' ? parsed.categoriesUpdatedAt : 0,
      categoriesKnownDefaults: Array.isArray(parsed.categoriesKnownDefaults) ? parsed.categoriesKnownDefaults : undefined,
      deletedIds: parsed.deletedIds || {},
    };
  } catch {
    return null;
  }
}

export function hasUserRecords(state: VaultState): boolean {
  return (
    state.personalSpots.length > 0 ||
    state.inbox.length > 0 ||
    Object.keys(state.marks).length > 0 ||
    Object.keys(state.overrides).length > 0 ||
    Object.keys(state.curatedVisibility).length > 0 ||
    (state.customTags || []).length > 0 ||
    Boolean(state.categories && state.categories.length > 0)
  );
}

function stripPhotos(state: VaultState): VaultState {
  const marks: Record<string, PersonalMark> = {};
  for (const [k, m] of Object.entries(state.marks)) {
    const { photoThumb: _omit, ...rest } = m;
    marks[k] = rest;
  }
  return {
    ...state,
    personalSpots: state.personalSpots.map(({ coverThumb: _omit, ...rest }) => rest),
    marks,
    inbox: state.inbox.map(({ screenshotThumb: _omit, ...rest }) => rest),
  };
}

function tryWriteLocalStorageWithSlimFallback(key: string, fullRaw: string, state: VaultState): void {
  const toWrite =
    fullRaw.length <= LOCALSTORAGE_MAX_INLINE_CHARS ? fullRaw : JSON.stringify(stripPhotos(state));
  try {
    localStorage.setItem(key, toWrite);
  } catch {
    try {
      localStorage.setItem(key, JSON.stringify(stripPhotos(state)));
    } catch {
      // Shared-origin localStorage temporarily full; IndexedDB still holds 100% of state
    }
  }
}

export function loadLocalVaultSync(): VaultState {
  let primary: VaultState | null = null;
  let backup: VaultState | null = null;
  try {
    primary = parseVaultJson(localStorage.getItem(LOCAL_STATE_KEY));
  } catch {
    primary = null;
  }
  try {
    backup = parseVaultJson(localStorage.getItem(LAST_NONEMPTY_STATE_KEY));
  } catch {
    backup = null;
  }
  if (primary && backup) return mergeVaultStates(primary, backup);
  return primary || backup || createInitialVaultState();
}

export function loadRememberedPasscodeSync(): string {
  try {
    return normalizePasscode(localStorage.getItem(LOCAL_PASSCODE_KEY) || '');
  } catch {
    return '';
  }
}

async function appendRollingHistorySnapshot(state: VaultState, fullRaw: string): Promise<void> {
  if (!hasUserRecords(state)) return;
  try {
    const existingRaw = await idbGet(IDB_KV_STORE, IDB_SNAPSHOTS_KEY);
    const list: LocalHistorySnapshot[] = existingRaw ? JSON.parse(existingRaw) : [];
    const safeList = Array.isArray(list) ? list : [];
    const now = Date.now();
    const latest = safeList[0];
    const spotCount = state.personalSpots.length;
    const markCount = Object.keys(state.marks).length;
    const inboxCount = state.inbox.length;
    if (
      latest &&
      now - latest.savedAt < 90_000 &&
      latest.spotCount === spotCount &&
      latest.markCount === markCount &&
      latest.inboxCount === inboxCount
    ) {
      const updatedTop: LocalHistorySnapshot = { ...latest, savedAt: now, stateJson: fullRaw };
      await idbPut(IDB_KV_STORE, IDB_SNAPSHOTS_KEY, JSON.stringify([updatedTop, ...safeList.slice(1, 8)]));
      return;
    }
    const snap: LocalHistorySnapshot = {
      id: `snap-${now}`,
      savedAt: now,
      spotCount,
      markCount,
      inboxCount,
      stateJson: fullRaw,
    };
    await idbPut(IDB_KV_STORE, IDB_SNAPSHOTS_KEY, JSON.stringify([snap, ...safeList].slice(0, 8)));
  } catch {
    // Ignore snapshot errors
  }
}

export async function listLocalHistorySnapshots(): Promise<LocalHistorySnapshot[]> {
  try {
    const raw = await idbGet(IDB_KV_STORE, IDB_SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveLocalVaultState(state: VaultState): Promise<void> {
  if (state.isUneditedDefault && !hasUserRecords(state)) {
    const existing = loadLocalVaultSync();
    if (!existing.isUneditedDefault || hasUserRecords(existing)) return;
  }
  const fullRaw = JSON.stringify(state);
  tryWriteLocalStorageWithSlimFallback(LOCAL_STATE_KEY, fullRaw, state);
  if (hasUserRecords(state)) {
    tryWriteLocalStorageWithSlimFallback(LAST_NONEMPTY_STATE_KEY, fullRaw, state);
  }

  const photoWrites: Array<Promise<void>> = [];
  for (const s of state.personalSpots.slice(0, 40)) {
    if (s.coverThumb?.startsWith('data:image/')) {
      photoWrites.push(idbPut(IDB_PHOTO_STORE, `thumb:${photoKey('spot', s.id)}`, s.coverThumb));
    }
  }
  for (const m of Object.values(state.marks)) {
    if (m.photoThumb?.startsWith('data:image/')) {
      photoWrites.push(idbPut(IDB_PHOTO_STORE, `thumb:${photoKey('mark', m.spotId)}`, m.photoThumb));
    }
  }
  for (const it of state.inbox.slice(0, 40)) {
    if (it.screenshotThumb?.startsWith('data:image/')) {
      photoWrites.push(idbPut(IDB_PHOTO_STORE, `thumb:${photoKey('inbox', it.id)}`, it.screenshotThumb));
    }
  }
  await Promise.all([idbPut(IDB_KV_STORE, IDB_STATE_KEY, fullRaw), ...photoWrites]);
  if (hasUserRecords(state)) {
    await appendRollingHistorySnapshot(state, fullRaw);
  }
}

async function hydrateThumbsFromIdb(state: VaultState): Promise<VaultState> {
  const personalSpots = await Promise.all(
    state.personalSpots.map(async (s) => {
      if (s.coverThumb) return s;
      const t = await idbGet(IDB_PHOTO_STORE, `thumb:${photoKey('spot', s.id)}`);
      return t ? { ...s, coverThumb: t } : s;
    })
  );
  const markEntries = await Promise.all(
    Object.entries(state.marks).map(async ([k, m]) => {
      if (m.photoThumb) return [k, m] as const;
      const t = await idbGet(IDB_PHOTO_STORE, `thumb:${photoKey('mark', m.spotId)}`);
      return [k, t ? { ...m, photoThumb: t } : m] as const;
    })
  );
  const inbox = await Promise.all(
    state.inbox.map(async (it) => {
      if (it.screenshotThumb) return it;
      const t = await idbGet(IDB_PHOTO_STORE, `thumb:${photoKey('inbox', it.id)}`);
      return t ? { ...it, screenshotThumb: t } : it;
    })
  );
  const marks: Record<string, PersonalMark> = {};
  for (const [k, m] of markEntries) marks[k] = m;
  return { ...state, personalSpots, marks, inbox };
}

export async function loadLocalVaultState(): Promise<VaultState> {
  let merged = loadLocalVaultSync();
  const idbRaw = await idbGet(IDB_KV_STORE, IDB_STATE_KEY);
  const idbState = parseVaultJson(idbRaw);
  if (idbState) merged = mergeVaultStates(merged, idbState);

  if (!hasUserRecords(merged) && merged.isUneditedDefault) {
    const snaps = await listLocalHistorySnapshots();
    if (snaps.length > 0) {
      const snapState = parseVaultJson(snaps[0].stateJson);
      if (snapState && hasUserRecords(snapState)) merged = mergeVaultStates(merged, snapState);
    }
  }

  merged = await hydrateThumbsFromIdb(merged);

  if (!merged.isUneditedDefault) {
    const fullRaw = JSON.stringify(merged);
    tryWriteLocalStorageWithSlimFallback(LOCAL_STATE_KEY, fullRaw, merged);
    if (hasUserRecords(merged)) tryWriteLocalStorageWithSlimFallback(LAST_NONEMPTY_STATE_KEY, fullRaw, merged);
    await idbPut(IDB_KV_STORE, IDB_STATE_KEY, fullRaw);
  }
  return merged;
}

export async function saveRememberedPasscode(passcode: string): Promise<void> {
  const clean = normalizePasscode(passcode);
  try {
    if (clean) localStorage.setItem(LOCAL_PASSCODE_KEY, clean);
    else localStorage.removeItem(LOCAL_PASSCODE_KEY);
  } catch {
    // Ignore quota errors; IndexedDB stores the passcode reliably
  }
  await idbPut(IDB_KV_STORE, IDB_PASS_KEY, clean);
}

export async function loadRememberedPasscode(): Promise<string> {
  let saved = loadRememberedPasscodeSync();
  if (!saved) {
    saved = (await idbGet(IDB_KV_STORE, IDB_PASS_KEY)) || '';
    if (saved) {
      try {
        localStorage.setItem(LOCAL_PASSCODE_KEY, saved);
      } catch {
        // Ignore
      }
    }
  }
  return normalizePasscode(saved);
}

function mergeById<T extends { id: string; updatedAt: number; createdAt: number }>(
  remote: T[],
  local: T[],
  deletedIds: Record<string, number>,
  keepPhoto?: (prev: T | undefined, next: T) => T
): T[] {
  const map = new Map<string, T>();
  for (const item of [...remote, ...local]) {
    if (!item || !item.id) continue;
    const itemTs = item.updatedAt || item.createdAt || 0;
    const delTs = deletedIds[item.id];
    if (delTs && delTs >= itemTs) continue;
    const prev = map.get(item.id);
    if (!prev || itemTs >= (prev.updatedAt || prev.createdAt || 0)) {
      map.set(item.id, keepPhoto ? keepPhoto(prev, item) : item);
    } else if (keepPhoto) {
      map.set(item.id, keepPhoto(item, prev));
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * 防空白覆蓋與墓碑合併演算法 (Anti-Overwrite Merge & Tombstones)
 */
export function mergeVaultStates(local: VaultState, remote: VaultState): VaultState {
  if (local.isUneditedDefault && !remote.isUneditedDefault) return { ...remote, isUneditedDefault: false };
  if (remote.isUneditedDefault && !local.isUneditedDefault) return { ...local, isUneditedDefault: false };

  const deletedIds: Record<string, number> = { ...(remote.deletedIds || {}) };
  for (const [id, ts] of Object.entries(local.deletedIds || {})) {
    if (!deletedIds[id] || ts > deletedIds[id]) deletedIds[id] = ts;
  }

  const personalSpots = mergeById<Spot>(remote.personalSpots, local.personalSpots, deletedIds, (prev, next) => ({
    ...prev,
    ...next,
    coverThumb: next.coverThumb || prev?.coverThumb,
    hasCoverPhoto: Boolean(next.hasCoverPhoto || prev?.hasCoverPhoto || next.coverThumb || prev?.coverThumb),
  }));

  const inbox = mergeById<InboxItem>(remote.inbox, local.inbox, deletedIds, (prev, next) => ({
    ...prev,
    ...next,
    screenshotThumb: next.screenshotThumb || prev?.screenshotThumb,
    hasLocalHiResPhoto: Boolean(next.hasLocalHiResPhoto || prev?.hasLocalHiResPhoto),
  }));

  const marks: Record<string, PersonalMark> = {};
  for (const m of [...Object.values(remote.marks || {}), ...Object.values(local.marks || {})]) {
    if (!m || !m.spotId) continue;
    const prev = marks[m.spotId];
    const ts = m.updatedAt || m.createdAt || 0;
    if (!prev || ts >= (prev.updatedAt || prev.createdAt || 0)) {
      marks[m.spotId] = { ...prev, ...m, photoThumb: m.photoThumb || prev?.photoThumb };
    } else if (!prev.photoThumb && m.photoThumb) {
      marks[m.spotId] = { ...prev, photoThumb: m.photoThumb };
    }
  }

  const overrides: Record<string, SpotOverride> = { ...(remote.overrides || {}) };
  for (const [id, ov] of Object.entries(local.overrides || {})) {
    const prev = overrides[id];
    if (!prev || (ov.updatedAt || 0) >= (prev.updatedAt || 0)) overrides[id] = ov;
  }

  const curatedVisibility: Record<string, CuratedVisibility> = { ...(remote.curatedVisibility || {}) };
  for (const [id, v] of Object.entries(local.curatedVisibility || {})) {
    const prev = curatedVisibility[id];
    if (!prev || (v.updatedAt || 0) >= (prev.updatedAt || 0)) curatedVisibility[id] = v;
  }

  const customTags = Array.from(new Set([...(remote.customTags || []), ...(local.customTags || [])]));

  const localCatsNewer = (local.categoriesUpdatedAt || 0) >= (remote.categoriesUpdatedAt || 0);
  const categories = localCatsNewer ? local.categories || remote.categories : remote.categories || local.categories;
  const categoriesKnownDefaults = localCatsNewer
    ? local.categoriesKnownDefaults || remote.categoriesKnownDefaults
    : remote.categoriesKnownDefaults || local.categoriesKnownDefaults;
  const categoriesUpdatedAt = Math.max(local.categoriesUpdatedAt || 0, remote.categoriesUpdatedAt || 0);

  const localSettingsNewer = (local.settingsUpdatedAt || 0) >= (remote.settingsUpdatedAt || 0);
  const profile = localSettingsNewer
    ? { ...remote.profile, ...local.profile }
    : { ...local.profile, ...remote.profile };

  const maxUpdatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  const maxSettingsAt = Math.max(local.settingsUpdatedAt || 0, remote.settingsUpdatedAt || 0);
  const hasAnyEdit =
    !local.isUneditedDefault ||
    !remote.isUneditedDefault ||
    maxUpdatedAt > 0 ||
    personalSpots.length > 0 ||
    inbox.length > 0 ||
    Object.keys(marks).length > 0;

  return {
    version: 1,
    updatedAt: maxUpdatedAt,
    settingsUpdatedAt: maxSettingsAt,
    isUneditedDefault: !hasAnyEdit,
    profile,
    personalSpots,
    overrides,
    marks,
    inbox,
    curatedVisibility,
    customTags,
    categories,
    categoriesUpdatedAt,
    categoriesKnownDefaults,
    deletedIds,
  };
}

/**
 * 主索引僅保留最近幾張縮圖供秒開顯示，所有照片另以加密分片獨立同步至雙雲端。
 */
export function compactStateForCloud(state: VaultState): VaultState {
  const personalSpots = state.personalSpots.map((s, idx) => {
    const flagged = { ...s, hasCoverPhoto: Boolean(s.hasCoverPhoto || s.coverThumb) };
    if (idx < 8) return flagged;
    const { coverThumb: _omit, ...rest } = flagged;
    return rest;
  });
  const markList = Object.values(state.marks).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const marks: Record<string, PersonalMark> = {};
  markList.forEach((m, idx) => {
    const flagged = { ...m, hasLocalHiResPhoto: Boolean(m.hasLocalHiResPhoto || m.photoThumb) };
    if (idx < 8) {
      marks[m.spotId] = flagged;
    } else {
      const { photoThumb: _omit, ...rest } = flagged;
      marks[m.spotId] = rest;
    }
  });
  const inbox = state.inbox.map((it, idx) => {
    const flagged = { ...it, hasLocalHiResPhoto: Boolean(it.hasLocalHiResPhoto || it.screenshotThumb) };
    if (idx < 6) return flagged;
    const { screenshotThumb: _omit, ...rest } = flagged;
    return rest;
  });
  return { ...state, personalSpots, marks, inbox };
}

export function buildTextDbFormBody(key: string, value: string): string {
  return new URLSearchParams({ key, value }).toString();
}

async function writeTextDbOnlineSingle(key: string, value: string): Promise<boolean> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8500) : null;
  try {
    const body = buildTextDbFormBody(key, value);
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: ctrl?.signal,
    };
    if (body.length < 55000) init.keepalive = true;
    const res = await fetch(TEXTDB_UPDATE_URL, init);
    if (!res.ok) return false;
    const txt = (await res.text()).trim();
    if (!txt) return true;
    try {
      const parsed = JSON.parse(txt) as { status?: number };
      if (parsed && typeof parsed === 'object' && 'status' in parsed) return Number(parsed.status) === 1;
    } catch {
      // Non-JSON 200 OK fallback
    }
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function writeTextDbDevSingle(key: string, value: string): Promise<boolean> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8500) : null;
  try {
    const bodyStr = JSON.stringify({ payload: value });
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
      signal: ctrl?.signal,
    };
    if (bodyStr.length < 55000) init.keepalive = true;
    const res = await fetch(`${TEXTDB_DEV_API_URL}/${encodeURIComponent(key)}`, init);
    return res.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function writeChunkedToProvider(
  baseKey: string,
  fullValue: string,
  writeSingle: (k: string, v: string) => Promise<boolean>
): Promise<boolean> {
  if (fullValue.length <= CLOUD_CHUNK_MAX_CHARS) return writeSingle(baseKey, fullValue);
  const chunks: string[] = [];
  for (let i = 0; i < fullValue.length; i += CLOUD_CHUNK_MAX_CHARS) {
    chunks.push(fullValue.slice(i, i + CLOUD_CHUNK_MAX_CHARS));
  }
  for (let idx = 1; idx < chunks.length; idx++) {
    const ok = await writeSingle(`${baseKey}_p${idx}`, chunks[idx]);
    if (!ok) return false;
  }
  return writeSingle(baseKey, `${CLOUD_CHUNK_PREFIX}${chunks.length}:${chunks[0]}`);
}

export async function writePermanentCloud(key: string, value: string): Promise<boolean> {
  const [okOnline, okDev] = await Promise.all([
    writeChunkedToProvider(key, value, writeTextDbOnlineSingle),
    writeChunkedToProvider(key, value, writeTextDbDevSingle),
  ]);
  return okOnline || okDev;
}

async function readTextDbOnlineSingle(key: string): Promise<string | null> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 7000) : null;
  try {
    const res = await fetch(`${TEXTDB_READ_URL}/${encodeURIComponent(key)}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: ctrl?.signal,
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text || null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readTextDbDevSingle(key: string): Promise<string | null> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 7000) : null;
  try {
    const res = await fetch(`${TEXTDB_DEV_API_URL}/${encodeURIComponent(key)}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: ctrl?.signal,
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text) return null;
    let parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (parsed && typeof parsed === 'object' && 'payload' in parsed) {
      const p = (parsed as { payload?: unknown }).payload;
      return typeof p === 'string' && p.trim() ? p.trim() : null;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readChunkedFromProvider(
  baseKey: string,
  readSingle: (k: string) => Promise<string | null>
): Promise<string | null> {
  const head = await readSingle(baseKey);
  if (!head) return null;
  if (!head.startsWith(CLOUD_CHUNK_PREFIX)) return head;
  const rest = head.slice(CLOUD_CHUNK_PREFIX.length);
  const colonIdx = rest.indexOf(':');
  if (colonIdx <= 0) return null;
  const totalChunks = Number.parseInt(rest.slice(0, colonIdx), 10);
  const chunk0 = rest.slice(colonIdx + 1);
  if (!Number.isFinite(totalChunks) || totalChunks < 2 || totalChunks > 60) return null;
  const tails = await Promise.all(
    Array.from({ length: totalChunks - 1 }, (_, i) => readSingle(`${baseKey}_p${i + 1}`))
  );
  if (tails.some((part) => !part)) return null;
  return chunk0 + tails.join('');
}

export async function readPermanentCloud(key: string): Promise<string | null> {
  const [onlineRaw, devRaw] = await Promise.all([
    readChunkedFromProvider(key, readTextDbOnlineSingle),
    readChunkedFromProvider(key, readTextDbDevSingle),
  ]);
  return onlineRaw || devRaw || null;
}

function isValidCipherEnvelope(x: string | null | undefined): x is string {
  return Boolean(x && (x.startsWith('BC2:') || x.startsWith('BC1:')));
}

async function readAllPermanentCloudCandidates(key: string): Promise<string[]> {
  const [onlineRaw, devRaw] = await Promise.all([
    readChunkedFromProvider(key, readTextDbOnlineSingle),
    readChunkedFromProvider(key, readTextDbDevSingle),
  ]);
  return Array.from(new Set([onlineRaw, devRaw].filter(isValidCipherEnvelope)));
}

function sanitizeShardId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

function shardKeyFor(imgKeyPrefix: string, kind: PhotoKind, id: string): string {
  return `${imgKeyPrefix}_${kind}_${sanitizeShardId(id)}`;
}

interface PhotoJob {
  kind: PhotoKind;
  id: string;
  version: number;
  inlineThumb?: string;
}

function collectPhotoJobs(state: VaultState): PhotoJob[] {
  const jobs: PhotoJob[] = [];
  for (const s of state.personalSpots.slice(0, 30)) {
    if (s.coverThumb || s.hasCoverPhoto) {
      jobs.push({ kind: 'spot', id: s.id, version: s.updatedAt || s.createdAt, inlineThumb: s.coverThumb });
    }
  }
  for (const m of Object.values(state.marks)) {
    if (m.photoThumb || m.hasLocalHiResPhoto) {
      jobs.push({ kind: 'mark', id: m.spotId, version: m.updatedAt || m.createdAt, inlineThumb: m.photoThumb });
    }
  }
  for (const it of state.inbox.slice(0, 20)) {
    if (it.screenshotThumb || it.hasLocalHiResPhoto) {
      jobs.push({ kind: 'inbox', id: it.id, version: it.updatedAt || it.createdAt, inlineThumb: it.screenshotThumb });
    }
  }
  return jobs;
}

async function uploadPhotoShards(state: VaultState, imgKeyPrefix: string, passcode: string): Promise<void> {
  const jobs = collectPhotoJobs(state).slice(0, 40);
  const BATCH = 3;
  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(
      jobs.slice(i, i + BATCH).map(async (job) => {
        const shardKey = shardKeyFor(imgKeyPrefix, job.kind, job.id);
        const marker = await idbGet(IDB_KV_STORE, `uploaded:${shardKey}`);
        if (marker === String(job.version)) return;
        const hiRes = await getLocalPhoto(job.kind, job.id);
        const best = hiRes || job.inlineThumb;
        if (!best || !best.startsWith('data:image/')) return;
        const encrypted = await encryptVaultPayload(best, passcode);
        const ok = await writePermanentCloud(shardKey, encrypted);
        if (ok) await idbPut(IDB_KV_STORE, `uploaded:${shardKey}`, String(job.version));
      })
    );
  }
}

/**
 * 按需從雙雲端取回單張照片分片（例如開啟卡片詳情時），並快取至本機 IndexedDB。
 */
export async function hydrateSinglePhoto(
  kind: PhotoKind,
  id: string,
  passcode: string
): Promise<string | null> {
  const local = await getLocalPhoto(kind, id);
  if (local) return local;
  const clean = normalizePasscode(passcode);
  if (!clean) return null;
  try {
    const identity = await deriveVaultIdentity(clean);
    const raw = await readPermanentCloud(shardKeyFor(identity.imgKeyPrefix, kind, id));
    if (!isValidCipherEnvelope(raw)) return null;
    const dataUrl = await decryptVaultPayload(raw, clean);
    if (!dataUrl.startsWith('data:image/')) return null;
    await saveLocalPhoto(kind, id, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

async function hydratePhotoShards(state: VaultState, imgKeyPrefix: string, passcode: string): Promise<VaultState> {
  const jobs = collectPhotoJobs(state).slice(0, 30);
  const fetched = new Map<string, string>();
  const BATCH = 4;
  for (let i = 0; i < jobs.length; i += BATCH) {
    await Promise.all(
      jobs.slice(i, i + BATCH).map(async (job) => {
        if (job.inlineThumb) return;
        const local = await getLocalPhoto(job.kind, job.id);
        if (local) {
          fetched.set(photoKey(job.kind, job.id), local);
          return;
        }
        const raw = await readPermanentCloud(shardKeyFor(imgKeyPrefix, job.kind, job.id));
        if (!isValidCipherEnvelope(raw)) return;
        try {
          const dataUrl = await decryptVaultPayload(raw, passcode);
          if (dataUrl.startsWith('data:image/')) {
            await saveLocalPhoto(job.kind, job.id, dataUrl);
            fetched.set(photoKey(job.kind, job.id), dataUrl);
          }
        } catch {
          // Ignore shard mismatch
        }
      })
    );
  }
  if (fetched.size === 0) return state;
  const marks: Record<string, PersonalMark> = {};
  for (const [k, m] of Object.entries(state.marks)) {
    const t = fetched.get(photoKey('mark', m.spotId));
    marks[k] = t && !m.photoThumb ? { ...m, photoThumb: t } : m;
  }
  return {
    ...state,
    personalSpots: state.personalSpots.map((s) => {
      const t = fetched.get(photoKey('spot', s.id));
      return t && !s.coverThumb ? { ...s, coverThumb: t } : s;
    }),
    marks,
    inbox: state.inbox.map((it) => {
      const t = fetched.get(photoKey('inbox', it.id));
      return t && !it.screenshotThumb ? { ...it, screenshotThumb: t } : it;
    }),
  };
}

async function pingSseTopic(sseTopic: string, updatedAt: number): Promise<void> {
  try {
    await fetch(`${NTFY_BASE_URL}/${encodeURIComponent(sseTopic)}`, {
      method: 'POST',
      body: JSON.stringify({ t: updatedAt }),
      keepalive: true,
    });
  } catch {
    // Optional realtime relay only
  }
}

export interface SyncOutcome {
  ok: boolean;
  mergedState: VaultState;
  pulledFromCloud: boolean;
  pushedToCloud: boolean;
  matchedPasscode?: string;
  fingerprintBadge?: string;
  errorMessage?: string;
}

export async function syncWithCloudVault(
  localState: VaultState,
  passcode: string,
  forcePushIfEdited = false
): Promise<SyncOutcome> {
  const cleanPass = normalizePasscode(passcode);
  if (!cleanPass) {
    return {
      ok: false,
      mergedState: localState,
      pulledFromCloud: false,
      pushedToCloud: false,
      errorMessage: '尚未設定雲端通行碼',
    };
  }
  try {
    let activePass = cleanPass;
    let identity = await deriveVaultIdentity(activePass);
    let rawCandidates = await readAllPermanentCloudCandidates(identity.vaultKey);

    if (rawCandidates.length === 0) {
      for (const variant of getPasscodeFallbackVariants(cleanPass)) {
        if (variant === cleanPass) continue;
        const candId = await deriveVaultIdentity(variant);
        const candList = await readAllPermanentCloudCandidates(candId.vaultKey);
        if (candList.length > 0) {
          activePass = variant;
          identity = candId;
          rawCandidates = candList;
          break;
        }
      }
    }

    let merged = localState;
    let pulledFromCloud = false;
    let maxRemoteUpdatedAt = 0;
    for (const rawCloud of rawCandidates) {
      try {
        const decryptedJson = await decryptVaultPayload(rawCloud, activePass);
        const remoteState = parseVaultJson(decryptedJson);
        if (remoteState) {
          maxRemoteUpdatedAt = Math.max(maxRemoteUpdatedAt, remoteState.updatedAt || 0);
          merged = mergeVaultStates(merged, remoteState);
          pulledFromCloud = true;
        }
      } catch {
        // Ignore corrupted candidate if another succeeds
      }
    }
    if (rawCandidates.length > 0 && !pulledFromCloud) {
      throw new Error('通行碼不正確，無法解開既有雲端加密紀錄');
    }

    if (pulledFromCloud) {
      merged = await hydratePhotoShards(merged, identity.imgKeyPrefix, activePass);
    }

    const latestLocalSync = loadLocalVaultSync();
    merged = mergeVaultStates(latestLocalSync, merged);
    await saveLocalVaultState(merged);

    const shouldPush =
      !merged.isUneditedDefault &&
      merged.updatedAt > 0 &&
      (rawCandidates.length < 2 || merged.updatedAt > maxRemoteUpdatedAt || forcePushIfEdited);

    let pushedToCloud = false;
    if (shouldPush) {
      await uploadPhotoShards(merged, identity.imgKeyPrefix, activePass);
      const encrypted = await encryptVaultPayload(JSON.stringify(compactStateForCloud(merged)), activePass);
      pushedToCloud = await writePermanentCloud(identity.vaultKey, encrypted);
      if (!pushedToCloud) {
        return {
          ok: false,
          mergedState: merged,
          pulledFromCloud,
          pushedToCloud: false,
          matchedPasscode: activePass,
          fingerprintBadge: identity.fingerprintBadge,
          errorMessage: '雲端網路暫時忙碌，紀錄已安全保存在本機保險箱，將自動重試同步！',
        };
      }
      void pingSseTopic(identity.sseTopic, merged.updatedAt);
    }

    return {
      ok: true,
      mergedState: merged,
      pulledFromCloud,
      pushedToCloud,
      matchedPasscode: activePass,
      fingerprintBadge: identity.fingerprintBadge,
    };
  } catch (err) {
    return {
      ok: false,
      mergedState: localState,
      pulledFromCloud: false,
      pushedToCloud: false,
      errorMessage: err instanceof Error ? err.message : '雲端同步失敗，請稍後再試',
    };
  }
}

export function subscribeRealtimeRelay(passcode: string, onRemotePing: () => void): () => void {
  let es: EventSource | null = null;
  let cancelled = false;
  deriveVaultIdentity(passcode)
    .then(({ sseTopic }) => {
      if (cancelled || typeof EventSource === 'undefined') return;
      es = new EventSource(`${NTFY_BASE_URL}/${encodeURIComponent(sseTopic)}/sse`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.event === 'message') onRemotePing();
        } catch {
          // Ignore keepalive
        }
      };
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    if (es) {
      es.close();
      es = null;
    }
  };
}

export function exportBackupJson(state: VaultState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bobo-pocket-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
