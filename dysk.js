"use strict";
/* =====================================================================
   PROGRAM MANHATTAN – dane na Dysku Google (wersja z GitHuba).
   Logowanie kontem Google (Google Identity Services) i obsługa plików
   przez Google Drive API v3. Program dostaje uprawnienie „drive.file”:
   widzi WYŁĄCZNIE pliki, które sam utworzył – nic innego z Twojego Dysku.

   Udostępnia „katalogi” i „pliki” z tym samym zestawem funkcji co
   File System Access API (getFileHandle, getDirectoryHandle, entries,
   removeEntry, getFile, createWritable), więc reszta programu działa
   bez zmian – tak jak wcześniej z folderem na MEGA.
   ===================================================================== */
(function () {
const CFG = window.MANHATTAN_CONFIG || {};
const ZAKRES = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';
const NAZWA_GLOWNEGO = 'Manhattan – dane programu';

/* ---------- logowanie (token dostępu, ważny ok. 1 godziny) ----------
   Przy otwarciu programu logowanie idzie „przez przekierowanie”: strona na chwilę przechodzi do Google
   i wraca z kluczem dostępu. Jeśli w przeglądarce jesteś zalogowany na konto Google i zgoda była już
   udzielona – dzieje się to samo, bez klikania (prompt=none). Klucz trzymamy do wygaśnięcia (ok. 1 h),
   więc ponowne otwarcie programu w tym czasie nie wymaga nawet przekierowania. */
let klient = null, token = '', wygasa = 0, oczekujace = null, pasekOdnow = null, bladPowrotu = '';
const K_TOKEN = 'manhattan_g', K_STAN = 'manhattan_oauth_stan', K_KONTO = 'manhattan_konto';
function zapiszToken(t, sek) {
  token = t; wygasa = Date.now() + (+sek || 3600) * 1000;
  try { localStorage.setItem(K_TOKEN, JSON.stringify({t: token, w: wygasa})); } catch {}
}
try { const z = JSON.parse(localStorage.getItem(K_TOKEN) || 'null'); if (z && z.w > Date.now() + 120000) { token = z.t; wygasa = z.w; } } catch {}
// powrót z Google (adres strony kończy się na #access_token=… albo #error=…)
(function powrot() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.has('access_token') && !h.has('error')) return;
  let stan = ''; try { stan = sessionStorage.getItem(K_STAN) || ''; sessionStorage.removeItem(K_STAN); } catch {}
  history.replaceState(null, '', location.pathname + location.search);       // klucz nie zostaje w pasku adresu
  if (!stan || h.get('state') !== stan) { bladPowrotu = 'zly_stan'; return; }
  if (h.get('error')) { bladPowrotu = h.get('error'); return; }
  if (!(h.get('scope') || '').split(' ').includes(ZAKRES)) { bladPowrotu = 'brak_zgody'; return; }
  zapiszToken(h.get('access_token'), h.get('expires_in'));
})();
const adresPowrotu = () => CFG.adresPowrotu || (location.origin + location.pathname.replace(/index\.html$/, ''));
function przekieruj(cicho) {
  const stan = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem(K_STAN, stan); } catch {}
  const p = new URLSearchParams({client_id: CFG.clientId, redirect_uri: adresPowrotu(), response_type: 'token', scope: ZAKRES, include_granted_scopes: 'true', state: stan});
  let konto = ''; try { konto = localStorage.getItem(K_KONTO) || ''; } catch {}
  if (konto) p.set('login_hint', konto);
  if (cicho) p.set('prompt', 'none'); else if (!konto) p.set('prompt', 'select_account');
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + p);
  return new Promise(() => {});                    // strona i tak zaraz przechodzi do Google
}

