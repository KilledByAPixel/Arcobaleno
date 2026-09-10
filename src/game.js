// ============================================================
// ARCOBALENO game: screens, round runner, 7 mini games,
// SRS, daily loop, unicorn, sound, speech.
// ============================================================
'use strict';

const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);

// ---------- save ----------
let S = null;
function save() { try { localStorage.setItem('arco', JSON.stringify(S)); } catch (e) { } }
// merged over the defaults, so a field added later (rb, lp) exists in an old save
function load() { try { return { ...freshSave(), ...JSON.parse(localStorage.getItem('arco')) }; } catch (e) { return null; } }
function freshSave() {
  return { v: 1, pg: '', uni: 'Baleno', snd: 1, day: today(), arcs: [0, 0, 0, 0, 0, 0, 0], streak: 0, rb: 0, lastFull: -9, lp: -9, lvl: [1, 1, 1, 1, 1, 1, 1], it: {} };
}

// ---------- audio ----------
let AC = null;
function initAudio() {
  if (!AC) try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
  try { const u = new SpeechSynthesisUtterance(''); speechSynthesis.speak(u); } catch (e) { }
}
function tone(f, t = 0, d = .09, type = 'sine', v = .18) {
  if (!AC || !S.snd) return;
  const o = AC.createOscillator(), g = AC.createGain(), s = AC.currentTime + t;
  o.type = type; o.frequency.value = f; o.connect(g); g.connect(AC.destination);
  g.gain.setValueAtTime(v, s); g.gain.exponentialRampToValueAtTime(.001, s + d);
  o.start(s); o.stop(s + d);
}
const sfxOk = c => { const b = 440 * Math.pow(1.06, Math.min(c, 12)); tone(b); tone(b * 1.5, .08); };
const sfxNo = () => tone(170, 0, .18, 'square', .1);
const sfxArc = () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * .09, .14, 'triangle'));
const sfxRainbow = () => [523, 587, 659, 784, 880, 1046, 1174, 1568].forEach((f, i) => tone(f, i * .11, .2, 'triangle', .15));

// ---------- speech ----------
let VOICE = null;
function initVoice() {
  // Best available Italian voice, or null for the browser default. Speech is
  // attempted either way; this only decides how good it sounds. Chrome often
  // returns [] on the first call and fires voiceschanged later, so repaint home
  // when one finally turns up or the no-voice notice would never clear.
  const f = () => {
    const had = !!VOICE;
    VOICE = (speechSynthesis.getVoices() || []).find(v => /^it/i.test(v.lang)) || null;
    if (!had && VOICE && document.querySelector('.games')) showHome();
  };
  try { f(); speechSynthesis.onvoiceschanged = f; } catch (e) { }
}
// force: an explicit tap on a speaker button speaks even when sound is muted, so a
// muted player can still play Ascolto. Auto-play on show keeps respecting the mute.
function say(t, rate, force) {
  if (!(S.snd || force) || !t) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t.replace(/_/g, ''));
    u.voice = VOICE; u.lang = 'it-IT'; u.rate = rate || .9;
    speechSynthesis.speak(u);
  } catch (e) { }
}

// ---------- unicorn phrases ----------
const bravo = () => S.pg == 'f' ? 'Brava!' : 'Bravo!';
const PRAISE = () => [bravo(), 'Perfetto!', 'Benissimo!', 'Che bello!', 'Ottimo!', 'Sì!'];
const OOPS = ['Quasi!', 'Riprova!', 'Quasi quasi...', 'La prossima volta!'];

// ---------- games ----------
const GAMES = [
  { name: 'Parole', cn: 'rosso', c: '#e84855', ic: '💬', gen: genParole },
  { name: 'Articoli', cn: 'arancione', c: '#f9844a', ic: '🏷️', gen: genArticoli },
  { name: 'Numeri', cn: 'giallo', c: '#eec500', ic: '🔢', gen: genNumeri },
  { name: 'Verbi', cn: 'verde', c: '#2bb673', ic: '✍️', gen: genVerbi },
  { name: 'Frasi', cn: 'azzurro', c: '#38b6ff', ic: '🧩', gen: genFrasi },
  { name: 'Ascolto', cn: 'indaco', c: '#5560d9', ic: '🔊', gen: genAscolto },
  { name: 'Ripasso', cn: 'violetto', c: '#9b5de5', ic: '🔁', gen: genRipasso },
];

