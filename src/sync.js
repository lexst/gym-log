import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import * as store from './store.js';

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const statusListeners = new Set();
export let status = { state: supabase ? 'idle' : 'off', at: null, error: null };

function setStatus(s) {
  status = { ...status, ...s };
  statusListeners.forEach((fn) => fn(status));
}

export function onStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

let running = null;
let again = false;

export function syncNow() {
  if (!supabase) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = run()
    .catch((e) => setStatus({ state: 'error', error: e.message || String(e) }))
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        syncNow();
      }
    });
  return running;
}

async function run() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return setStatus({ state: 'signed-out' });
  if (!navigator.onLine) return setStatus({ state: 'offline' });
  setStatus({ state: 'syncing', error: null });
  store.resetSyncFor(user.id);

  const dirty = store.dirtyDocs();
  for (let i = 0; i < dirty.length; i += 200) {
    const chunk = dirty.slice(i, i + 200);
    const rows = chunk.map(({ kind, id, doc }) => ({
      user_id: user.id,
      kind,
      id,
      data: doc,
      updated_at: doc.updatedAt,
      deleted: !!doc.deleted,
    }));
    const { error } = await supabase.from('docs').upsert(rows, { onConflict: 'user_id,kind,id' });
    if (error) throw error;
    store.markClean(chunk);
  }

  let since = store.getLastPull() || '1970-01-01T00:00:00Z';
  for (;;) {
    const { data: rows, error } = await supabase
      .from('docs')
      .select('kind,id,data,synced_at')
      .gte('synced_at', since)
      .order('synced_at')
      .limit(1000);
    if (error) throw error;
    store.applyRemote(rows);
    if (rows.length) since = rows[rows.length - 1].synced_at;
    if (rows.length < 1000) break;
  }
  store.setLastPull(since);
  setStatus({ state: 'ok', at: new Date() });
}

// Sync shortly after local edits, on focus and when coming back online.
let timer = null;
export function startAutoSync() {
  if (!supabase) return;
  store.subscribe((local) => {
    if (!local) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, 1500);
  });
  window.addEventListener('online', syncNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') syncNow();
    if (event === 'SIGNED_OUT') setStatus({ state: 'signed-out' });
  });
  syncNow();
}
