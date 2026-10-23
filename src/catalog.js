// Exercise choices per movement pattern ("Übungsauswahl") from the
// "Trainingsplan 3 Tage Ganzkörper, Frauen Fortgeschritten" PDF.
// Group order here is also the order groups are shown in the app.
export const CATALOG = [
  ['Beine glutedominant', ['45° Beinpresse hohe Fußstellung', 'Hip Press', 'Bulgarian Split Squats mit KH mit Festhalten', 'V-Squat', 'Kniebeuge mit LH (Lowbar)']],
  ['Beine quaddominant', ['Hackenschmidt Maschine', 'Kniebeugen Multipresse', 'Pendulum Squat', 'Belt-Squat', '45° Beinpresse tiefe Fußstellung', 'Kniebeuge mit LH (Highbar)']],
  ['Beine rectus femoris', ['Beinstrecker']],
  ['Beine hintere Kette', ['Hyperextensions', 'Rumänisches Kreuzheben mit LH', 'Rumänisches Kreuzheben mit KH', 'Rumänisches Kreuzheben an der Multipresse']],
  ['Beinbeuger', ['Beinbeuger sitzend', 'Beinbeuger stehend', 'Beinbeuger liegend']],
  ['Beine Glutes isoliert', ['Hipthrust mit LH', 'Hipthrust-Maschine', 'Kickbacks an der Maschine']],
  ['Beine extra', ['Abduktoren Maschine', 'Adduktion', 'Wadenheben stehend', 'Wadenheben an der Beinpresse']],
  ['Pull horizontal 1', ['Rudern am Turm eng im Untergriff', 'Rudern am Turm neutral', 'T-Bar Rudern', 'Rudern am Kabel', 'Ruderzugmaschine zur Hüfte (Latissimus)', 'Rudern mit KH']],
  ['Pull horizontal 2', ['Rudern am Turm breit im Obergriff', 'Ruderzugmaschine zur Brust (oberer Rücken)']],
  ['Pull vertikal 1', ['Klimmzug neutral', 'Klimmzug Untergriff', 'Latzug eng zur Brust im Untergriff', 'Latzug enger Griff', 'Latzug neutral', 'Latzug Maschine UG', 'Latzug am Kabel', 'Iliac-Pulldown', 'Latzug Maschine']],
  ['Pull vertikal 2', ['Klimmzug Obergriff', 'Latzug breit zur Brust im Obergriff', 'Latzug Maschine OG']],
  ['Push horizontal 1', ['Brustpresse', 'Low Incline Bankdrücken mit KH', 'Bankdrücken an der Multipresse', 'Bankdrücken mit KH', 'Bankdrücken mit LH']],
  ['Push horizontal 2', ['Schrägbankdrücken mit KH', 'Schrägbankdrücken mit LH', 'Schrägbankdrücken an der Multipresse', 'Brustpresse schräg']],
  ['Push vertikal', ['Schulterdrücken mit KH', 'Schulterpresse', 'Schulterdrücken an der Multipresse', 'Schulterdrücken mit LH']],
  ['Schulter seitlich isoliert', ['Seitheben mit KH', 'Seitheben Maschine', 'Seitheben am Kabel', 'Y-Raises am Kabelzug']],
  ['Schulter hinten isoliert', ['Vorgebeugtes Seitheben am Kabel', 'Butterfly Reverse', 'Seitheben sitzend und vorgebeugt mit KH']],
  ['Brust isoliert', ['Butterfly Maschine', 'Fliegende am Kabel sitzend']],
  ['Bizeps 1', ['Konzentrationscurls mit KH', 'Curls am Kabel', 'Bizepsmaschine', 'Supinationscurls abwechselnd', 'Scott Curls mit KH']],
  ['Bizeps 2', ['Hammercurls mit KH abwechselnd', 'Reverse Curls mit LH', 'Hammercurls am Kabel', 'Face Away Kabel Curls', 'Schrägbankcurls mit KH abwechselnd']],
  ['Trizeps 1', ['Pushdowns']],
  ['Trizeps 2', ['Trizepsdrücken überkopf mit Seil', 'French Press am Kabel liegend', 'Trizepsdrücken überkopf mit KH', 'French Press mit KH']],
];

export const GROUP_ORDER = CATALOG.map(([g]) => g);

// The first exercises came from cut-off Notion screenshots; move them into
// the plan's groups (and full names) unless they were already edited.
export const SEED_FIXES = [
  ['ex-beinpresse', { group: 'Beine Gluteus', name: '45° Beinpresse' }, { group: 'Beine glutedominant', name: '45° Beinpresse hohe Fußstellung' }],
  ['ex-beinstrecker', { group: 'Beinstrecker' }, { group: 'Beine rectus femoris' }],
  ['ex-rdl', { group: 'Beine Hintere Kette' }, { group: 'Beine hintere Kette' }],
  ['ex-rudern', { group: 'Pull Horizontal' }, { group: 'Pull horizontal 1' }],
  ['ex-brustpresse', { group: 'Push Horizontal' }, { group: 'Push horizontal 1' }],
  ['ex-seitheben', { group: 'Schulter Seite' }, { group: 'Schulter seitlich isoliert' }],
];