// ---------- SRS (Leitner boxes) ----------
const GAP = [0, 1, 2, 4, 8, 16];
function rec(item, ok) {
  if (!item) return;
  const e = S.it[item] || { b: 0, d: 0 };
  e.b = ok ? Math.min(5, e.b + 1) : 0;
  e.d = today() + GAP[e.b];
  S.it[item] = e; save();
}

// ---------- question generators ----------
// SAY IT ONCE: okSay is spoken when the player answers correctly, and nothing speaks
// on show. Ascolto inverts this -- it speaks on show (speakBtn/sayTxt) and sets no
// okSay -- because hearing the word first IS the question there.
let R = null;                                       // current round
function pickFresh(pool) {
  const p = pool.filter(w => !R || !R.used.has(w.it));
  return rnd(p.length ? p : pool);
}
function markUsed(k) { if (R) R.used.add(k); }

function genParole(lvl, target) {
  const pool = W.filter(w => w.lvl <= lvl && w.e && w.cat != 'agg');   // no picture = Articoli-only
  const w = target || pickFresh(pool.length ? pool : W.filter(x => x.e));
  markUsed(w.it);
  const item = 'w' + w.it, hard = lvl >= 3;
  if (w.e && Math.random() < .5) {                  // word -> emoji
    const wrong = wrongWords(w, 3, hard);
    return {
      mode: 0, word: w.it, sub: 'tocca il disegno giusto', item,
      choices: shuffle([{ t: w.e, e: 1, ok: 1 }, ...wrong.map(x => ({ t: x.e, e: 1 }))]),
      okSay: w.it
    };
  }
  const wrong = wrongWords(w, 3, hard);             // emoji/gloss -> word
  return {
    mode: 0, big: w.e, sub: 'tocca la parola giusta', item,
    choices: shuffle([{ t: w.it, ok: 1 }, ...wrong.map(x => ({ t: x.it }))]),
    okSay: w.it
  };
}

function genArticoli(lvl, target) {
  const pool = W.filter(w => w.lvl <= lvl && w.cat != 'agg' && w.cat != 'colori' && !/ /.test(w.it));
  const w = target || pickFresh(pool);
  markUsed(w.it);
  const item = 'a' + w.it;
  // Mass nouns have no plural, and the regular rule would invent one: "le fami",
  // "le seti", "i nuoti" are not words.
  const NOPL = { fame: 1, sete: 1, nuoto: 1 };
  // kinds: 0 singular, 1 plural, 2 indefinite, 3 preposizione articolata (ints: comparison code)
  let kinds = w.plOnly ? [1] : lvl >= 4 ? [0, 1, 2, 3] : lvl >= 3 ? [0, 1, 2] : lvl >= 2 ? [0, 1] : [0];
  if (NOPL[w.it]) kinds = kinds.filter(x => x != 1);
  const k = rnd(kinds);
  let shown = w.it, g = w.g, right, ch, sub = "tocca l'articolo giusto";
  if (k == 1) {
    shown = w.plOnly ? w.it : plural(w.it, w.g);
    if (PL_FEM[w.it]) g = 'f';
    right = art(shown, g, 1);
    ch = ['i', 'gli', 'le', rnd(['il', 'lo', 'la'])];
  } else if (k == 2) {
    right = indef(shown, g);
    ch = ['un', 'uno', 'una', "un'"];
  } else if (k == 3) {                              // a + il = ?  ->  al / allo / alla / all'
    const p = rnd(['a', 'di', 'in', 'su', 'da']), a = art(shown, g);
    right = prepArt(p, a); sub = p + ' + ' + a + ' = ?';
    ch = ['il', 'lo', 'la', "l'"].map(x => prepArt(p, x));
  } else {
    right = art(shown, g);
    ch = ['il', 'lo', 'la', "l'"];
  }
  return {
    // from level 5 the hint picture goes: by then the word itself has to carry it
    mode: 0, big: lvl > 4 ? '' : w.e, word: '__ ' + shown, sub, item,
    choices: shuffle(ch.map(t => ({ t, ok: t == right }))),
    okSay: joinArt(right, shown)
  };
}