function czekajNaGIS() {
  return new Promise((ok, zle) => { let n = 0;
    (function sprawdz() { if (window.google && google.accounts && google.accounts.oauth2) return ok();
      if (++n > 100) return zle(new Error('Nie udało się wczytać logowania Google. Sprawdź połączenie z internetem.'));
      setTimeout(sprawdz, 100); })(); });
}
async function przygotuj() {
  if (klient) return;
  if (!CFG.clientId) throw new Error('Brak identyfikatora logowania Google (config.js → clientId).');
  await czekajNaGIS();
  klient = google.accounts.oauth2.initTokenClient({
    client_id: CFG.clientId, scope: ZAKRES,
    callback: r => {
      const o = oczekujace; oczekujace = null;
      if (r.error || !r.access_token) { o && o.zle(new Error('Logowanie Google nie powiodło się: ' + (r.error_description || r.error || '?'))); return; }
      if (!google.accounts.oauth2.hasGrantedAllScopes(r, ZAKRES)) { o && o.zle(new Error('Nie udzielono programowi dostępu do jego plików na Dysku Google. Zaloguj się jeszcze raz i zaznacz zgodę.')); return; }
      zapiszToken(r.access_token, r.expires_in);
      if (pasekOdnow) { pasekOdnow.remove(); pasekOdnow = null; }
      o && o.ok(token);
    },
    error_callback: e => { const o = oczekujace; oczekujace = null;
      o && o.zle(Object.assign(new Error(e.type === 'popup_closed' ? 'Zamknięto okno logowania Google.' : 'Okno logowania Google zostało zablokowane.'), {gis: e.type})); },
  });
}
function popros(prompt) {
  return new Promise((ok, zle) => {
    oczekujace = {ok, zle};
    const opcje = {prompt}; try { const l = localStorage.getItem('manhattan_konto'); if (l) opcje.login_hint = l; } catch {}
    klient.requestAccessToken(opcje);
  });
}
// auto = true: przy otwarciu programu – po cichu (bez klikania), o ile wcześniej już się logowano na tym urządzeniu
// auto = false: kliknięty przycisk „Zaloguj kontem Google”
async function zaloguj(auto) {
  if (!CFG.clientId) throw new Error('Brak identyfikatora logowania Google (config.js → clientId).');
  if (token && wygasa > Date.now() + 120000) return token;
  if (auto) {
    let konto = ''; try { konto = localStorage.getItem(K_KONTO) || ''; } catch {}
    if (bladPowrotu || !konto) throw Object.assign(new Error(bladPowrotu === 'access_denied' ? 'Nie udzielono zgody na logowanie Google.' : ''), {klik: true});
    return przekieruj(true);
  }
  return przekieruj(false);
}
// odświeżenie w trakcie pracy; gdy przeglądarka zablokuje okienko – pasek z przyciskiem
let odnawianie = null;
async function wazny() {
  if (token && wygasa > Date.now() + 120000) return token;
  if (odnawianie) return odnawianie;
  odnawianie = (async () => {
    await przygotuj();
    try { return await popros(''); }
    catch (e) {
      return await new Promise((ok, zle) => {
        if (!pasekOdnow) {
          pasekOdnow = document.createElement('div');
          pasekOdnow.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:100;background:#8a5a00;color:#fff;padding:10px 16px;font-weight:600;text-align:center';
          pasekOdnow.innerHTML = 'Sesja Google wygasła – zmiany czekają na zapis. <button style="margin-left:10px;font:inherit;padding:4px 12px;cursor:pointer">Zaloguj ponownie</button>';
          document.body.appendChild(pasekOdnow);
        }
        pasekOdnow.querySelector('button').onclick = () => popros('').then(ok, zle);
      });
    }
  })();
  try { return await odnawianie; } finally { odnawianie = null; }
}
function wyloguj() {
  try { if (token) google.accounts.oauth2.revoke(token, () => {}); } catch {}
  token = ''; wygasa = 0; try { localStorage.removeItem(K_TOKEN); localStorage.removeItem(K_KONTO); } catch {}
}

