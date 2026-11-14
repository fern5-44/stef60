/* =========================================================
   EVENT
   ========================================================= */

const EVENT = {
  title: 'Stefan feiert Geburtstag'
};


/* =========================================================
   DATEIEN & LINKS  ***HIER ANPASSEN***
   ---------------------------------------------------------
   Die Dateien einfach mit genau diesem Namen ins Repository
   (stef60) hochladen – neben index.html.
   ========================================================= */

const TERMIN_DATEI = 'termin.ics';          // Kalendertermin, für alle gleich
const UEBERSICHT_DATEI = 'uebersicht.png';  // Übersicht zum Herunterladen


/* =========================================================
   APPS SCRIPT  ***HIER DIE VERBINDUNG ZUM SHEET***
   ---------------------------------------------------------
   Neue Bereitstellung = neue URL. Am besten immer ueber
   "Bereitstellungen verwalten -> Stift -> Neue Version"
   aktualisieren, dann bleibt diese URL gleich.
   Test im Browser:  <URL>?action=ping  ->  {"ok":true, ...}
   ========================================================= */

const ENDPOINT =
  'https://script.google.com/macros/s/AKfycby70_V5wzUV4uwJ6ewRIiAwbQ-02OvNFImc3DR_5mRXtluDqKgI1i_BmNehdC1cGHo7/exec';


/* =========================================================
   SICHERHEITSFRAGEN
   ---------------------------------------------------------
   PLATZHALTER: richtige Antwort je Frage eintragen –
   'a', 'b', 'c' oder 'd' (= value der Antwort in index.html).
   ========================================================= */

const SECURITY_ANSWERS = {
  question1: 'd',   // 111100 = 60 im Binärsystem
  question2: 'b',   // PLATZHALTER – richtige Antwort eintragen
  question3: 'c'    // PLATZHALTER – richtige Antwort eintragen
};



/* =========================================================
   HTML-ELEMENTE
   ========================================================= */

const $ = (sel) => document.querySelector(sel);

const form = $('#rsvp');

const stepEls = [...document.querySelectorAll('[data-step]')];

let blob = null;