const fmtN = n => n.toLocaleString('it-IT');
const N_RANGE = [[0, 10], [0, 20], [0, 100], [0, 1000], [0, 9999], [0, 999999]];
const nBand = n => n <= 10 ? 0 : n <= 20 ? 1 : n <= 100 ? 2 : n <= 1000 ? 3 : 4;
function numParts(n) {
  const p = [], k = n / 1000 | 0, r3 = n % 1000;
  if (k) { if (k == 1) p.push('mille'); else { p.push(...(k < 20 ? [NU[k]] : numParts(k)), 'mila'); } }
  const h = r3 / 100 | 0, r = r3 % 100;
  if (h) { if (h > 1) p.push(NU[h]); p.push('cento'); }
  if (r) { if (r < 20) p.push(NU[r]); else { p.push(NT[r / 10 | 0]); if (r % 10) p.push(NU[r % 10]); } }
  return p;
}
function genNumeri(lvl, forceN) {
  const [lo, hi] = N_RANGE[Math.min(lvl, 6) - 1];
  let n = forceN != null ? forceN : lo + (Math.random() * (hi - lo + 1) | 0);
  const asmOk = m => m >= 20 && !/[138]/.test('' + m);
  if (forceN == null && lvl >= 3 && Math.random() < .4) {   // assemble mode
    let guard = 50;
    while (!asmOk(n) && guard--) n = lo + (Math.random() * (hi - lo + 1) | 0);
    if (asmOk(n)) {
      // three significant figures at most: 744065 was five non-zero digits, a long tile
      // run and a 43-letter answer. Rounding also replaces the old "not a round hundred"
      // rule, which existed to stop two-tile giveaways.
      n = sig(n, 3);
      const parts = numParts(n);
      const extra = shuffle([...NT.slice(2), 'cento', ...NU.slice(2, 10)].filter(x => x && !parts.includes(x))).slice(0, 2);
      return {
        mode: 1, word: fmtN(n), sub: 'componi il numero', item: 'n' + nBand(n),
        tiles: shuffle([...parts, ...extra]), slots: parts.length, answer: num(n), joiner: '',
        okSay: num(n)
      };
    }
  }
  let wrong;
  if (forceN == null && lvl >= 5 && Math.random() < .35) {   // milioni, pick mode, top levels only.
    // Deliberately simple: a round million at 5 (due milioni), plus at most a round
    // hundred-thousand at 6 (tre milioni cinquecentomila). Arbitrary remainders spell
    // out into an unreadable wall of letters, and no miliardi -- num() still spells
    // them, the game just never asks.
    const big = () => (1 + Math.random() * 9 | 0) * 1e6 + (lvl > 5 ? (Math.random() * 10 | 0) * 1e5 : 0);
    n = big(); wrong = [];
    while (wrong.length < 3) { const t = big(); if (t != n && !wrong.includes(t)) wrong.push(t); }
  } else {
    // Pick mode rounds to TWO SIGNIFICANT FIGURES, which caps every prompt at two
    // non-zero digits however big it is: 456789 -> 450000, quattrocentocinquantamila.
    // That solves both halves of the problem at once. A long number spells out to ~50
    // letters with nowhere to break, and distractors one apart differ in three of
    // them, so four of those was a spot-the-difference puzzle rather than a reading
    // test. Stepping the distractors by the same magnitude keeps them 2 s.f. too.
    // Assemble mode still draws the full unrounded range: a complex number belongs
    // there, where it is built from parts rather than read off a tile.
    const step = 10 ** Math.max(0, ('' + n).length - 2);
    n = sig(n);
    wrong = wrongNums(n, lo, hi, step);
  }
  if (Math.random() < .5)
    return {                                        // numeral -> word
      mode: 0, word: fmtN(n), sub: 'tocca il numero giusto', item: 'n' + nBand(n),
      choices: shuffle([{ t: hy(num(n)), ok: 1 }, ...wrong.map(x => ({ t: hy(num(x)) }))]),
      okSay: num(n)
    };
  return {                                          // word -> numeral
    mode: 0, mid: hy(num(n)), sub: 'tocca la cifra giusta', item: 'n' + nBand(n),
    choices: shuffle([{ t: fmtN(n), ok: 1 }, ...wrong.map(x => ({ t: fmtN(x) }))]),
    okSay: num(n)
  };
}

