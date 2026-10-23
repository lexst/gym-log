// Local-first document store kept in localStorage.
// Every doc carries updatedAt; sync.js pushes dirty docs and merges
// remote ones by last-write-wins on updatedAt.
import { useSyncExternalStore } from 'react';
import { seedDocs } from './seed.js';

const KEY = 'gymlog:v1';
const listeners = new Set();
let version = 0;
let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.docs) return { dirty: {}, lastPull: null, ...s };
  } catch {}
  return { docs: {}, dirty: {}, lastPull: null };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function emit(local = true) {
  version++;
  save();
  listeners.forEach((fn) => fn(local));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useStore() {
  return useSyncExternalStore(
    (fn) => subscribe(fn),
    () => version,
  );
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function all(kind) {
  return Object.values(state.docs[kind] || {}).filter((d) => !d.deleted);
}

export function get(kind, id) {
  const d = state.docs[kind]?.[id];
  return d && !d.deleted ? d : null;
}

function write(kind, doc, updatedAt) {
  const d = { ...doc, updatedAt };
  (state.docs[kind] ||= {})[d.id] = d;
  state.dirty[`${kind}/${d.id}`] = true;
  return d;
}

export function put(kind, doc) {
  const prev = state.docs[kind]?.[doc.id]?.updatedAt || 0;
  const d = write(kind, doc, Math.max(Date.now(), prev + 1));
  emit();
  return d;
}

export function remove(kind, id) {
  const d = state.docs[kind]?.[id];
  if (d) put(kind, { ...d, deleted: true });
}

// Seed docs get updatedAt = 1 so anything already synced wins over them.
export function ensureSeed() {
  if (state.seeded) return;
  for (const [kind, docs] of Object.entries(seedDocs())) {
    for (const doc of docs) if (!state.docs[kind]?.[doc.id]) write(kind, doc, 1);
  }
  state.seeded = true;
  emit();
}

// --- sync helpers -------------------------------------------------------

export function dirtyDocs() {
  return Object.keys(state.dirty).map((key) => {
    const [kind, id] = key.split('/');
    return { kind, id, doc: state.docs[kind]?.[id] };
  }).filter((x) => x.doc);
}

export function markClean(pushed) {
  for (const { kind, id, doc } of pushed) {
    if (state.docs[kind]?.[id]?.updatedAt === doc.updatedAt) delete state.dirty[`${kind}/${id}`];
  }
  save();
}

export function applyRemote(rows) {
  let changed = false;
  for (const { kind, id, data } of rows) {
    const local = state.docs[kind]?.[id];
    if (!local || (data.updatedAt || 0) > (local.updatedAt || 0)) {
      (state.docs[kind] ||= {})[id] = data;
      delete state.dirty[`${kind}/${id}`];
      changed = true;
    }
  }
  if (changed) emit(false);
}

export function getLastPull() {
  return state.lastPull;
}

export function setLastPull(ts) {
  state.lastPull = ts;
  save();
}

// Forget the pull cursor so the next sync re-reads everything,
// and mark all local docs dirty so they get uploaded (first login).
export function resetSyncFor(userId) {
  if (state.syncUser === userId) return;
  state.syncUser = userId;
  state.lastPull = null;
  for (const [kind, docs] of Object.entries(state.docs)) {
    for (const id of Object.keys(docs)) state.dirty[`${kind}/${id}`] = true;
  }
  save();
}

// --- backup -------------------------------------------------------------

export function exportJson() {
  return JSON.stringify({ app: 'gym-log', version: 1, exportedAt: new Date().toISOString(), docs: state.docs }, null, 2);
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (!data.docs) throw new Error('Ungültige Datei');
  const rows = [];
  for (const [kind, docs] of Object.entries(data.docs)) {
    for (const doc of Object.values(docs)) rows.push({ kind, id: doc.id, data: doc });
  }
  applyRemote(rows);
  for (const r of rows) state.dirty[`${r.kind}/${r.id}`] = true;
  save();
  return rows.length;
}