export function slug(s) {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Tag 2 and Tag 3 as logged in Notion (15.10.26 and 17.10.26).
const it = (exId, sets, repMin, repMax, step, warmup = true) => ({ exId, sets, repMin, repMax, step, warmup });
export const NOTION_EXTRA_EXERCISES = [
  { id: 'ex-reverse-flys-sz', name: 'Reverse Flys SZ', group: 'Schulter hinten isoliert' },
  { id: 'ex-bizepscurls-kh', name: 'Bizepscurls mit KH', group: 'Bizeps 1', unilateral: true },
];

function logged(id, dayId, date, items, results) {
  return {
    id, dayId, date, finished: true, note: '',
    entries: items.map((t, i) => ({
      exId: t.exId, sets: t.sets, repMin: t.repMin, repMax: t.repMax, step: t.step,
      weight: results[i][0], reps: results[i][1], warmup: null, note: '',
      ...(results[i][2] ? { unilateral: true, side: results[i][2] } : {}),
    })),
  };
}

const TAG2 = [
  it('cat-hipthrust-maschine', 3, 8, 10, 5),
  it('ex-beinpresse', 2, 6, 8, 5),
  it('cat-beinbeuger-sitzend', 2, 8, 10, 2.5),
  it('cat-latzug-maschine-og', 2, 8, 10, 2.5),
  it('cat-schulterdruecken-mit-kh', 2, 6, 8, 2),
  it('ex-reverse-flys-sz', 2, 8, 10, 2.5, false),
  it('ex-bizepscurls-kh', 2, null, null, 1, false),
];
const TAG3 = [
  it('cat-hipthrust-maschine', 2, 8, 10, 5),
  it('ex-beinstrecker', 2, 8, 10, 2.5),
  it('cat-beinbeuger-sitzend', 2, 8, 10, 2.5),
  it('cat-bankdruecken-mit-lh', 3, 6, 8, 2.5),
  it('cat-ruderzugmaschine-zur-brust-oberer-ruecken', 2, 8, 10, 2.5),
  it('cat-schulterdruecken-mit-kh', 2, 6, 8, 2),
];

// Tag 1 as in seed.js; only needed to log older sessions.
const TAG1 = [
  it('ex-beinpresse', 2, 6, 8, 5),
  it('ex-beinstrecker', 2, 8, 10, 2.5),
  it('ex-rdl', 2, 6, 8, 2.5),
  it('ex-rudern', 2, 8, 10, 2.5),
  it('ex-brustpresse', 2, 6, 8, 2.5),
  it('ex-seitheben', 2, 8, 10, 1, false),
];

// [dayId, planned items, logged session]
export const NOTION_DAYS = [
  ['day-2', TAG2, logged('w-2026-10-15-tag2', 'day-2', '2026-10-15', TAG2,
    [[125, [10, 10, 8]], [120, [8, 8]], [45, [6, 6]], [40, [9, 8]], [20, [9, 9]], [35, [6, null]], [8, [8, 8], { L: [8, 8], R: [8, 8] }]])],
  ['day-3', TAG3, logged('w-2026-10-17-tag3', 'day-3', '2026-10-17', TAG3,
    [[130, [10, 9]], [65, [10, 9]], [45, [7, 6]], [25, [9, 8, null]], [50, [9, 8]], [20, [8, 6]]])],
];

// Older sessions from Notion screenshots (27.09, 04.10, 07.10.26). The third
// set of 3-set exercises was off screen, so it stays empty.
export const NOTION_OLDER = [
  logged('w-2026-09-27-tag2', 'day-2', '2026-09-27', TAG2,
    [[125, [10, 10, null]], [120, [7, 7]], [45, [6, 6]], [40, [8, 8]], [20, [9, 8]], [30, [10, 10]], [8, [8, 8], { L: [8, 8], R: [8, 8] }]]),
  logged('w-2026-10-04-tag3', 'day-3', '2026-10-04', TAG3,
    [[125, [10, 10]], [65, [9, 9]], [45, [7, 6]], [25, [8, 8, null]], [50, [9, 8]], [20, [7, 6]]]),
  logged('w-2026-10-07-tag1', 'day-1', '2026-10-07', TAG1,
    [[120, [6, 8]], [65, [8, 8]], [55, [6, 6]], [50, [9, 8]], [45, [6, 5]], [12, [8, 8]]]),
];