function genVerbi(lvl, tv, tt) {
  const tenses = lvl >= 5 ? [0, 1, 2, 3] : lvl == 4 ? [0, 1, 2] : lvl == 3 ? [0, 1] : [0];
  const t = tt != null ? tt : rnd(tenses);
  const pool = lvl == 1 ? V.filter(v => v.lvl == 1 && !v.irr && !v.isc && v.inf.endsWith('are'))
    : V.filter(v => v.lvl <= lvl);
  const v = tv || pickFresh(pool.map(x => ({ it: x.inf, v: x }))).v || rnd(pool);
  markUsed(v.inf);
  // Third person only, and a SINGLE allowed person also means "print no pronoun":
  // a weather verb takes no subject in Italian ("piove", never "lui piove"), and
  // costare is here because "lei è costata" reads as a person, not a price.
  const IMPERS = { piacere: [2, 5], piovere: [2], nevicare: [2], costare: [2] };
  const p = IMPERS[v.inf] ? rnd(IMPERS[v.inf]) : Math.random() * 6 | 0;
  const pron = IMPERS[v.inf] && IMPERS[v.inf].length == 1 ? ''
    : p == 2 ? rnd(['lui', 'lei']) : P_IT[p];
  const g = pron == 'lei' ? 'f' : p < 2 ? S.pg : 'm';
  const right = conj(v, p, t, g);
  const ch = [{ t: right, ok: 1 }];
  let guard = 40;
  while (ch.length < 4 && guard--) {
    const useT = tenses.length > 1 && Math.random() < .3 ? rnd(tenses) : t;
    const pp = IMPERS[v.inf] && guard > 20 ? rnd([2, 5]) : Math.random() * 6 | 0;
    const f = conj(v, pp, useT, g);
    if (!ch.some(c => c.t == f)) ch.push({ t: f });
  }
  return {
    mode: 0, mid: (pron && pron + ' ') + '___', word2: v.inf + ' · ' + TENSE_IT[t],
    sub: 'tocca la forma giusta', item: 'v' + v.inf + 't' + t,
    choices: shuffle(ch), okSay: (pron && pron + ' ') + right, big: lvl > 4 ? '' : v.e
  };
}

function genFrasi(lvl) {
  const s = genSentence(Math.max(1, Math.min(3, lvl)));
  let tray = s.tiles.slice();
  if (lvl >= 3) {                                   // one distractor tile
    const d = rnd(['non', pres(rnd(V.filter(v => v.lvl == 1)), 2), rnd(['il', 'la', 'i', 'le'])]);
    if (!tray.includes(d)) tray.push(d);
  }
  return {
    mode: 1, big: s.emo, word2: s.tn ? TENSE_IT[s.tn] : '', sub: 'componi la frase', item: null,   // the tense is labelled like Verbi
    tiles: shuffle(tray), slots: s.tiles.length, answer: s.tiles.join(' '), joiner: ' ',
    okSay: s.say
  };
}

function genAscolto(lvl) {
  if (lvl >= 3 && Math.random() < .3) {             // hear a whole sentence -> assemble it, no picture
    const s = genSentence(Math.min(3, lvl));         // same generator as Frasi, so plurals etc. apply here too
    return {
      mode: 1, speakBtn: 1, sayTxt: s.say, sub: 'componi la frase', item: null,
      tiles: shuffle(s.tiles), slots: s.tiles.length, answer: s.tiles.join(' '), joiner: ' '
    };
  }
  if (Math.random() < .55) {                        // hear word -> pick emoji
    const pool = W.filter(w => w.lvl <= lvl && w.e && w.cat != 'agg' && w.cat != 'colori');
    const w = pickFresh(pool); markUsed(w.it);
    const wrong = wrongWords(w, 3, lvl >= 3);
    return {
      mode: 0, speakBtn: 1, sayTxt: w.it, sub: 'ascolta e tocca il disegno', item: 'w' + w.it,
      choices: shuffle([{ t: w.e, e: 1, ok: 1 }, ...wrong.map(x => ({ t: x.e, e: 1 }))]),
      hint: w.it
    };
  }
  const [lo, hi] = N_RANGE[Math.min(lvl + 1, 4) - 1];     // hear number -> pick numeral
  const n = lo + (Math.random() * (hi - lo + 1) | 0);
  const wrong = wrongNums(n, lo, hi);
  return {
    mode: 0, speakBtn: 1, sayTxt: num(n), sub: 'ascolta e tocca la cifra', item: 'n' + nBand(n),
    choices: shuffle([{ t: fmtN(n), ok: 1 }, ...wrong.map(x => ({ t: fmtN(x) }))]),
    hint: num(n)
  };
}

