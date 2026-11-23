#!/usr/bin/env python3
"""Buduje index.html (wersja z Dyskiem Google) z Manhattan.html (wersja lokalna, MEGA).

Użycie:  python3 narzedzia/zbuduj.py <ścieżka do Manhattan.html>  [wynik: index.html]
Każda zmiana to dokładna zamiana tekstu – jeśli w nowej wersji Manhattan.html
któryś fragment się zmienił, skrypt zatrzyma się i powie który.
"""
import sys, pathlib

zrodlo = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
wynik = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'index.html')

ZMIANY = [
# 1. nagłówek strony: ikona na telefonie, tryb pełnoekranowy, logowanie Google, obsługa Dysku
('<meta name="viewport" content="width=device-width, initial-scale=1">',
 '''<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#1f2329">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Manhattan">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="Manhattan.ico">
<link rel="apple-touch-icon" href="ikona-180.png">
<script src="config.js"></script>
<script src="https://accounts.google.com/gsi/client" async></script>
<script src="dysk.js"></script>'''),

# 2. pasek stanu na iPhonie (wycięcie ekranu) – odstęp u góry w trybie pełnoekranowym
('#powitanie, #logowanie { background:var(--pow); border-color:var(--brd); }',
 '#powitanie, #logowanie { background:var(--pow); border-color:var(--brd); }\n'
 'body { padding-top:env(safe-area-inset-top); }\n#konto { color:var(--txt2); font-size:12px; margin-left:8px; }\n'
 '#konto a { color:var(--txt2); }'),

# 3. ekran startowy
('''  <p>Kasa (RapKas) i Księga udziałów w jednym programie.<br>Dane zostają w swoich plikach: <i>Dokumenty\\RapKas\\rapkas.sqlite</i> i <i>Dokumenty\\Księga udziałów\\ksiega.sqlite</i>.</p>
  <p>Przy pierwszym uruchomieniu wskaż folder <b>Manhattan\\Dokumenty</b> (ten, w którym są foldery „RapKas” i „Księga udziałów”).</p>''',
 '''  <p>Kasa (RapKas) i Księga udziałów w jednym programie.</p>
  <p id="opisStartu">Dane programu są na Twoim Dysku Google, w folderze „Manhattan – dane programu”.<br>Zaloguj się kontem Google, na którym są te dane.</p>'''),

('<p class="muted">Nie pamiętasz hasła? Zobacz „README.md” w folderze „Program Manhattan”.</p>',
 '<p class="muted">Nie pamiętasz hasła? Zobacz README w repozytorium programu na GitHubie (część „Zapomniane hasło”).</p>'),

# 4. w nagłówku: konto Google i wylogowanie
('<button id="btnBlokuj" class="hidden" title="Zablokuj program (wymaga ponownego zalogowania)">🔒 <span id="kto"></span></button></div>',
 '<button id="btnBlokuj" class="hidden" title="Zablokuj program (wymaga ponownego zalogowania)">🔒 <span id="kto"></span></button><span id="konto"></span></div>'),

# 5. faktury: PDF-y dodane przyciskiem zapisują się też w folderze RapKas/Faktury na Dysku
('''    inp.onchange = async () => { const pl = []; for (const f of inp.files) pl.push({ name:f.name, bytes:new Uint8Array(await f.arrayBuffer()) }); const r = await wczytajFaktury(pl); viewFaktury(); msg(r); }; inp.click(); };''',
 '''    inp.onchange = async () => { const pl = []; for (const f of inp.files) pl.push({ name:f.name, bytes:new Uint8Array(await f.arrayBuffer()) });
      const r = await wczytajFaktury(pl);
      if (dirHandle) { try { const fd = await dirHandle.getDirectoryHandle(FAKTURY_DIR, { create:true });   // kopia PDF-ów w RapKas\\Faktury
        for (const p of pl) { const w = await (await fd.getFileHandle(p.name, { create:true })).createWritable(); await w.write(p.bytes); await w.close(); } }
        catch (e) { r.bledy.push('Nie zapisano kopii PDF w folderze Faktury: ' + e.message); } }
      viewFaktury(); msg(r); }; inp.click(); };'''),

('<p class="muted">Wrzuć PDF-y faktur z Subiekta do folderu <b>RapKas\\\\Faktury</b> i kliknij „Wczytaj nowe”.',
 '<p class="muted">Kliknij <b>„Dodaj pliki PDF…”</b> i wskaż faktury wyeksportowane z Subiekta (można zaznaczyć kilka naraz) – kopia PDF-ów trafi do folderu RapKas\\\\Faktury na Dysku Google.'),
('<button class="b" id="fScan">⟳ Wczytaj nowe z folderu „Faktury”</button>\n    <button class="b sec" id="fAdd">Dodaj pliki PDF…</button>',
 '<button class="b" id="fAdd">Dodaj pliki PDF…</button>\n    <button class="b sec" id="fScan">⟳ Sprawdź folder „Faktury”</button>'),

# 6. start programu: najpierw logowanie Google, potem dane z Dysku
('''  const btn = el('btnStart');
  if (SERWER) {''',
 '''  const btn = el('btnStart');
  if (window.DYSK && location.protocol === 'https:') { await startDysk(btn); return; }
  if (SERWER) {'''),

('''let SQL;
window.SHELL._start = async (sql, dir) => { SQL = sql; await start(dir); };''',
 '''/* ---- wersja z GitHuba: logowanie Google, dane na Dysku Google (dysk.js) ---- */
async function startDysk(btn) {
  el('inny').classList.add('hidden');
  const info = t => { el('info').textContent = t; };
  const pokazKonto = mail => {
    el('konto').innerHTML = `${mail ? mail.replace(/[&<>"]/g, '') + ' · ' : ''}<a href="#" id="wylogujG">wyloguj Google</a>`;
    el('wylogujG').onclick = e => { e.preventDefault(); if (!confirm('Wylogować z konta Google? Program się zamknie.')) return;
      DYSK.wyloguj(); location.reload(); };
  };
  const otworz = async () => {
    btn.disabled = true; info('Łączę z Dyskiem Google…');
    try {
      await DYSK.zaloguj();
      const mail = await DYSK.kontoEmail();
      const gl = await DYSK.folderGlowny(false);
      let gotowe = false;
      if (gl) { try { await (await gl.getDirectoryHandle(DIR_K)).getFileHandle('ksiega.sqlite'); await (await gl.getDirectoryHandle(DIR_R)).getFileHandle('rapkas.sqlite'); gotowe = true; } catch {} }
      if (!gotowe) {
        el('opisStartu').innerHTML = `Na Dysku Google konta <b>${mail.replace(/[&<>"]/g, '')}</b> nie ma jeszcze danych programu.<br>` +
          'Przenieś je z laptopa: kliknij przycisk i wskaż folder <b>D:\\\\MegaSync\\\\Manhattan\\\\Dokumenty</b>. Przeglądarka zapyta o zgodę – kliknij „Wyświetl pliki” i „Zapisz zmiany”.';
        btn.textContent = 'Przenieś dane z laptopa na Dysk Google'; btn.disabled = false; info('');
        btn.onclick = async () => {
          btn.disabled = true;
          try { const r = await DYSK.przeniesZLaptopa(info);
            info(`Przeniesiono obie bazy${r.pdf ? ` i ${r.pdf} faktur PDF` : ''}. Otwieram program…`); await otworz(); }
          catch (e) { btn.disabled = false; if (e.name !== 'AbortError') info(e.message); else info(''); }
        };
        return;
      }
      pokazKonto(mail);
      await start(gl);
    } catch (e) { btn.disabled = false; btn.textContent = 'Zaloguj kontem Google'; btn.onclick = otworz; info(e.message); }
  };
  btn.textContent = 'Zaloguj kontem Google'; btn.disabled = false; btn.onclick = otworz;
  try { if (sessionStorage.getItem('manhattan_g')) await otworz(); } catch {}      // odświeżenie strony – bez ponownego klikania
}

let SQL;
window.SHELL._start = async (sql, dir) => { SQL = sql; await start(dir); };'''),
]

for stare, nowe in ZMIANY:
    n = zrodlo.count(stare)
    if n != 1:
        sys.exit(f'BŁĄD: fragment występuje {n} razy (powinien raz):\n{stare[:200]}')
    zrodlo = zrodlo.replace(stare, nowe)

wynik.write_text(zrodlo, encoding='utf-8')
print('Zapisano', wynik)