/* ---------- zapytania do Dysku Google ---------- */
const czekaj = ms => new Promise(r => setTimeout(r, ms));
async function zapytaj(url, opcje = {}) {
  for (let proba = 1; ; proba++) {
    const t = await wazny();
    let r;
    try { r = await fetch(url, {...opcje, headers: {...(opcje.headers || {}), Authorization: 'Bearer ' + t}}); }
    catch (e) { if (proba < 4) { await czekaj(proba * 1000); continue; } throw new Error('Brak połączenia z Dyskiem Google. Sprawdź internet – zmiana zapisze się przy następnej próbie.'); }
    if (r.status === 401 && proba < 3) { token = ''; wygasa = 0; continue; }
    if ((r.status === 429 || r.status >= 500 || (r.status === 403 && /rate|quota/i.test(await r.clone().text()))) && proba < 5) { await czekaj(proba * 1500); continue; }
    if (r.status === 404) { const e = new Error('Nie ma takiego pliku na Dysku Google.'); e.name = 'NotFoundError'; throw e; }
    if (!r.ok) { let m = ''; try { m = (await r.json()).error.message; } catch {} throw new Error(`Dysk Google: ${r.status} ${m}`); }
    return r;
  }
}
const cytuj = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const POLA = 'id,name,mimeType,modifiedTime,size';
async function lista(q) {
  const wynik = []; let strona = '';
  do {
    const u = `${API}?q=${encodeURIComponent(q)}&fields=nextPageToken,files(${POLA})&pageSize=1000&spaces=drive&orderBy=name${strona ? '&pageToken=' + strona : ''}`;
    const j = await (await zapytaj(u)).json(); wynik.push(...j.files); strona = j.nextPageToken || '';
  } while (strona);
  return wynik;
}
async function utworz(meta, dane) {
  if (dane === undefined) return (await zapytaj(`${API}?fields=${POLA}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(meta)})).json();
  const granica = 'mnh' + Math.random().toString(36).slice(2);
  const cialo = new Blob([`--${granica}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${granica}\r\nContent-Type: application/octet-stream\r\n\r\n`, dane, `\r\n--${granica}--`]);
  return (await zapytaj(`${UPL}?uploadType=multipart&fields=${POLA}`, {method: 'POST', headers: {'Content-Type': `multipart/related; boundary=${granica}`}, body: cialo})).json();
}

/* ---------- ochrona przed nadpisaniem zmian z innego urządzenia ----------
   Dla plików baz (.sqlite) pamiętamy czas ostatniej zmiany odczytany/zapisany przez to okno.
   Jeśli przed zapisem okaże się, że plik zmienił się w międzyczasie (np. praca na drugim komputerze
   albo na telefonie) – zapis jest wstrzymany, żeby niczego nie nadpisać. */
const znanyCzas = new Map();
let konflikt = false;
function pokazKonflikt() {
  if (konflikt) return; konflikt = true;
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:101;background:#b3261e;color:#fff;padding:12px 16px;font-weight:600;text-align:center';
  p.innerHTML = '⚠ Dane zostały zmienione na innym urządzeniu (inny komputer albo telefon). Żeby niczego nie nadpisać, zapis w tym oknie jest wstrzymany. ' +
    'Odśwież program (klawisz F5) – zobaczysz aktualne dane; ostatnią zmianę z tego okna trzeba wtedy wprowadzić ponownie.';
  document.body.appendChild(p);
}
const pilnowany = n => /\.sqlite$/i.test(n);

/* ---------- „pliki” i „katalogi” ---------- */
function plik(folderId, nazwa, meta) {
  let id = meta ? meta.id : null;
  return {kind: 'file', name: nazwa,
    async getFile() {
      if (!id) { const e = new Error('Nie ma: ' + nazwa); e.name = 'NotFoundError'; throw e; }
      const m = await (await zapytaj(`${API}/${id}?fields=${POLA}`)).json();
      const b = await (await zapytaj(`${API}/${id}?alt=media`)).blob();
      if (pilnowany(nazwa)) znanyCzas.set(id, m.modifiedTime);
      return new File([b], nazwa, {lastModified: Date.parse(m.modifiedTime) || Date.now()});
    },
    async createWritable() {
      const czesci = [];
      return {
        async write(d) { czesci.push(d instanceof Blob ? d : new Blob([d])); },
        async close() {
          const dane = new Blob(czesci);
          if (konflikt && pilnowany(nazwa)) throw new Error('Zapis wstrzymany – dane zmieniono na innym urządzeniu. Odśwież program (F5).');
          if (!id) {                                   // nowy plik
            const m = await utworz({name: nazwa, parents: [folderId]}, dane);
            id = m.id; pamiec.set(folderId + '/' + nazwa, m);
            if (pilnowany(nazwa)) znanyCzas.set(id, m.modifiedTime);
            return;
          }
          if (pilnowany(nazwa) && znanyCzas.has(id)) {
            const m = await (await zapytaj(`${API}/${id}?fields=modifiedTime`)).json();
            if (m.modifiedTime !== znanyCzas.get(id)) { pokazKonflikt(); throw new Error('Zapis wstrzymany – dane zmieniono na innym urządzeniu. Odśwież program (F5).'); }
          }
          const m = await (await zapytaj(`${UPL}/${id}?uploadType=media&fields=${POLA}`, {method: 'PATCH', headers: {'Content-Type': 'application/octet-stream'}, body: dane})).json();
          if (pilnowany(nazwa)) znanyCzas.set(id, m.modifiedTime);
        },
      };
    },
  };
}
const pamiec = new Map();        // „folderId/nazwa” → metadane (mniej zapytań do Dysku)
const zamki = new Map();         // żeby dwa równoczesne zapisy nie utworzyły dwóch plików o tej samej nazwie
async function znajdz(folderId, nazwa) {
  const k = folderId + '/' + nazwa;
  if (pamiec.has(k)) return pamiec.get(k);
  const f = (await lista(`${cytuj(folderId)} in parents and name = ${cytuj(nazwa)} and trashed = false`))[0] || null;
  if (f) pamiec.set(k, f);
  return f;
}
function wZamku(k, fn) { const p = (zamki.get(k) || Promise.resolve()).then(fn, fn); zamki.set(k, p.catch(() => {})); return p; }

function katalog(id, nazwa) {
  return {kind: 'directory', name: nazwa, id,
    async getFileHandle(n, o = {}) {
      const f = await znajdz(id, n);
      if (f && f.mimeType === FOLDER) throw new TypeError(n + ' to folder');
      if (!f && !o.create) { const e = new Error('Nie ma: ' + n); e.name = 'NotFoundError'; throw e; }
      return plik(id, n, f);
    },
    async getDirectoryHandle(n, o = {}) {
      return wZamku(id + '/' + n, async () => {
        let f = await znajdz(id, n);
        if (f && f.mimeType !== FOLDER) throw new TypeError(n + ' to plik');
        if (!f) {
          if (!o.create) { const e = new Error('Nie ma folderu: ' + n); e.name = 'NotFoundError'; throw e; }
          f = await utworz({name: n, mimeType: FOLDER, parents: [id]}); pamiec.set(id + '/' + n, f);
        }
        return katalog(f.id, n);
      });
    },
    async *entries() {
      for (const f of await lista(`${cytuj(id)} in parents and trashed = false`)) {
        pamiec.set(id + '/' + f.name, f);
        yield [f.name, f.mimeType === FOLDER ? katalog(f.id, f.name) : plik(id, f.name, f)];
      }
    },
    async removeEntry(n) {       // do kosza Dysku Google (da się odzyskać przez 30 dni)
      const f = await znajdz(id, n); if (!f) return;
      await zapytaj(`${API}/${f.id}?fields=id`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({trashed: true})});
      pamiec.delete(id + '/' + n);
    },
    async requestPermission() { return 'granted'; }, async queryPermission() { return 'granted'; },
  };
}

// główny folder programu na Dysku: szukamy po znaczniku (appProperties), a gdy go nie ma – zakładamy
async function folderGlowny(zakladaj) {
  const f = (await lista(`appProperties has { key='manhattan' and value='dane' } and trashed = false`))[0];
  if (f) return katalog(f.id, f.name);
  if (!zakladaj) return null;
  const n = await utworz({name: NAZWA_GLOWNEGO, mimeType: FOLDER, appProperties: {manhattan: 'dane'}});
  return katalog(n.id, n.name);
}
async function kontoEmail() {
  try { const j = await (await zapytaj('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)')).json();
    try { localStorage.setItem('manhattan_konto', j.user.emailAddress); } catch {}
    return j.user.emailAddress; } catch { return ''; }
}

/* ---------- przeniesienie danych z laptopa (folder Manhattan\Dokumenty na MEGA) ----------
   Kopiuje tylko bieżące dane: obie bazy, plik dla Worda i PDF-y faktur. Starych kopii i archiwów nie przenosi
   (zostają na MEGA). Na laptopie w folderze „Program Manhattan” zostawia informację, że dane są już na Dysku Google. */
async function przeniesZLaptopa(info) {
  if (!window.showDirectoryPicker) throw new Error('Przeniesienie danych działa w Microsoft Edge albo Google Chrome na laptopie.');
  const lok = await window.showDirectoryPicker({id: 'manhattan-przenies', mode: 'readwrite'});
  let lk, lr;
  try { lk = await lok.getDirectoryHandle('Księga udziałów'); lr = await lok.getDirectoryHandle('RapKas'); }
  catch { throw new Error(`W folderze „${lok.name}” nie ma podfolderów „Księga udziałów” i „RapKas”. Wskaż folder Manhattan\\Dokumenty.`); }
  const czytaj = async (k, n) => { try { return await (await k.getFileHandle(n)).getFile(); } catch { return null; } };
  const ksiega = await czytaj(lk, 'ksiega.sqlite'), kasa = await czytaj(lr, 'rapkas.sqlite');
  if (!ksiega || !kasa) throw new Error('Nie znalazłem plików ksiega.sqlite i rapkas.sqlite we wskazanym folderze.');
  const gl = await folderGlowny(true);
  const gk = await gl.getDirectoryHandle('Księga udziałów', {create: true}), gr = await gl.getDirectoryHandle('RapKas', {create: true});
  for (const [k, n] of [[gk, 'ksiega.sqlite'], [gr, 'rapkas.sqlite']]) {
    try { await k.getFileHandle(n); throw Object.assign(new Error(`Na Dysku Google jest już plik ${n} – nie nadpisuję go.`), {juz: true}); }
    catch (e) { if (e.juz) throw e; }
  }
  const zapisz = async (k, n, b) => { const w = await (await k.getFileHandle(n, {create: true})).createWritable(); await w.write(b); await w.close(); };
  info('Przenoszę Księgę udziałów…'); await zapisz(gk, 'ksiega.sqlite', ksiega);
  const word = await czytaj(lk, 'Księga udziałów - dane do Worda.xlsx'); if (word) await zapisz(gk, word.name, word);
  info('Przenoszę kasę…'); await zapisz(gr, 'rapkas.sqlite', kasa);
  let pdf = 0;
  try {
    const lf = await lr.getDirectoryHandle('Faktury'), gf = await gr.getDirectoryHandle('Faktury', {create: true});
    for await (const [n, h] of lf.entries()) if (h.kind === 'file' && /\.pdf$/i.test(n)) { info(`Przenoszę faktury PDF… (${++pdf})`); await zapisz(gf, n, await h.getFile()); }
  } catch {}
  try {
    const pm = await lok.getDirectoryHandle('Program Manhattan');
    await zapisz(pm, 'DANE PRZENIESIONE NA DYSK GOOGLE.txt', new Blob(['﻿' +
      `Dnia ${new Date().toLocaleString('pl-PL')} dane programu Manhattan zostały przeniesione na Dysk Google\r\n` +
      `(folder „${NAZWA_GLOWNEGO}”). Od tej chwili pracuj w programie otwieranym ze strony GitHub.\r\n` +
      'Pliki ksiega.sqlite i rapkas.sqlite w tym folderze MEGA NIE są już aktualizowane – zostają jako kopia z dnia przeniesienia.\r\n']));
  } catch {}
  return {pdf};
}

window.DYSK = {zaloguj, wyloguj, kontoEmail, folderGlowny, przeniesZLaptopa, NAZWA_GLOWNEGO};
})();