function genRipasso(lvl) {
  const d = today();
  let keys = Object.keys(S.it).filter(k => S.it[k].d <= d && !R.used.has('#' + k));
  if (!keys.length)
    keys = Object.keys(S.it).filter(k => !R.used.has('#' + k))
      .sort((a, b) => S.it[a].b - S.it[b].b).slice(0, 8);
  if (!keys.length) return genParole(lvl);
  const k = rnd(keys); R.used.add('#' + k);
  let m;
  // keys carry the WORD, not its index into W: an index key silently points at a
  // different word the moment words.tsv is edited, which scrambles every saved
  // review. A key whose word no longer ships just falls through to a fresh pick.
  if (m = k.match(/^w(.+)/)) return genParole(lvl, W.find(w => w.it == m[1]));
  if (m = k.match(/^a(.+)/)) return genArticoli(lvl, W.find(w => w.it == m[1]));
  if (m = k.match(/^v(.+)t(\d)$/)) return genVerbi(lvl, verbByInf[m[1]], +m[2]);
  if (m = k.match(/^n(\d)$/)) { const [lo, hi] = N_RANGE[+m[1]]; return genNumeri(2 + +m[1], lo + (Math.random() * (hi - lo + 1) | 0)); }
  return genParole(lvl);
}

// ---------- round runner ----------
// tints the page with the current game's colour; bg() restores the home sky
// the ,#fff layer matters: js13k embeds the game in an iframe, whose canvas is
// transparent, so an alpha tint alone let the host page show through
function bg(c) { document.body.style.background = c ? `linear-gradient(${c}40,${c}10) fixed,#fff` : ''; }
function startRound(gi) {
  bg(GAMES[gi].c);
  R = { gi, pos: 0, count: 0, results: [], combo: 0, comboMax: 0, used: new Set(), queue: [] };
  const lvl = S.lvl[gi];
  if (gi == 0) {                                    // teach up to 2 new words first
    const fresh = W.filter(w => w.lvl <= lvl && w.e && w.cat != 'agg' && !S.it['w' + w.it]);
    shuffle(fresh).slice(0, 2).forEach(w => {
      R.used.add(w.it);
      R.queue.push({ mode: 2, w });
      R.queue.push({ ...genParole(lvl, w), count: 1 });
    });
  }
  while (R.queue.filter(q => q.count).length < 10)
    R.queue.push({ ...GAMES[gi].gen(lvl), count: 1 });
  renderQ();
}

function dotsHtml() {
  let h = '';
  for (let i = 0; i < 10; i++)
    h += `<div class="dot ${R.results[i] || ''} ${i == R.count ? 'cur' : ''}"></div>`;
  return h;
}
function uniCorner(msg) {
  return `<div class=runi id=runi>🦄</div><div class=rbubble id=rbub ${msg ? '' : 'hidden'}>${msg || ''}</div>`;
}

function renderQ() {
  const q = R.queue[R.pos];
  if (!q) return endRound();
  window.__test = { q, R, S };                      // dev hook for automated playtests
  if (q.mode == 2) {
    document.querySelector('#app').innerHTML = `
      <div class=rtop><button class=iconbtn id=back>✕</button><div class=dots>${dotsHtml()}</div><div class=combo></div></div>
      <div class="card teach fade">
        <div class=muted>✨ Nuova parola!</div>
        <div class=big>${q.w.e}</div>
        <div class=word>${joinArt(art(q.w.it, q.w.g, q.w.plOnly), q.w.it)}</div>
        <button class="speak" id=sp>🔊</button>
      </div>
      <div style="margin-top:14px"><button class=btn id=go>Ok! ➜</button></div>
      ${uniCorner('Nuova parola!')}`;
    say(joinArt(art(q.w.it, q.w.g, q.w.plOnly), q.w.it));
    document.querySelector('#sp').onclick = () => say(q.w.it, .6, 1);
    document.querySelector('#go').onclick = () => { R.pos++; renderQ(); };
    document.querySelector('#back').onclick = quitRound;
    return;
  }
  const prompt = `
    ${q.big ? `<div class=big>${q.big}</div>` : ''}
    ${q.word ? `<div class=word say>${q.word}</div>` : ''}
    ${q.mid ? `<div class=mid say>${q.mid}</div>` : ''}
    ${q.word2 ? `<div class=muted>${q.word2}</div>` : ''}
    ${q.speakBtn ? `<button class="speak big" id=sp>🔊</button>` : ''}
    <div class=muted>${q.sub || ''}</div>`;
  let body;
  if (!q.mode) {
    body = `<div class=picks>${q.choices.map((c, i) =>
      `<button class="tile ${c.e ? 'emojiTile' : ''}" data-i=${i}>${c.t}</button>`).join('')}</div>`;
  } else {
    q.placed = Array(q.slots).fill(-1);
    body = `<div class=slots id=slots></div><div class=tray id=tray>${q.tiles.map((t, i) =>
      `<button class=tile data-i=${i}>${t}</button>`).join('')}</div>`;
  }
  document.querySelector('#app').innerHTML = `
    <div class=rtop><button class=iconbtn id=back>✕</button><div class=dots>${dotsHtml()}</div><div class=combo>${R.combo > 1 ? '🔥' + R.combo : ''}</div></div>
    <div class=mid-wrap><div class="card fade"><div class=prompt>${prompt}</div>${body}</div>
    <div class=hintrow>
      ${q.hint ? `<button class=hint id=hint>💡 aiuto</button>` : '<span></span>'}
      <span class=hinttext id=hinttext></span>
      <button class=hint id=skip>⏭️</button>
    </div></div>
    ${uniCorner()}`;
  document.querySelector('#back').onclick = quitRound;
  // first play at .9, every replay slow at .6; the button turns into 🐢 so the player knows
  if (q.speakBtn) {
    let n = 0; const b = document.querySelector('#sp');
    const f = k => { if (S.snd || k) { say(q.sayTxt, n++ ? .6 : .9, k); b.textContent = '🐢'; } };
    b.onclick = () => f(1); setTimeout(f, 350);
  }
  if (q.hint) document.querySelector('#hint').onclick = () => { document.querySelector('#hinttext').textContent = q.hint; R.combo = 0; };
  document.querySelector('#skip').onclick = () => { if (!q.answered) { reveal(q); settle(q, 0); } };
  document.querySelectorAll('.say').forEach(el => el.onclick = () => say(el.textContent));
  if (!q.mode)
    document.querySelectorAll('.picks .tile').forEach(el => el.onclick = () => answerPick(q, +el.dataset.i, el));
  else { drawSlots(q); document.querySelectorAll('.tray .tile').forEach(el => el.onclick = () => tapTray(q, +el.dataset.i, el)); }
}

