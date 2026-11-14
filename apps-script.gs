/* =========================================================
   STEF60 – ANMELDUNGEN -> GOOGLE TABELLE + MAIL

   Wer das Formular abschickt, ist angemeldet.
   Es gibt kein Ja/Nein und keine Abmeldung.
   Werden mehrere Personen auf einmal angemeldet, bekommt jede
   Person eine eigene Zeile. Die Spalte "angemeldetVon" zeigt,
   wer die Gruppe angemeldet hat.

   Einrichten / aktualisieren:
   1. Google-Tabelle oeffnen -> Erweiterungen -> Apps Script
   2. Diesen Code komplett hineinkopieren (alten ersetzen), speichern
   3. Bereitstellen -> Bereitstellungen verwalten -> Stift beim
      bestehenden Eintrag -> Version: "Neue Version" -> Bereitstellen
      (so bleibt die URL gleich und app.js muss nicht geaendert werden)
   4. Test im Browser:  <URL>?action=ping   ->  muss {"ok":true,...} zeigen
   ========================================================= */

const SHEET_NAME = 'Anmeldungen';
const TOKEN = 'code'; // nur fuer den Export in admin.html

/* An diese Adresse geht bei jeder Anmeldung eine Mail. */
const MAIL_EMPFAENGER = 'serni4333@gmail.com';

/* Neue Spalten immer nur HINTEN anhaengen, nie dazwischen. */
const COLUMNS = [
  'sentAt',
  'vorname',
  'nachname',
  'name',
  'remarks',
  'angemeldetVon',
  'gruppengroesse',
];

const MAX_PERSONEN = 10; // gleich wie in app.js

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json(e, { ok: true, sheet: SHEET_NAME, time: new Date() });
  if (p.action === 'submit') return submit(e, p);
  if (p.action === 'export') return exportRows(e, p);
  return json(e, { ok: false, error: 'unbekannte action' });
}

/* Anmeldung eintragen. Der Lock serialisiert gleichzeitige Zugriffe,
   damit keine Zeile verloren geht. */
function submit(e, p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const personen = lesePersonen_(p);
    if (!personen.length) return json(e, { ok: false, error: 'name fehlt' });
    if (personen.length > MAX_PERSONEN) return json(e, { ok: false, error: 'zu viele Personen' });

    const remarks = String(p.remarks || '').trim();
    const jetzt = new Date();
    const von = personen[0].name;

    /* Eine Zeile pro Person, Reihenfolge = COLUMNS */
    const rows = personen.map(function (x) {
      return [jetzt, x.vorname, x.nachname, x.name, remarks, von, personen.length];
    });

    const sh = sheet();
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    /* Mail an dich. Ein Fehler hier darf die Anmeldung nicht
       kaputt machen – sie ist ja schon gespeichert. */
    try {
      sendeMail_({ personen: personen, remarks: remarks });
    } catch (mailErr) {
      console.error('Mail fehlgeschlagen: ' + mailErr);
    }

    return json(e, { ok: true, anzahl: personen.length });
  } catch (err) {
    return json(e, { ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* Personen aus der Anfrage lesen. Neu: personen = JSON-Liste.
   Alt (eine Person): vorname + nachname – bleibt zur Sicherheit erhalten. */
function lesePersonen_(p) {
  let liste = [];

  if (p.personen) {
    try {
      liste = JSON.parse(p.personen);
    } catch (err) {
      liste = [];
    }
  } else {
    liste = [{ vorname: p.vorname, nachname: p.nachname }];
  }

  return liste
    .map(function (x) {
      const vorname = String((x && x.vorname) || '').trim();
      const nachname = String((x && x.nachname) || '').trim();
      return { vorname: vorname, nachname: nachname, name: (vorname + ' ' + nachname).trim() };
    })
    .filter(function (x) { return x.vorname && x.nachname; });
}

/* Mail bei neuer Anmeldung */
function sendeMail_(d) {
  const namen = d.personen.map(function (x) { return '- ' + x.name; }).join('\n');
  const anzahl = d.personen.length;

  const text =
    'Neue Anmeldung (' + anzahl + (anzahl === 1 ? ' Person' : ' Personen') + ')\n\n' +
    namen + '\n\n' +
    'Bemerkung: ' + (d.remarks || '-') + '\n';

  const betreff = anzahl === 1
    ? d.personen[0].name
    : d.personen[0].name + ' + ' + (anzahl - 1);

  MailApp.sendEmail(MAIL_EMPFAENGER, 'Stef60 – neue Anmeldung: ' + betreff, text);
}

/* Einmal im Editor ausfuehren, um die Mail-Berechtigung zu erteilen */
function testMail() {
  sendeMail_({
    personen: [{ name: 'Test Person' }, { name: 'Zweite Person' }],
    remarks: 'Das ist nur ein Test.',
  });
}

function exportRows(e, p) {
  if ((p.token || '') !== TOKEN) return json(e, { ok: false, error: 'token' });
  return json(e, { ok: true, rows: sheet().getDataRange().getDisplayValues() });
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);

  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    writeHeader(sh);
    return sh;
  }

  /* Kopfzeile immer aktuell halten. Das ist sicher, weil neue
     Spalten nur hinten angehaengt werden. */
  writeHeader(sh);

  return sh;
}

function writeHeader(sh) {
  sh.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function json(e, obj) {
  const body = JSON.stringify(obj);
  const cb = e && e.parameter ? e.parameter.callback : null;
  return cb
    ? ContentService.createTextOutput(cb + '(' + body + ')').setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
