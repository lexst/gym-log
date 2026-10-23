import { useEffect, useRef, useState } from 'react';
import * as store from './store.js';
import { useStore, uid } from './store.js';
import * as L from './logic.js';
import { supabase, syncNow, onStatus, status as initialStatus } from './sync.js';
import { GROUP_ORDER } from './catalog.js';

// --- data helpers -----------------------------------------------------------

const days = () => store.all('day').sort((a, b) => (a.order || 0) - (b.order || 0));
const exercises = () => store.all('exercise').sort((a, b) => a.name.localeCompare(b.name));
const workouts = () => store.all('workout');
const exName = (id) => store.get('exercise', id)?.name || 'Übung';
const exGroup = (id) => store.get('exercise', id)?.group || '';
const dayName = (id) => store.get('day', id)?.name || '';
const activeWorkout = () => workouts().find((w) => !w.finished);
const NO_GROUP = 'Ohne Gruppe';
const groupOf = (e) => e.group?.trim() || NO_GROUP;
const groupRank = (g) => (g === NO_GROUP ? 1e9 : GROUP_ORDER.indexOf(g) === -1 ? 1e6 : GROUP_ORDER.indexOf(g));
const groups = () => [...new Set(exercises().map(groupOf))].sort((a, b) => groupRank(a) - groupRank(b) || a.localeCompare(b));

// [[group, items]] in group order; key(item) gives the exercise.
function byGroup(items, key = (x) => x) {
  const map = new Map();
  for (const it of items) {
    const g = groupOf(key(it));
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(it);
  }
  return groups().filter((g) => map.has(g)).map((g) => [g, map.get(g)]);
}

const RESULT = { up: ['↑', 'up'], same: ['=', 'same'], down: ['↓', 'down'], new: ['•', 'new'] };
const RESULT_TITLE = { up: 'Fortschritt', same: 'Wie letztes Mal', down: 'Schlechter', new: 'Erstes Mal' };

function agoText(iso) {
  const n = L.daysAgo(iso);
  return n === 0 ? 'heute' : n === 1 ? 'gestern' : `vor ${n} Tagen`;
}

function targetText(t) {
  if (!t.repMin) return `${t.sets} Sätze`;
  return `${t.sets}×${t.repMin}${t.repMax && t.repMax !== t.repMin ? '–' + t.repMax : ''}`;
}

// What the next session of a planned exercise starts with.
function plannedStart(it, ws) {
  const prev = L.previous(ws, it.exId, { date: '9999-12-31' });
  const sug = L.suggest(it, prev?.entry, it.step);
  return { prev, weight: sug?.weight ?? null, up: !!sug?.up };
}

function startWorkout(day) {
  const ws = workouts();
  const entries = day.items.map((it) => {
    const { weight } = plannedStart(it, ws);
    return {
      exId: it.exId,
      unilateral: !!store.get('exercise', it.exId)?.unilateral,
      sets: it.sets,
      repMin: it.repMin,
      repMax: it.repMax,
      step: it.step,
      weight,
      reps: Array(it.sets).fill(null),
      warmup: it.warmup ? { weight: L.warmupWeight(weight), reps: null, done: false } : null,
      note: '',
    };
  });
  return store.put('workout', { id: uid(), dayId: day.id, date: L.todayIso(), entries, note: '', finished: false, startedAt: Date.now() });
}

// --- small inputs -------------------------------------------------------------

function NumField({ value, onChange, placeholder, className = '', ariaLabel }) {
  const [draft, setDraft] = useState(value === null || value === undefined ? '' : L.fmtNum(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value === null || value === undefined ? '' : L.fmtNum(value));
  }, [value]);
  return (
    <input
      className={'num ' + className}
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={draft}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focused.current = false;
        setDraft(value === null || value === undefined ? '' : L.fmtNum(value));
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = L.parseNum(e.target.value);
        if (e.target.value === '' || n !== null) onChange(n);
      }}
    />
  );
}

function Stepper({ value, onChange, step = 2.5, placeholder, ariaLabel }) {
  const bump = (d) => onChange(Math.max(0, Math.round(((value || 0) + d) * 100) / 100));
  return (
    <div className="stepper">
      <button type="button" onClick={() => bump(-step)} aria-label="Weniger">−</button>
      <NumField value={value} onChange={onChange} placeholder={placeholder} ariaLabel={ariaLabel} />
      <button type="button" onClick={() => bump(step)} aria-label="Mehr">+</button>
    </div>
  );
}

