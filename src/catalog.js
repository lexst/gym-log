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