function uniSay(msg, happy) {
  const b = document.querySelector('#rbub'), u = document.querySelector('#runi');
  if (u && happy) { u.classList.add('happy'); setTimeout(() => u.classList.remove('happy'), 400); }
  if (b) { b.textContent = msg; b.hidden = false; }
}

function settle(q, ok) {
  q.answered = 1;
  if (ok) {
    R.combo++; R.comboMax = Math.max(R.comboMax, R.combo);
    sfxOk(R.combo); uniSay(rnd(PRAISE()), 1);
    say(q.okSay);
    rec(q.item, !q.wasWrong);
  } else {
    R.combo = 0; sfxNo(); uniSay(rnd(OOPS));
    rec(q.item, false);
    R.queue.push({ ...q, answered: 0, wasWrong: 1, count: 0 });
  }
  if (q.count) { R.results[R.count] = ok ? 'ok' : 'no'; R.count++; }
  setTimeout(() => { R.pos++; renderQ(); }, ok ? 800 : 1600);
}

// show the answer without scoring it: the correct tile for a pick, the answer text
// for an assemble. Used by a wrong answer and by the skip button.
function reveal(q) {
  if (q.mode) document.querySelector('#hinttext').textContent = q.answer;
  else document.querySelectorAll('.picks .tile').forEach((e, j) => { if (q.choices[j].ok) e.classList.add('right'); });
}
function answerPick(q, i, el) {
  if (q.answered) return;
  const ok = !!q.choices[i].ok;
  el.classList.add(ok ? 'right' : 'wrong');
  if (!ok) reveal(q);
  settle(q, ok);
}

function drawSlots(q) {
  document.querySelector('#slots').innerHTML = q.placed.map((ti, si) =>
    `<div class="slot ${ti >= 0 ? 'filled' : ''}" data-s=${si}>${ti >= 0 ? q.tiles[ti] : ''}</div>`).join('');
  document.querySelectorAll('.slot').forEach(el => el.onclick = () => {
    if (q.answered) return;
    const si = +el.dataset.s, ti = q.placed[si];
    if (ti >= 0) { q.placed[si] = -1; document.querySelector(`.tray .tile[data-i="${ti}"]`).classList.remove('used'); drawSlots(q); }
  });
}
function tapTray(q, i, el) {
  if (q.answered || el.classList.contains('used')) return;
  const si = q.placed.indexOf(-1);
  if (si < 0) return;
  q.placed[si] = i; el.classList.add('used'); drawSlots(q);
  if (q.placed.indexOf(-1) < 0) {                   // all slots full -> check
    const got = q.placed.map(ti => q.tiles[ti]).join(q.joiner);
    const ok = got == q.answer;
    document.querySelectorAll('.slot').forEach(e => e.classList.add(ok ? 'right' : 'wrong'));
    if (!ok) reveal(q);
    settle(q, ok);
  }
}

