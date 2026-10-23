// Starting program taken from the Notion log (Tag 1, 22.10.26).
// Names cut off in the screenshots are best guesses; edit them in "Plan".

const ex = (id, name, group) => ({ id, name, group });
const item = (exId, sets, repMin, repMax, step = 2.5) => ({ exId, sets, repMin, repMax, warmup: true, step });

export function seedDocs() {
  const exercises = [
    ex('ex-beinpresse', '45° Beinpresse', 'Beine Gluteus'),
    ex('ex-beinstrecker', 'Beinstrecker', 'Beinstrecker'),
    ex('ex-rdl', 'Rumänisches Kreuzheben', 'Beine Hintere Kette'),
    ex('ex-rudern', 'Rudern am Kabel', 'Pull Horizontal'),
    ex('ex-brustpresse', 'Brustpresse', 'Push Horizontal'),
    ex('ex-seitheben', 'Seitheben', 'Schulter Seite'),
  ];
  const days = [
    {
      id: 'day-1',
      name: 'Tag 1',
      order: 1,
      items: [
        item('ex-beinpresse', 2, 6, 8, 5),
        item('ex-beinstrecker', 2, 8, 10),
        item('ex-rdl', 2, 6, 8),
        item('ex-rudern', 2, 8, 10),
        item('ex-brustpresse', 2, 6, 8),
        { ...item('ex-seitheben', 2, 8, 10, 1), warmup: false },
      ],
    },
    { id: 'day-2', name: 'Tag 2', order: 2, items: [] },
    { id: 'day-3', name: 'Tag 3', order: 3, items: [] },
  ];
  const logged = [
    ['ex-beinpresse', 120, [8, 9]],
    ['ex-beinstrecker', 65, [9, 9]],
    ['ex-rdl', 55, [7, 6]],
    ['ex-rudern', 50, [10, 9]],
    ['ex-brustpresse', 45, [6, 6]],
    ['ex-seitheben', 12, [8, 8]],
  ];
  const workouts = [
    {
      id: 'w-2026-10-22-tag1',
      dayId: 'day-1',
      date: '2026-10-22',
      finished: true,
      note: '',
      entries: logged.map(([exId, weight, reps]) => {
        const t = days[0].items.find((i) => i.exId === exId);
        return { exId, sets: t.sets, repMin: t.repMin, repMax: t.repMax, weight, reps, warmup: null, note: '' };
      }),
    },
  ];
  return { exercise: exercises, day: days, workout: workouts };
}
