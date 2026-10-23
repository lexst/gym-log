import { useEffect, useRef, useState } from 'react';
import * as store from './store.js';
import { useStore, uid } from './store.js';
import * as L from './logic.js';
import { supabase, syncNow, onStatus, status as initialStatus } from './sync.js';

// --- data helpers -----------------------------------------------------------

const days = () => store.all('day').sort((a, b) => (a.order || 0) - (b.order || 0));
const exercises = () => store.all('exercise').sort((a, b) => a.name.localeCompare(b.name));
const workouts = () => store.all('workout');
const exName = (id) => store.get('exercise', id)?.name || 'Упражнение';
const exGroup = (id) => store.get('exercise', id)?.group || '';
const dayName = (id) => store.get('day', id)?.name || '';
const activeWorkout = () => workouts().find((w) => !w.finished);

const RESULT = { up: ['↑', 'up'], same: ['=', 'same'], down: ['↓', 'down'], new: ['•', 'new'] };

function startWorkout(day) {
  const ws = workouts();
  const date = L.todayIso();
  const entries = day.items.map((it) => {
    const prev = L.previous(ws, it.exId, { date: '9999-12-31' });
    const sug = L.suggest(it, prev?.entry, it.step);
    const weight = sug?.weight ?? null;
    return {
      exId: it.exId,
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
  return store.put('workout', { id: uid(), dayId: day.id, date, entries, note: '', finished: false, startedAt: Date.now() });
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
      <button type="button" onClick={() => bump(-step)} aria-label="Меньше">−</button>
      <NumField value={value} onChange={onChange} placeholder={placeholder} ariaLabel={ariaLabel} />
      <button type="button" onClick={() => bump(step)} aria-label="Больше">+</button>
    </div>
  );
}

function Header({ title, onBack, right }) {
  return (
    <header className="top">
      {onBack ? (
        <button className="back" onClick={onBack} aria-label="Назад">‹</button>
      ) : (
        <span className="back-space" />
      )}
      <h1>{title}</h1>
      <div className="top-right">{right}</div>
    </header>
  );
}

function ResultBadge({ r, pr }) {
  if (!r) return null;
  const [sym, cls] = RESULT[r];
  return (
    <span className="badges">
      <span className={'res ' + cls} title={{ up: 'Прогресс', same: 'Как в прошлый раз', down: 'Хуже', new: 'Первый раз' }[r]}>{sym}</span>
      {pr && <span className="pr" title="Личный рекорд">PR</span>}
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
      <Header title="Тренировка" />
      <main className="pad">
        {active && (
          <button className="card active-card" onClick={() => go('workout', { id: active.id })}>
            <div className="muted small">Идёт тренировка</div>
            <div className="big">{dayName(active.dayId)} · {L.fmtDate(active.date)}</div>
            <div className="small">Продолжить ›</div>
          </button>
        )}
        <h2>Начать</h2>
        {ds.map((d) => {
          const last = ws.filter((w) => w.finished && w.dayId === d.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
          const ago = last ? L.daysAgo(last.date) : null;
          return (
            <button
              key={d.id}
              className={'card day-card' + (d.id === nextId && !active ? ' next' : '')}
              disabled={!!active || !d.items.length}
              onClick={() => go('workout', { id: startWorkout(d).id })}
            >
              <div className="row between">
                <div className="big">{d.name}</div>
                {d.id === nextId && !active && <span className="chip">следующая</span>}
              </div>
              <div className="muted small">
                {d.items.length ? `${d.items.length} упр. · ` : 'Нет упражнений — добавьте в «Программа» · '}
                {last ? `последний раз ${L.fmtDate(last.date)}${ago === 0 ? ' (сегодня)' : ago === 1 ? ' (вчера)' : ` (${ago} дн. назад)`}` : 'ещё не было'}
              </div>
            </button>
          );
        })}
        {active && <p className="muted small center">Сначала завершите текущую тренировку.</p>}
      </main>
    </>
  );
}

// --- workout ------------------------------------------------------------------

function EntryCard({ w, entry, index, update, removeEntry, ws }) {
  const prev = L.previous(ws, entry.exId, w)?.entry;
  const sug = L.suggest(entry, prev, entry.step);
  const r = L.compare(entry, prev);
  const pr = w.finished && L.isPr(ws, entry, w);
  const set = (patch) => update(index, { ...entry, ...patch });
  const setRep = (i, v) => {
    const reps = [...entry.reps];
    reps[i] = v;
    set({ reps });
  };
  const target = entry.repMin ? `${entry.sets}×${entry.repMin}${entry.repMax && entry.repMax !== entry.repMin ? '–' + entry.repMax : ''}` : `${entry.reps.length} подх.`;

  return (
    <section className="card entry">
      <div className="row between">
        <div>
          <div className="muted small">{exGroup(entry.exId)}</div>
          <div className="big">{exName(entry.exId)}</div>
        </div>
        <ResultBadge r={r} pr={pr} />
      </div>
      <div className="meta small">
        <span className="chip">{target}</span>
        {prev ? (
          <span className="muted">
            Прошлый раз: {L.fmtNum(prev.weight)} кг × {L.doneReps(prev).join('/')}
          </span>
        ) : (
          <span className="muted">Первый раз</span>
        )}
      </div>
      {sug?.up && entry.weight !== sug.weight && !w.finished && (
        <button className="hint" onClick={() => set({ weight: sug.weight })}>
          В прошлый раз верх диапазона — попробовать {L.fmtNum(sug.weight)} кг?
        </button>
      )}
      {sug?.up && entry.weight === sug.weight && !L.hasData(entry) && (
        <div className="hint ok">↑ Вес повышен: в прошлый раз вы дошли до верха диапазона</div>
      )}

      <div className="field">
        <label>Вес, кг</label>
        <Stepper value={entry.weight} step={entry.step || 2.5} onChange={(v) => set({ weight: v })} ariaLabel="Рабочий вес" />
      </div>

      {entry.warmup && (
        <div className="set-row warm">
          <span className="set-label">Разминка</span>
          <NumField className="w-sm" value={entry.warmup.weight} onChange={(v) => set({ warmup: { ...entry.warmup, weight: v } })} ariaLabel="Вес разминки" />
          <span className="muted small">кг ×</span>
          <NumField className="w-sm" value={entry.warmup.reps} placeholder="—" onChange={(v) => set({ warmup: { ...entry.warmup, reps: v } })} ariaLabel="Повторы разминки" />
          <button
            className={'tick' + (entry.warmup.done ? ' on' : '')}
            onClick={() => set({ warmup: { ...entry.warmup, done: !entry.warmup.done } })}
            aria-label="Разминка сделана"
          >
            ✓
          </button>
        </div>
      )}

      {entry.reps.map((rep, i) => (
        <div className="set-row" key={i}>
          <span className="set-label">Подход {i + 1}</span>
          <NumField
            className="w-md"
            value={rep}
            placeholder={prev?.reps?.[i] != null ? String(prev.reps[i]) : '—'}
            onChange={(v) => setRep(i, v)}
            ariaLabel={`Повторы, подход ${i + 1}`}
          />
          <span className="muted small">повт.</span>
          {rep != null && entry.repMax && (
            <span className={'small ' + (rep >= entry.repMax ? 'good' : rep < entry.repMin ? 'bad' : 'muted')}>
              {rep >= entry.repMax ? 'верх' : rep < entry.repMin ? 'ниже' : ''}
            </span>
          )}
        </div>
      ))}
      <div className="row gap">
        <button className="link small" onClick={() => set({ reps: [...entry.reps, null] })}>+ подход</button>
        {entry.reps.length > 1 && (
          <button className="link small" onClick={() => set({ reps: entry.reps.slice(0, -1) })}>− подход</button>
        )}
        {!entry.warmup && (
          <button className="link small" onClick={() => set({ warmup: { weight: L.warmupWeight(entry.weight), reps: null, done: false } })}>
            + разминка
          </button>
        )}
        {entry.extra && (
          <button className="link small danger" onClick={() => removeEntry(index)}>убрать</button>
        )}
      </div>
      <textarea
        className="note"
        rows={1}
        placeholder="Заметка"
        value={entry.note || ''}
        onChange={(e) => set({ note: e.target.value })}
      />
    </section>
  );
}

function AddExercise({ onAdd, onClose }) {
  const [q, setQ] = useState('');
  const list = exercises().filter((e) => (e.name + ' ' + e.group).toLowerCase().includes(q.toLowerCase()));
  const create = () => {
    const e = store.put('exercise', { id: uid(), name: q.trim(), group: '' });
    onAdd(e.id);
  };
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2>Добавить упражнение</h2>
          <button className="link" onClick={onClose}>Закрыть</button>
        </div>
        <input className="text" autoFocus placeholder="Поиск или новое название" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="list">
          {list.map((e) => (
            <button key={e.id} className="list-item" onClick={() => onAdd(e.id)}>
              <div>{e.name}</div>
              <div className="muted small">{e.group}</div>
            </button>
          ))}
          {q.trim() && !list.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) && (
            <button className="list-item" onClick={create}>
              + Новое: «{q.trim()}»
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
  if (!w) return <><Header title="Тренировка" onBack={back} /><main className="pad muted">Тренировка удалена.</main></>;
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
    if (confirm('Удалить эту тренировку?')) {
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
        <button className="btn ghost" onClick={() => setAdding(true)}>+ Упражнение</button>
        <textarea className="note big-note" rows={2} placeholder="Заметка к тренировке" value={w.note || ''} onChange={(e) => save({ note: e.target.value })} />
        {!w.finished ? (
          <button className="btn primary" onClick={finish}>
            Завершить тренировку ({doneCount}/{w.entries.length})
          </button>
        ) : (
          <button className="btn" onClick={() => save({ finished: false })}>Открыть снова</button>
        )}
        <button className="link danger center-block" onClick={del}>Удалить тренировку</button>
      </main>
      {adding && <AddExercise onAdd={addEntry} onClose={() => setAdding(false)} />}
    </>
  );
}

// --- history ------------------------------------------------------------------

function HistoryView({ go }) {
  const ws = workouts().filter((w) => w.finished).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return (
    <>
      <Header title="История" />
      <main className="pad">
        {!ws.length && <p className="muted center">Пока нет завершённых тренировок.</p>}
        {ws.map((w) => (
          <button key={w.id} className="card hist" onClick={() => go('workout', { id: w.id })}>
            <div className="row between">
              <div className="big">{dayName(w.dayId)} · {L.fmtDate(w.date)}</div>
            </div>
            {w.entries.filter(L.hasData).map((e, i) => {
              const prev = L.previous(workouts(), e.exId, w)?.entry;
              return (
                <div key={i} className="hist-line small">
                  <span className="hist-name">{exName(e.exId)}</span>
                  <span className="muted">{L.fmtNum(e.weight)}×{L.doneReps(e).join('/')}</span>
                  <ResultBadge r={L.compare(e, prev)} pr={L.isPr(workouts(), e, w)} />
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
  if (points.length < 2) return <p className="muted small">График появится после двух тренировок.</p>;
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
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="График прогресса">
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
      <Header title="Прогресс" />
      <main className="pad">
        {!list.length && <p className="muted center">Данные появятся после первой тренировки.</p>}
        {list.map(({ e, h }) => {
          const last = h[h.length - 1];
          const first = h[0];
          const diff = last.entry.weight - first.entry.weight;
          return (
            <button key={e.id} className="card list-card" onClick={() => go('exercise', { exId: e.id })}>
              <div className="row between">
                <div>
                  <div className="muted small">{e.group}</div>
                  <div className="big">{e.name}</div>
                </div>
                <div className="right">
                  <div className="big">{L.fmtNum(last.entry.weight)} кг</div>
                  <div className={'small ' + (diff > 0 ? 'good' : 'muted')}>
                    {h.length > 1 ? (diff > 0 ? '+' : '') + L.fmtNum(diff) + ' кг' : 'новое'}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
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
            <div className="muted small">Макс. вес</div>
            <div className="big">{maxW ? L.fmtNum(maxW.entry.weight) : '—'} кг</div>
            <div className="muted small">{maxW ? L.fmtDate(maxW.date) : ''}</div>
          </div>
          <div className="stat">
            <div className="muted small">Рекорд (≈1ПМ)</div>
            <div className="big">{best ? L.fmtNum(Math.round(L.bestE1rm(best.entry) * 10) / 10) : '—'} кг</div>
            <div className="muted small">{best ? `${L.fmtNum(best.entry.weight)}×${Math.max(...L.doneReps(best.entry))}` : ''}</div>
          </div>
          <div className="stat">
            <div className="muted small">Тренировок</div>
            <div className="big">{h.length}</div>
          </div>
        </div>
        <div className="card">
          <Chart points={points} />
          <div className="legend small">
            <span><i className="sw s1" />Рабочий вес</span>
            <span><i className="sw s2" />≈1ПМ</span>
          </div>
        </div>
        <h2>Все тренировки</h2>
        {[...h].reverse().map((x, i, arr) => {
          const prev = arr[i + 1]?.entry;
          return (
            <button key={x.workoutId} className="card hist" onClick={() => go('workout', { id: x.workoutId })}>
              <div className="hist-line">
                <span className="hist-name">{L.fmtDate(x.date)}</span>
                <span>{L.fmtNum(x.entry.weight)} кг × {L.doneReps(x.entry).join('/')}</span>
                <ResultBadge r={L.compare(x.entry, prev)} />
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
      <Header title="Программа" />
      <main className="pad">
        {ds.map((d) => (
          <button key={d.id} className="card list-card" onClick={() => go('day', { dayId: d.id })}>
            <div className="big">{d.name}</div>
            <div className="muted small">{d.items.map((it) => exName(it.exId)).join(' · ') || 'Пусто'}</div>
          </button>
        ))}
        <button className="btn ghost" onClick={addDay}>+ День</button>
        <button className="btn ghost" onClick={() => go('exercises')}>Все упражнения</button>
      </main>
    </>
  );
}

function DayEditor({ dayId, back }) {
  const d = store.get('day', dayId);
  const [adding, setAdding] = useState(false);
  if (!d) return <><Header title="День" onBack={back} /></>;
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
          <label>Название дня</label>
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
                <button className="icon" onClick={() => move(i, -1)} aria-label="Выше">↑</button>
                <button className="icon" onClick={() => move(i, 1)} aria-label="Ниже">↓</button>
              </div>
            </div>
            <div className="grid4">
              <div className="field">
                <label>Подходы</label>
                <NumField value={it.sets} onChange={(v) => v && setItem(i, { sets: v })} />
              </div>
              <div className="field">
                <label>Повт. от</label>
                <NumField value={it.repMin} onChange={(v) => setItem(i, { repMin: v })} />
              </div>
              <div className="field">
                <label>до</label>
                <NumField value={it.repMax} onChange={(v) => setItem(i, { repMax: v })} />
              </div>
              <div className="field">
                <label>Шаг, кг</label>
                <NumField value={it.step} onChange={(v) => setItem(i, { step: v })} />
              </div>
            </div>
            <div className="row between">
              <label className="check">
                <input type="checkbox" checked={!!it.warmup} onChange={(e) => setItem(i, { warmup: e.target.checked })} /> Разминочный подход
              </label>
              <button className="link small danger" onClick={() => save({ items: d.items.filter((_, j) => j !== i) })}>Убрать</button>
            </div>
          </section>
        ))}
        <button className="btn ghost" onClick={() => setAdding(true)}>+ Упражнение</button>
        <button
          className="link danger center-block"
          onClick={() => {
            if (confirm(`Удалить «${d.name}» из программы? История тренировок сохранится.`)) {
              store.remove('day', d.id);
              back();
            }
          }}
        >
          Удалить день
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
  const list = exercises();
  return (
    <>
      <Header title="Упражнения" onBack={back} />
      <main className="pad">
        {list.map((e) => (
          <section className="card" key={e.id}>
            <div className="field">
              <label>Название</label>
              <input className="text" value={e.name} onChange={(ev) => store.put('exercise', { ...e, name: ev.target.value })} />
            </div>
            <div className="field">
              <label>Группа</label>
              <input className="text" value={e.group} onChange={(ev) => store.put('exercise', { ...e, group: ev.target.value })} />
            </div>
          </section>
        ))}
        <button className="btn ghost" onClick={() => store.put('exercise', { id: uid(), name: 'Новое упражнение', group: '' })}>
          + Упражнение
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

  if (!supabase) return <p className="muted small">Синхронизация не настроена: данные хранятся только на этом устройстве.</p>;

  if (!session) {
    const signIn = async () => {
      setMsg('');
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setMsg(error.message);
    };
    const signUp = async () => {
      setMsg('');
      const { error, data } = await supabase.auth.signUp({ email, password: pw });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg('Проверьте почту и подтвердите адрес, затем войдите.');
    };
    return (
      <div>
        <p className="muted small">Войдите, чтобы тренировки синхронизировались между телефоном и компьютером.</p>
        <input className="text" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="text" type="password" autoComplete="current-password" placeholder="Пароль" value={pw} onChange={(e) => setPw(e.target.value)} />
        <div className="row gap">
          <button className="btn primary" onClick={signIn}>Войти</button>
          <button className="btn" onClick={signUp}>Регистрация</button>
        </div>
        {msg && <p className="small bad">{msg}</p>}
      </div>
    );
  }

  const label = {
    idle: 'Ожидание',
    syncing: 'Синхронизация…',
    ok: `Синхронизировано${s.at ? ' в ' + s.at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}`,
    offline: 'Нет интернета: синхронизирую, когда появится связь',
    error: 'Ошибка: ' + s.error,
    'signed-out': 'Не выполнен вход',
  }[s.state];
  return (
    <div>
      <p className="small">{session.user.email}</p>
      <p className={'small ' + (s.state === 'error' ? 'bad' : 'muted')}>{label}</p>
      <div className="row gap">
        <button className="btn" onClick={syncNow}>Синхронизировать</button>
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Выйти</button>
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
      setMsg(`Загружено записей: ${n}`);
    } catch (err) {
      setMsg('Не удалось прочитать файл: ' + err.message);
    }
    e.target.value = '';
  };
  return (
    <>
      <Header title="Ещё" />
      <main className="pad">
        <section className="card">
          <h2>Синхронизация</h2>
          <SyncBox />
        </section>
        <section className="card">
          <h2>Резервная копия</h2>
          <div className="row gap">
            <button className="btn" onClick={download}>Скачать</button>
            <button className="btn" onClick={() => fileRef.current.click()}>Загрузить</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={upload} />
          </div>
          {msg && <p className="small muted">{msg}</p>}
        </section>
        <p className="muted small center">
          На iPhone: Safari → «Поделиться» → «На экран „Домой“», чтобы открыть как приложение.
        </p>
      </main>
    </>
  );
}

// --- shell --------------------------------------------------------------------

const TABS = [
  ['home', 'Тренировка', '🏋️'],
  ['history', 'История', '🗓️'],
  ['progress', 'Прогресс', '📈'],
  ['program', 'Программа', '📋'],
  ['more', 'Ещё', '⚙️'],
];

export default function App() {
  useStore();
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]);
  const go = (name, params = {}) => {
    setStack((s) => [...s, { name, params }]);
    window.scrollTo(0, 0);
  };
  const back = () => setStack((s) => s.slice(0, -1));
  const top = stack[stack.length - 1];

  let view;
  if (top?.name === 'workout') view = <Workout id={top.params.id} back={back} />;
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