function quitRound() { R = null; showHome(); }

function endRound() {
  const gi = R.gi, ok = R.results.filter(r => r == 'ok').length;
  const lvl = S.lvl[gi];
  let dl = 0;
  if (ok >= 9) dl = (lvl <= 2 && ok == 10) ? 2 : 1;
  else if (ok <= 4 && lvl > 1) dl = -1;
  S.lvl[gi] = Math.max(1, Math.min(6, lvl + dl));
  S.arcs[gi] = 1;
  const full = S.arcs.every(a => a);
  let firstFull = false;
  if (S.lp != S.day) { S.streak++; S.lp = S.day; }             // 🔥 one round a day keeps it
  if (full && S.lastFull != S.day) { S.rb++; S.lastFull = S.day; firstFull = true; }   // 🌈 lifetime rainbows
  save();
  sfxArc();
  window.__test = { done: 1, S };
  const g = GAMES[gi];
  document.querySelector('#app').innerHTML = `
    <div class="card results fade">
      <div class=hero>${g.ic}</div>
      <h2 style="margin:4px 0">${g.name} ✓</h2>
      <div class=stat><span>✅ risposte giuste</span><b>${ok}/10</b></div>
      <div class=stat><span>🔥 combo migliore</span><b>${R.comboMax}</b></div>
      <div class=stat><span>📈 livello</span><b>${S.lvl[gi]}${dl > 0 ? ' ⬆️' : dl < 0 ? ' ⬇️' : ''}</b></div>
    </div>
    <div style="margin-top:14px"><button class=btn id=go>${full && firstFull ? '🌈 Arcobaleno!' : 'Continua ➜'}</button></div>
    ${uniCorner(dl > 0 ? 'Livello su! ' + bravo() : rnd(PRAISE()))}`;
  say(dl > 0 ? bravo() : 'Molto bene!');
  document.querySelector('#go').onclick = () => { R = null; showHome(full && firstFull); };
}

// ---------- home ----------
// Words the player has actually met: a Parole or an Articoli review key exists for them.
const known = () => W.filter(w => w.e && (S.it['w' + w.it] || S.it['a' + w.it]));
function rollover() {
  const d = today();
  if (S.day != d) {
    if (S.lp < d - 1) S.streak = 0;
    S.day = d; S.arcs = [0, 0, 0, 0, 0, 0, 0]; save();
  }
}
function showHome(celebrate) {
  bg();
  rollover();
  const done = S.arcs.filter(a => a).length;
  const arcs = GAMES.map((g, i) => {
    const D = 256 - i * 32;                          // must match .rb's 256x128 box
    return `<div class="arc ${S.arcs[i] ? 'on' : ''}" style="--c:${g.c};width:${D}px;height:${D}px;top:${128 - D / 2}px"></div>`;
  }).join('');
  const btns = GAMES.map((g, i) => {
    return `<button class="game ${S.arcs[i] ? 'done' : ''}" style="--c:${g.c}" data-i=${i}>
      <span class=lv>${S.lvl[i] > 5 ? '👑' : S.lvl[i]}</span>
      <span class=ic>${g.ic}</span><span class=nm>${g.name}</span>
      <span class=cn>${g.cn}</span></button>`;
  }).join('') + `
    <button class="game dz" id=dz>
      <span class=ic>📖</span><span class=nm>Dizionario</span>
      <span class=cn>${known().length} parol${known().length == 1 ? 'a' : 'e'}</span></button>`;
  // no English anywhere: an emoji carries the meaning where the words alone might not
  const msg = celebrate ? 'Fantastico! Ci vediamo domani! 👋'
    : done == 0 ? "Ciao! Facciamo l'arcobaleno? 🌈"
      : done < 7 ? `${bravo()} Ancora ${7 - done}! 💪`
        : 'Arcobaleno completo! 🌈';
  document.querySelector('#app').innerHTML = `
    <div class=top>
      <div class=brand style="background-image:linear-gradient(90deg,${GAMES.map(g => g.c)})">Arcobaleno</div>
      <div style="display:flex;gap:8px;align-items:center">
        <div class=streak>${S.lvl.every(l => l > 5) ? '👑 ' : ''}🔥${S.streak} 🌈${S.rb}</div>
        <button class=iconbtn id=snd>${S.snd ? '🔊' : '🔇'}</button>
      </div>
    </div>
    <div class=scene>
      <div class=rb>${arcs}</div>
      <div class=ground></div>
      <div class="uni ${celebrate ? 'gallop' : ''}" id=uni>🦄</div>
    </div>
    <div class="bubble home" id=bub>${msg}</div>
    <div class=games>${btns}</div>
    ${VOICE ? '' : '<div class="muted vw">⚠️ voce italiana non trovata</div>'}`;
  if (celebrate) { sfxRainbow(); say('Fantastico! Ci vediamo domani!'); }
  document.querySelector('#snd').onclick = () => { S.snd = S.snd ? 0 : 1; save(); showHome(); };
  document.querySelector('#uni').onclick = () => say('Ciao! Sono ' + S.uni + '!');
  document.querySelectorAll('.game[data-i]').forEach(el => el.onclick = () => startRound(+el.dataset.i));
  document.querySelector('#dz').onclick = showDict;
  window.__test = { S, home: 1 };
}