function Header({ title, onBack, right }) {
  return (
    <header className="top">
      {onBack ? (
        <button className="back" onClick={onBack} aria-label="Zurück">‹</button>
      ) : (
        <span className="back-space" />
      )}
      <h1>{title}</h1>
      <div className="top-right">{right}</div>
    </header>
  );
}

// soft: a workout after a break or illness shows declines in grey, not red.
function ResultBadge({ r, pr, top, soft }) {
  if (!r) return null;
  const [sym, cls] = RESULT[r];
  return (
    <span className="badges">
      {top && (
        <span className="res top" title="Oberes Ende in allen Sätzen erreicht">
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      )}
      <span className={'res ' + cls + (soft && r === 'down' ? ' soft' : '')} title={RESULT_TITLE[r]}>{sym}</span>
      {pr && <span className="pr" title="Persönlicher Rekord">PR</span>}
    </span>
  );
}

// --- home ---------------------------------------------------------------------

function Home({ go }) {
  const ds = days();
  const ws = workouts();
  const active = activeWorkout();
  const nextId = L.nextDayId(ds.filter((d) => d.items.length), ws);

  return (
    <>
      <Header title="Training" />
      <main className="pad">
        {active && (
          <button className="card active-card" onClick={() => go('workout', { id: active.id })}>
            <div className="muted small">Training läuft</div>
            <div className="big">{dayName(active.dayId)} · {L.fmtDate(active.date)}</div>
            <div className="small">Weiter ›</div>
          </button>
        )}
        <h2>Trainingstage</h2>
        {ds.map((d) => {
          const last = ws.filter((w) => w.finished && w.dayId === d.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
          return (
            <button
              key={d.id}
              className={'card day-card' + (d.id === nextId && !active ? ' next' : '')}
              onClick={() => go('preview', { dayId: d.id })}
            >
              <div className="row between">
                <div className="big">{d.name}</div>
                {d.id === nextId && !active && <span className="chip">als Nächstes</span>}
              </div>
              <div className="muted small">
                {d.items.length ? `${d.items.length} Übungen · ` : 'Keine Übungen · '}
                {last ? `zuletzt ${L.fmtDate(last.date)} (${agoText(last.date)})` : 'noch nie'}
              </div>
            </button>
          );
        })}
      </main>
    </>
  );
}

// --- day preview --------------------------------------------------------------

function DayPreview({ dayId, back, go, replace }) {
  const d = store.get('day', dayId);
  if (!d) return <><Header title="Tag" onBack={back} /></>;
  const ws = workouts();
  const active = activeWorkout();
  const start = () => replace('workout', { id: startWorkout(d).id });

  return (
    <>
      <Header title={d.name} onBack={back} />
      <main className="pad">
        {!d.items.length && <p className="muted center">Noch keine Übungen für diesen Tag.</p>}
        {d.items.map((it, i) => {
          const { prev, weight, up } = plannedStart(it, ws);
          return (
            <section className="card preview" key={i}>
              <div className="muted small">{exGroup(it.exId)}</div>
              <div className="row between">
                <div className="big">{exName(it.exId)}</div>
                <span className="chip">{targetText(it)}</span>
              </div>
              <div className="small muted">
                {prev
                  ? `Letztes Mal ${L.fmtDate(prev.date, false)}: ${L.fmtNum(prev.entry.weight)} kg × ${L.doneReps(prev.entry).join('/')}`
                  : 'Erstes Mal'}
              </div>
              {weight != null && (
                <div className={'small ' + (up ? 'good' : '')}>
                  Heute: {L.fmtNum(weight)} kg{up ? ' ↑' : ''}
                  {it.warmup ? ` · Aufwärmen ${L.fmtNum(L.warmupWeight(weight))} kg` : ''}
                </div>
              )}
            </section>
          );
        })}
        <button className="link center-block" onClick={() => go('day', { dayId: d.id })}>Plan bearbeiten</button>
        <div className="cta">
          {active ? (
            <>
              <p className="muted small center">Beende zuerst das laufende Training ({dayName(active.dayId)}).</p>
              <button className="btn primary" onClick={() => replace('workout', { id: active.id })}>
                Laufendes Training öffnen
              </button>
            </>
          ) : (
            <button className="btn primary" disabled={!d.items.length} onClick={start}>
              Training starten
            </button>
          )}
        </div>
      </main>
    </>
  );
}

// --- workout ------------------------------------------------------------------

function EntryCard({ w, entry, index, update, removeEntry, ws }) {
  const prev = L.previous(ws, entry.exId, w)?.entry;
  const sug = L.suggest(entry, prev, entry.step);
  // Judge the result only once every set is logged, not halfway through.
  const r = w.finished || entry.reps.every((x) => x != null) ? L.compare(entry, prev) : null;
  const pr = w.finished && L.isPr(ws, entry, w);
  const set = (patch) => update(index, { ...entry, ...patch });
  const setRep = (i, v) => {
    const reps = [...entry.reps];
    reps[i] = v;
    set({ reps });
  };
  const sides = entry.side || { L: [...entry.reps], R: [...entry.reps] };
  const setSide = (i, k, v) => {
    const side = { L: [...sides.L], R: [...sides.R] };
    side[k][i] = v;
    const reps = [...entry.reps];
    reps[i] = L.combineSides(side.L[i], side.R[i]);
    set({ side, reps });
  };
  const resize = (n) => {
    const fit = (a) => Array.from({ length: n }, (_, i) => a[i] ?? null);
    set({ reps: fit(entry.reps), ...(entry.side ? { side: { L: fit(entry.side.L), R: fit(entry.side.R) } } : {}) });
  };
  const toggleSides = () => {
    const on = !entry.unilateral;
    const ex = store.get('exercise', entry.exId);
    if (ex) store.put('exercise', { ...ex, unilateral: on });
    set({ unilateral: on, side: on ? { L: [...entry.reps], R: [...entry.reps] } : null });
  };
  const perSide = (e) => (e?.unilateral ? ' je Seite' : '');
  const target = entry.repMin ? targetText(entry) : `${entry.reps.length} Sätze`;

  return (
    <section className="card entry">
      <div className="row between">
        <div>
          <div className="muted small">{exGroup(entry.exId)}</div>
          <div className="big">{exName(entry.exId)}</div>
        </div>
        <ResultBadge r={r} pr={pr} top={r && L.topReached(entry)} soft={w.pause} />
      </div>
      <div className="meta small">
        <span className="chip">{target}</span>
        {prev ? (
          <span className="muted">
            Letztes Mal: {L.fmtNum(prev.weight)} kg{perSide(prev)} × {L.doneReps(prev).join('/')}
          </span>
        ) : (
          <span className="muted">Erstes Mal</span>
        )}
      </div>
      {sug?.up && entry.weight !== sug.weight && !w.finished && (
        <button className="hint" onClick={() => set({ weight: sug.weight })}>
          Letztes Mal oberes Ende erreicht – {L.fmtNum(sug.weight)} kg versuchen?
        </button>
      )}
      {sug?.up && entry.weight === sug.weight && !L.hasData(entry) && (
        <div className="hint ok">↑ Gewicht erhöht: letztes Mal oberes Ende erreicht</div>
      )}

      <div className="field">
        <label>{entry.unilateral ? 'Gewicht je Seite, kg' : 'Gewicht, kg'}</label>
        <Stepper value={entry.weight} step={entry.step || 2.5} onChange={(v) => set({ weight: v })} ariaLabel="Arbeitsgewicht" />
      </div>

      {entry.warmup && (
        <div className="set-row warm">
          <span className="set-label">Aufwärmen</span>
          <NumField className="w-sm" value={entry.warmup.weight} onChange={(v) => set({ warmup: { ...entry.warmup, weight: v } })} ariaLabel="Aufwärmgewicht" />
          <span className="muted small">kg ×</span>
          <NumField className="w-sm" value={entry.warmup.reps} placeholder="—" onChange={(v) => set({ warmup: { ...entry.warmup, reps: v } })} ariaLabel="Aufwärm-Wiederholungen" />
          <button
            className={'tick' + (entry.warmup.done ? ' on' : '')}
            onClick={() => set({ warmup: { ...entry.warmup, done: !entry.warmup.done } })}
            aria-label="Aufwärmen erledigt"
          >
            ✓
          </button>
        </div>
      )}

      {entry.reps.map((rep, i) => (
        <div className="set-row" key={i}>
          <span className="set-label">Satz {i + 1}</span>
          {entry.unilateral ? (
            ['L', 'R'].map((k) => (
              <span className="side" key={k}>
                <span className="muted small">{k}</span>
                <NumField
                  className="w-sm"
                  value={sides[k][i]}
                  placeholder={(prev?.side?.[k]?.[i] ?? prev?.reps?.[i]) != null ? String(prev?.side?.[k]?.[i] ?? prev.reps[i]) : '—'}
                  onChange={(v) => setSide(i, k, v)}
                  ariaLabel={`Wiederholungen ${k === 'L' ? 'links' : 'rechts'}, Satz ${i + 1}`}
                />
              </span>
            ))
          ) : (
            <>
              <NumField
                className="w-md"
                value={rep}
                placeholder={prev?.reps?.[i] != null ? String(prev.reps[i]) : '—'}
                onChange={(v) => setRep(i, v)}
                ariaLabel={`Wiederholungen, Satz ${i + 1}`}
              />
              <span className="muted small">Wdh.</span>
            </>
          )}
          {rep != null && entry.repMax && (
            <span className={'small ' + (rep >= entry.repMax ? 'good' : rep < entry.repMin && !w.pause ? 'bad' : 'muted')}>
              {rep >= entry.repMax ? 'oben' : rep < entry.repMin ? 'zu wenig' : ''}
            </span>
          )}
        </div>
      ))}
      <div className="row gap">
        <button className="link small" onClick={() => resize(entry.reps.length + 1)}>+ Satz</button>
        {entry.reps.length > 1 && (
          <button className="link small" onClick={() => resize(entry.reps.length - 1)}>− Satz</button>
        )}
        <button className="link small" onClick={toggleSides}>{entry.unilateral ? 'beidseitig' : 'links/rechts'}</button>
        {!entry.warmup && (
          <button className="link small" onClick={() => set({ warmup: { weight: L.warmupWeight(entry.weight), reps: null, done: false } })}>
            + Aufwärmen
          </button>
        )}
        {entry.extra && (
          <button className="link small danger" onClick={() => removeEntry(index)}>entfernen</button>
        )}
      </div>
      <textarea
        className="note"
        rows={1}
        placeholder="Notiz"
        value={entry.note || ''}
        onChange={(e) => set({ note: e.target.value })}
      />
    </section>
  );
}

// Pick an exercise: first a muscle group, then the exercise; search covers all.
function AddExercise({ onAdd, onClose }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState(null);
  const query = q.trim().toLowerCase();
  const list = exercises().filter(
    (e) => (!group || groupOf(e) === group) && (!query || (e.name + ' ' + e.group).toLowerCase().includes(query)),
  );
  const create = () => {
    const e = store.put('exercise', { id: uid(), name: q.trim(), group: group && group !== NO_GROUP ? group : '' });
    onAdd(e.id);
  };
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2>Übung hinzufügen</h2>
          <button className="link" onClick={onClose}>Schließen</button>
        </div>
        <input className="text" placeholder="Suchen oder neuer Name" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          <button className={'chip-btn' + (!group ? ' on' : '')} onClick={() => setGroup(null)}>Alle</button>
          {groups().map((g) => (
            <button key={g} className={'chip-btn' + (group === g ? ' on' : '')} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>
        <div className="list">
          {byGroup(list).map(([g, items]) => (
            <div key={g}>
              {!group && <div className="list-head">{g}</div>}
              {items.map((e) => (
                <button key={e.id} className="list-item" onClick={() => onAdd(e.id)}>{e.name}</button>
              ))}
            </div>
          ))}
          {!list.length && !q.trim() && <p className="muted small">Keine Übungen in dieser Gruppe.</p>}
          {q.trim() && !exercises().some((e) => e.name.toLowerCase() === query) && (
            <button className="list-item" onClick={create}>
              + Neu: „{q.trim()}“{group && group !== NO_GROUP ? ` in ${group}` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Workout({ id, back }) {
  const w = store.get('workout', id);
  const [adding, setAdding] = useState(false);
  if (!w) return <><Header title="Training" onBack={back} /><main className="pad muted">Training gelöscht.</main></>;
  const ws = workouts();
  const save = (patch) => store.put('workout', { ...w, ...patch });
  const update = (i, entry) => {
    const entries = [...w.entries];
    entries[i] = entry;
    save({ entries });
  };
  const removeEntry = (i) => save({ entries: w.entries.filter((_, j) => j !== i) });
  const addEntry = (exId) => {
    const prev = L.previous(ws, exId, w)?.entry;
    save({
      entries: [
        ...w.entries,
        {
          exId,
          extra: true,
          unilateral: !!store.get('exercise', exId)?.unilateral,
          sets: prev?.reps?.length || 1,
          repMin: prev?.repMin || null,
          repMax: prev?.repMax || null,
          step: prev?.step || 2.5,
          weight: prev?.weight ?? null,
          reps: Array(prev?.reps?.length || 1).fill(null),
          warmup: null,
          note: '',
        },
      ],
    });
    setAdding(false);
  };
  const finish = () => {
    save({ finished: true, finishedAt: Date.now() });
    back();
  };
  const del = () => {
    if (confirm('Dieses Training löschen?')) {
      store.remove('workout', w.id);
      back();
    }
  };
  const doneCount = w.entries.filter(L.hasData).length;

  return (
    <>
      <Header
        title={`${dayName(w.dayId)}`}
        onBack={back}
        right={<input type="date" className="date" value={w.date} onChange={(e) => e.target.value && save({ date: e.target.value })} />}
      />
      <main className="pad">
        {w.entries.map((e, i) => (
          <EntryCard key={i} w={w} entry={e} index={i} update={update} removeEntry={removeEntry} ws={ws} />
        ))}
        <button className="btn ghost" onClick={() => setAdding(true)}>+ Übung</button>
        <textarea className="note big-note" rows={2} placeholder="Notiz zum Training" value={w.note || ''} onChange={(e) => save({ note: e.target.value })} />
        <label className="check pause">
          <input type="checkbox" checked={!!w.pause} onChange={(e) => save({ pause: e.target.checked })} />
          <span>
            Nach Pause oder Krankheit
            <span className="muted small"> – Rückgänge grau statt rot</span>
          </span>
        </label>
        {!w.finished ? (
          <button className="btn primary" onClick={finish}>
            Training beenden ({doneCount}/{w.entries.length})
          </button>
        ) : (
          <button className="btn" onClick={() => save({ finished: false })}>Wieder öffnen</button>
        )}
        <button className="link danger center-block" onClick={del}>Training löschen</button>
      </main>
      {adding && <AddExercise onAdd={addEntry} onClose={() => setAdding(false)} />}
    </>
  );
}

// --- history ------------------------------------------------------------------

function HistoryView({ go }) {
  const all = workouts();
  const ws = all.filter((w) => w.finished).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return (
    <>
      <Header title="Verlauf" />
      <main className="pad">
        {!ws.length && <p className="muted center">Noch keine abgeschlossenen Trainings.</p>}
        {ws.map((w) => (
          <button key={w.id} className="card hist" onClick={() => go('workout', { id: w.id })}>
            <div className="row between">
              <div className="big">{dayName(w.dayId)} · {L.fmtDate(w.date)}</div>
              {w.pause && <span className="chip">nach Pause</span>}
            </div>
            {w.entries.filter(L.hasData).map((e, i) => {
              const prev = L.previous(all, e.exId, w)?.entry;
              return (
                <div key={i} className="hist-line small">
                  <span className="hist-name">{exName(e.exId)}</span>
                  <span className="muted">{L.fmtNum(e.weight)}×{L.doneReps(e).join('/')}</span>
                  <ResultBadge r={L.compare(e, prev)} pr={L.isPr(all, e, w)} top={L.topReached(e)} soft={w.pause} />
                </div>
              );
            })}
            {w.note && <div className="muted small hist-note">{w.note}</div>}
          </button>
        ))}
      </main>
    </>
  );
}

// --- progress -----------------------------------------------------------------

function Chart({ points }) {
  // points: [{x: label, y1: weight, y2: e1rm}]
  if (points.length < 2) return <p className="muted small">Das Diagramm erscheint nach zwei Trainings.</p>;
  const W = 340, H = 180, P = { l: 34, r: 10, t: 12, b: 24 };
  const ys = points.flatMap((p) => [p.y1, p.y2]);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max(1, (hi - lo) * 0.1);
  lo = Math.max(0, lo - pad);
  hi = hi + pad;
  const x = (i) => P.l + (i * (W - P.l - P.r)) / (points.length - 1);
  const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = (k) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  const ticks = [lo, (lo + hi) / 2, hi];
  const labelEvery = Math.ceil(points.length / 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Fortschrittsdiagramm">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={P.l - 6} y={y(t) + 4} className="axis" textAnchor="end">{Math.round(t)}</text>
        </g>
      ))}
      {points.map((p, i) =>
        i % labelEvery === 0 || i === points.length - 1 ? (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{p.x}</text>
        ) : null,
      )}
      <path d={line('y2')} className="l2" />
      <path d={line('y1')} className="l1" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.y1)} r="3.5" className="d1" />
      ))}
    </svg>
  );
}