if (!form) {

  console.error('FEHLER: #rsvp wurde nicht gefunden.');

} else {


  /* =======================================================
     TITEL & LINKS
     ======================================================= */

  $('#title').textContent = EVENT.title;

  $('#calendar').href = TERMIN_DATEI;


  /* =======================================================
     VERBINDUNG ZUM APPS SCRIPT (JSONP)

     Apps Script beantwortet keinen CORS-Preflight und die
     /exec-Adresse leitet um. Mit JSONP umgeht man beides.
     ======================================================= */

  function api(params, timeoutMs) {

    return new Promise((resolve, reject) => {

      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');

      const cleanup = () => {
        clearTimeout(timer);
        delete window[cb];
        script.remove();
      };

      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('Keine Verbindung zum Anmelde-Sheet'));
      };

      /* Ohne Zeitlimit haengt die Seite, wenn Google nicht antwortet. */
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Zeitüberschreitung beim Anmelde-Sheet'));
      }, timeoutMs || 15000);

      script.src = ENDPOINT + '?' + new URLSearchParams({ ...params, callback: cb });

      document.body.appendChild(script);

    });

  }


  /* =======================================================
     STATUS / FEHLER
     ======================================================= */

  function error(msg) {
    $('#error').textContent = msg || '';
  }

  function status(msg) {
    $('#status').textContent = msg || '';
  }


  /* =======================================================
     VERBINDUNGSTEST BEIM LADEN
     ======================================================= */

  async function checkConnection() {

    try {

      const res = await api({ action: 'ping' }, 10000);

      if (res && res.ok) {
        status('');
        console.log('Verbindung zum Anmelde-Sheet steht.', res);
        return;
      }

      throw new Error((res && res.error) || 'unbekannte Antwort');

    } catch (err) {

      console.error('Verbindung zum Anmelde-Sheet fehlgeschlagen:', err);

      status(
        'Hinweis: Die Verbindung zur Anmeldeliste antwortet gerade nicht. ' +
        'Du kannst das Formular trotzdem ausfüllen – beim Abschicken wird es erneut versucht.'
      );

    }

  }

  checkConnection();


  /* =======================================================
     SCHRITTE
     0 = Sicherheitsfragen, 1 = Name, 2 = Bemerkungen
     ======================================================= */

  let step = 0;

  function show(i) {

    step = i;

    stepEls.forEach((el, index) => {
      el.hidden = index !== i;
    });

    $('#progress').textContent = `Schritt ${i + 1} von ${stepEls.length}`;

    error('');

    const first = stepEls[i].querySelector(
      'input:not([type="radio"]):not([type="checkbox"]), textarea'
    );

    if (first) {
      first.focus();
    }

  }


  /* =======================================================
     VALIDIERUNG
     ======================================================= */

  function validateSecurityQuestions() {

    const answers = ['question1', 'question2', 'question3'].map((q) =>
      form.querySelector(`input[name="${q}"]:checked`)
    );

    if (answers.some((a) => !a)) {
      return 'Beantworte alle drei Fragen, um weiterzukommen.';
    }

    for (const a of answers) {
      if (a.value !== SECURITY_ANSWERS[a.name]) {
        return SECURITY_HINTS[a.name];
      }
    }

    return null;

  }


  function validate(i) {

    if (i === 0) {
      return validateSecurityQuestions();
    }

    if (i === 1) {

      if (!$('#vorname').value.trim()) {
        return 'Bitte deinen Vornamen eintragen.';
      }

      if (!$('#nachname').value.trim()) {
        return 'Bitte deinen Nachnamen eintragen.';
      }

    }

    return null;

  }


  /* =======================================================
     WEITER / ZURÜCK
     ======================================================= */

  form.querySelectorAll('[data-next]').forEach((button) => {

    button.addEventListener('click', () => {

      const problem = validate(step);

      if (problem) {
        error(problem);
        return;
      }

      show(step + 1);

    });

  });


  form.querySelectorAll('[data-back]').forEach((button) => {

    button.addEventListener('click', () => {
      show(step - 1);
    });

  });


  show(0);


  /* =======================================================
     ABSENDEN = ANMELDEN
     Wer abschickt, ist angemeldet. Eine Abmeldung gibt es nicht.
     ======================================================= */

  form.addEventListener('submit', async (e) => {

    e.preventDefault();

    for (let i = 0; i < stepEls.length; i++) {
      const problem = validate(i);
      if (problem) {
        show(i);
        error(problem);
        return;
      }
    }

    const button = form.querySelector('button[type="submit"]');

    const vorname = $('#vorname').value.trim();
    const nachname = $('#nachname').value.trim();

    const data = {
      vorname: vorname,
      nachname: nachname,
      name: (vorname + ' ' + nachname).trim(),
      remarks: $('#remarks').value.trim()
    };

    button.disabled = true;
    error('');
    status('Anmeldung wird gesendet …');

    let res;

    try {

      res = await api({ action: 'submit', ...data }, 20000);

    } catch (err) {

      console.error(err);
      status('');
      error(
        'Senden hat nicht geklappt – die Anmeldeliste ist nicht erreichbar. ' +
        'Bitte nochmal versuchen oder kurz Bescheid geben.'
      );
      button.disabled = false;
      return;

    }

    if (!res || !res.ok) {

      status('');
      error('Senden hat nicht geklappt: ' + ((res && res.error) || 'unbekannt'));
      button.disabled = false;
      return;

    }


    /* Erfolgreich */

    status('');
    form.hidden = true;
    $('#progress').hidden = true;
    $('#step-done').hidden = false;

    const ok = await drawUebersicht($('#ticket'));

    if (!ok) {
      /* uebersicht.png fehlt noch -> Bild und Knopf ausblenden */
      $('#ticket').hidden = true;
      $('#download').hidden = true;
      return;
    }

    blob = await new Promise((done) => $('#ticket').toBlob(done, 'image/png'));

  });


  /* =======================================================
     ÜBERSICHT-BILD
     Gibt false zurueck, wenn die Datei (noch) nicht da ist.
     ======================================================= */

  async function drawUebersicht(canvas) {

    const img = new Image();
    img.src = UEBERSICHT_DATEI;

    try {
      await img.decode();
    } catch (err) {
      console.error('Übersicht nicht gefunden: ' + UEBERSICHT_DATEI, err);
      return false;
    }

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);

    return true;

  }


  /* =======================================================
     DOWNLOAD
     ======================================================= */

  $('#download').addEventListener('click', () => {

    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'stef60-uebersicht.png';
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 4000);

  });

}