// ---------- dictionary ----------
function showDict() {
  const ws = known().sort((a, b) => a.it.localeCompare(b.it));   // alphabetical, accents in place
  document.querySelector('#app').innerHTML = `
    <div class=rtop><button class=iconbtn id=back>✕</button></div>
    <div class="card fade">${ws.length ? `<div class=tray>${ws.map(w =>
      `<button class="tile dw">${w.e}<div class=muted>${joinArt(art(w.it, w.g, w.plOnly), w.it)}</div></button>`).join('')}</div>`
      : '<div class=muted>Gioca per imparare! 🌈</div>'}</div>
    <div style="margin-top:14px;text-align:center"><button class=hint id=reset>🔄 ricomincia</button></div>`;
  document.querySelector('#back').onclick = () => showHome();
  // the wipe lives at the BOTTOM of the dictionary, not on home: it is mostly a dev/test
  // tool, and a daily screen should not carry a self-destruct button (README says where)
  document.querySelector('#reset').onclick = () => { if (confirm('Cancellare tutto? 🗑️')) { S = freshSave(); save(); showIntro(); } };
  // the caption IS the article phrase ("il gatto"), so gender reaches the eye as well as the
  // ear; a tap on a word is an explicit request, so it speaks even when sound is muted
  document.querySelectorAll('.dw').forEach(el => el.onclick = () => say(el.lastChild.textContent, .8, 1));
}

// ---------- intro ----------
function showIntro(step) {
  if (!step) {
    document.querySelector('#app').innerHTML = `
      <div class="intro fade">
        <div class=title style="background-image:linear-gradient(90deg,${GAMES.map(g => g.c)})">ARCOBALENO</div>
        <div class=hero>🦄</div>
        <div class="bubble" style="position:static;display:inline-block;margin:10px 0">
          Ciao! Sono ${S.uni}! E tu? Quando vinci ti dico...
        </div>
        <div class=names>
          <button class=tile data-g=m>Bravo! 👨</button>
          <button class=tile data-g=f>Brava! 👩</button>
        </div>
      </div>`;
    document.querySelectorAll('.names .tile').forEach(el => el.onclick = () => {
      S.pg = el.dataset.g; say(bravo()); showIntro(1);
    });
    return;
  }
  // .title is painted with background-clip:text and color:transparent, so it is
  // INVISIBLE without a background-image. The gradient must stay on every .title.
  document.querySelector('#app').innerHTML = `
    <div class="intro fade">
      <div class=hero>🦄</div>
      <div class=title style="background-image:linear-gradient(90deg,${GAMES.map(g => g.c)})">ARCOBALENO</div>
      <div class="bubble" style="position:static;display:inline-block;margin:10px 0">
        Ogni giorno facciamo un arcobaleno: sette colori, sette giochi!
      </div>
      <div style="margin-top:16px"><button class=btn id=go>Andiamo! 🌈</button></div>
    </div>`;
  document.querySelector('#go').onclick = () => { save(); say('Andiamo!'); showHome(); };
}


// ---------- boot ----------
// belt and braces against browser auto-translate: an Italian-learning player very likely
// has "always translate Italian" on, which turns "il naso" into "the nose" mid-game
(() => {
  const h = document.documentElement;
  h.lang = 'it'; document.title = 'Arcobaleno';   // set here, not in the shell: this gets packed
  h.setAttribute('translate', 'no'); h.classList.add('notranslate');
  const m = document.createElement('meta'); m.name = 'google'; m.content = 'notranslate';
  document.head.appendChild(m);
})();
document.addEventListener('pointerdown', initAudio, { once: true });
S = load();
initVoice();
if (!S || !S.pg) { S = S || freshSave(); showIntro(); }
else showHome();