function ProgressList({ go }) {
  const ws = workouts();
  const list = exercises()
    .map((e) => ({ e, h: L.history(ws, e.id) }))
    .filter((x) => x.h.length);
  return (
    <>
      <Header title="Fortschritt" />
      <main className="pad">
        {!list.length && <p className="muted center">Daten erscheinen nach dem ersten Training.</p>}
        {byGroup(list, (x) => x.e).map(([g, items]) => (
          <div key={g}>
            <h2>{g}</h2>
            {items.map(({ e, h }) => {
              const last = h[h.length - 1];
              const diff = last.entry.weight - h[0].entry.weight;
              return (
                <button key={e.id} className="card list-card" onClick={() => go('exercise', { exId: e.id })}>
                  <div className="row between">
                    <div className="big">{e.name}</div>
                    <div className="right">
                      <div className="big">{L.fmtNum(last.entry.weight)} kg</div>
                      <div className={'small ' + (diff > 0 ? 'good' : 'muted')}>
                        {h.length > 1 ? (diff > 0 ? '+' : '') + L.fmtNum(diff) + ' kg' : 'neu'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </main>
    </>
  );
}

function ExerciseProgress({ exId, back, go }) {
  const ws = workouts();
  const h = L.history(ws, exId);
  const best = h.reduce((b, x) => (L.bestE1rm(x.entry) > (b ? L.bestE1rm(b.entry) : 0) ? x : b), null);
  const maxW = h.reduce((b, x) => (!b || x.entry.weight > b.entry.weight ? x : b), null);
  const points = h.map((x) => ({ x: L.fmtDate(x.date, false), y1: x.entry.weight, y2: Math.round(L.bestE1rm(x.entry) * 10) / 10 }));
  return (
    <>
      <Header title={exName(exId)} onBack={back} />
      <main className="pad">
        <div className="stats">
          <div className="stat">
            <div className="muted small">Max. Gewicht</div>
            <div className="big">{maxW ? L.fmtNum(maxW.entry.weight) : '—'} kg</div>
            <div className="muted small">{maxW ? L.fmtDate(maxW.date) : ''}</div>
          </div>
          <div className="stat">
            <div className="muted small">Rekord (≈1RM)</div>
            <div className="big">{best ? L.fmtNum(Math.round(L.bestE1rm(best.entry) * 10) / 10) : '—'} kg</div>
            <div className="muted small">{best ? `${L.fmtNum(best.entry.weight)}×${Math.max(...L.doneReps(best.entry))}` : ''}</div>
          </div>
          <div className="stat">
            <div className="muted small">Trainings</div>
            <div className="big">{h.length}</div>
          </div>
        </div>
        <div className="card">
          <Chart points={points} />
          <div className="legend small">
            <span><i className="sw s1" />Arbeitsgewicht</span>
            <span><i className="sw s2" />≈1RM</span>
          </div>
        </div>
        <h2>Alle Trainings</h2>
        {[...h].reverse().map((x, i, arr) => {
          const prev = arr[i + 1]?.entry;
          return (
            <button key={x.workoutId} className="card hist" onClick={() => go('workout', { id: x.workoutId })}>
              <div className="hist-line">
                <span className="hist-name">{L.fmtDate(x.date)}</span>
                <span>{L.fmtNum(x.entry.weight)} kg × {L.doneReps(x.entry).join('/')}</span>
                <ResultBadge r={L.compare(x.entry, prev)} top={L.topReached(x.entry)} soft={store.get('workout', x.workoutId)?.pause} />
              </div>
              {x.entry.note && <div className="muted small hist-note">{x.entry.note}</div>}
            </button>
          );
        })}
      </main>
    </>
  );
}

// --- program ------------------------------------------------------------------

function ProgramView({ go }) {
  const ds = days();
  const addDay = () => {
    const d = store.put('day', { id: uid(), name: `Tag ${ds.length + 1}`, order: (ds.at(-1)?.order || 0) + 1, items: [] });
    go('day', { dayId: d.id });
  };
  return (
    <>
      <Header title="Plan" />
      <main className="pad">
        {ds.map((d) => (
          <button key={d.id} className="card list-card" onClick={() => go('day', { dayId: d.id })}>
            <div className="big">{d.name}</div>
            <div className="muted small">{d.items.map((it) => exName(it.exId)).join(' · ') || 'Leer'}</div>
          </button>
        ))}
        <button className="btn ghost" onClick={addDay}>+ Tag</button>
        <button className="btn ghost" onClick={() => go('exercises')}>Übungen nach Muskelgruppen</button>
      </main>
    </>
  );
}

function DayEditor({ dayId, back }) {
  const d = store.get('day', dayId);
  const [adding, setAdding] = useState(false);
  if (!d) return <><Header title="Tag" onBack={back} /></>;
  const save = (patch) => store.put('day', { ...d, ...patch });
  const setItem = (i, patch) => save({ items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const move = (i, dir) => {
    const items = [...d.items];
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    save({ items });
  };
  return (
    <>
      <Header title={d.name} onBack={back} />
      <main className="pad">
        <div className="field">
          <label>Name des Tages</label>
          <input className="text" value={d.name} onChange={(e) => save({ name: e.target.value })} />
        </div>
        {d.items.map((it, i) => (
          <section className="card" key={i}>
            <div className="row between">
              <div>
                <div className="muted small">{exGroup(it.exId)}</div>
                <div className="big">{exName(it.exId)}</div>
              </div>
              <div className="row">
                <button className="icon" onClick={() => move(i, -1)} aria-label="Nach oben">↑</button>
                <button className="icon" onClick={() => move(i, 1)} aria-label="Nach unten">↓</button>
              </div>
            </div>
            <div className="grid4">
              <div className="field">
                <label>Sätze</label>
                <NumField value={it.sets} onChange={(v) => v && setItem(i, { sets: v })} />
              </div>
              <div className="field">
                <label>Wdh. von</label>
                <NumField value={it.repMin} onChange={(v) => setItem(i, { repMin: v })} />
              </div>
              <div className="field">
                <label>bis</label>
                <NumField value={it.repMax} onChange={(v) => setItem(i, { repMax: v })} />
              </div>
              <div className="field">
                <label>Schritt, kg</label>
                <NumField value={it.step} onChange={(v) => setItem(i, { step: v })} />
              </div>
            </div>
            <div className="row between">
              <label className="check">
                <input type="checkbox" checked={!!it.warmup} onChange={(e) => setItem(i, { warmup: e.target.checked })} /> Aufwärmsatz
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!store.get('exercise', it.exId)?.unilateral}
                  onChange={(e) => {
                    const ex = store.get('exercise', it.exId);
                    if (ex) store.put('exercise', { ...ex, unilateral: e.target.checked });
                  }}
                />{' '}
                Links/rechts
              </label>
              <button className="link small danger" onClick={() => save({ items: d.items.filter((_, j) => j !== i) })}>Entfernen</button>
            </div>
          </section>
        ))}
        <button className="btn ghost" onClick={() => setAdding(true)}>+ Übung</button>
        <button
          className="link danger center-block"
          onClick={() => {
            if (confirm(`„${d.name}“ aus dem Plan löschen? Der Trainingsverlauf bleibt erhalten.`)) {
              store.remove('day', d.id);
              back();
            }
          }}
        >
          Tag löschen
        </button>
      </main>
      {adding && (
        <AddExercise
          onClose={() => setAdding(false)}
          onAdd={(exId) => {
            save({ items: [...d.items, { exId, sets: 2, repMin: 8, repMax: 10, warmup: true, step: 2.5 }] });
            setAdding(false);
          }}
        />
      )}
    </>
  );
}

function ExercisesEditor({ back }) {
  useStore();
  const gs = groups().filter((g) => g !== NO_GROUP);
  return (
    <>
      <Header title="Übungen" onBack={back} />
      <main className="pad">
        <datalist id="groups">
          {gs.map((g) => <option key={g} value={g} />)}
        </datalist>
        {byGroup(exercises()).map(([g, items]) => (
          <div key={g}>
            <h2>{g}</h2>
            {items.map((e) => (
              <section className="card" key={e.id}>
                <div className="field">
                  <label>Name</label>
                  <input className="text" value={e.name} onChange={(ev) => store.put('exercise', { ...e, name: ev.target.value })} />
                </div>
                <div className="field">
                  <label>Muskelgruppe</label>
                  <input className="text" list="groups" value={e.group} onChange={(ev) => store.put('exercise', { ...e, group: ev.target.value })} />
                </div>
                <label className="check">
                  <input type="checkbox" checked={!!e.unilateral} onChange={(ev) => store.put('exercise', { ...e, unilateral: ev.target.checked })} /> Links und rechts getrennt
                </label>
              </section>
            ))}
          </div>
        ))}
        <button className="btn ghost" onClick={() => store.put('exercise', { id: uid(), name: 'Neue Übung', group: '' })}>
          + Übung
        </button>
      </main>
    </>
  );
}

// --- settings -----------------------------------------------------------------

function useSyncStatus() {
  const [s, setS] = useState(initialStatus);
  useEffect(() => onStatus(setS), []);
  return s;
}

function SyncBox() {
  const s = useSyncStatus();
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) return <p className="muted small">Synchronisierung ist nicht eingerichtet: Die Daten liegen nur auf diesem Gerät.</p>;

  if (!session) {
    const signIn = async () => {
      setMsg('');
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setMsg(error.message);
    };
    const signUp = async () => {
      setMsg('');
      const { error, data } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg('Bitte bestätige deine E-Mail und melde dich dann an.');
    };
    return (
      <div>
        <p className="muted small">Melde dich an, damit deine Trainings zwischen Handy und Computer synchronisiert werden.</p>
        <input className="text" type="email" autoComplete="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="text" type="password" autoComplete="current-password" placeholder="Passwort" value={pw} onChange={(e) => setPw(e.target.value)} />
        <div className="row gap">
          <button className="btn primary" onClick={signIn}>Anmelden</button>
          <button className="btn" onClick={signUp}>Registrieren</button>
        </div>
        {msg && <p className="small bad">{msg}</p>}
      </div>
    );
  }

  const label = {
    idle: 'Wartet',
    syncing: 'Synchronisiere…',
    ok: `Synchronisiert${s.at ? ' um ' + s.at.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}`,
    offline: 'Offline: wird synchronisiert, sobald Internet da ist',
    error: 'Fehler: ' + s.error,
    'signed-out': 'Nicht angemeldet',
  }[s.state];
  return (
    <div>
      <p className="small">{session.user.email}</p>
      <p className={'small ' + (s.state === 'error' ? 'bad' : 'muted')}>{label}</p>
      <div className="row gap">
        <button className="btn" onClick={syncNow}>Jetzt synchronisieren</button>
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Abmelden</button>
      </div>
    </div>
  );
}

function Settings() {
  const fileRef = useRef();
  const [msg, setMsg] = useState('');
  const download = () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gym-log-${L.todayIso()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const upload = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const n = store.importJson(await f.text());
      setMsg(`Einträge geladen: ${n}`);
    } catch (err) {
      setMsg('Datei konnte nicht gelesen werden: ' + err.message);
    }
    e.target.value = '';
  };
  return (
    <>
      <Header title="Mehr" />
      <main className="pad">
        <section className="card">
          <h2>Synchronisierung</h2>
          <SyncBox />
        </section>
        <section className="card">
          <h2>Sicherung</h2>
          <div className="row gap">
            <button className="btn" onClick={download}>Herunterladen</button>
            <button className="btn" onClick={() => fileRef.current.click()}>Hochladen</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={upload} />
          </div>
          {msg && <p className="small muted">{msg}</p>}
        </section>
        <p className="muted small center">
          iPhone: Safari → „Teilen“ → „Zum Home-Bildschirm“, um es wie eine App zu öffnen.
        </p>
      </main>
    </>
  );
}

// --- shell --------------------------------------------------------------------

const TABS = [
  ['home', 'Training', '🏋️'],
  ['history', 'Verlauf', '🗓️'],
  ['progress', 'Fortschritt', '📈'],
  ['program', 'Plan', '📋'],
  ['more', 'Mehr', '⚙️'],
];

export default function App() {
  useStore();
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]);
  const go = (name, params = {}) => {
    setStack((s) => [...s, { name, params }]);
    window.scrollTo(0, 0);
  };
  // Swap the current screen (preview -> started workout), so Back goes home.
  const replace = (name, params = {}) => {
    setStack((s) => [...s.slice(0, -1), { name, params }]);
    window.scrollTo(0, 0);
  };
  const back = () => setStack((s) => s.slice(0, -1));
  const top = stack[stack.length - 1];

  let view;
  if (top?.name === 'workout') view = <Workout id={top.params.id} back={back} />;
  else if (top?.name === 'preview') view = <DayPreview dayId={top.params.dayId} back={back} go={go} replace={replace} />;
  else if (top?.name === 'exercise') view = <ExerciseProgress exId={top.params.exId} back={back} go={go} />;
  else if (top?.name === 'day') view = <DayEditor dayId={top.params.dayId} back={back} />;
  else if (top?.name === 'exercises') view = <ExercisesEditor back={back} />;
  else if (tab === 'home') view = <Home go={go} />;
  else if (tab === 'history') view = <HistoryView go={go} />;
  else if (tab === 'progress') view = <ProgressList go={go} />;
  else if (tab === 'program') view = <ProgramView go={go} />;
  else view = <Settings />;

  return (
    <div className="app">
      {view}
      <nav className="tabs">
        {TABS.map(([id, label, icon]) => (
          <button
            key={id}
            className={tab === id && !top ? 'on' : ''}
            onClick={() => {
              setTab(id);
              setStack([]);
              window.scrollTo(0, 0);
            }}
          >
            <span className="ti">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
