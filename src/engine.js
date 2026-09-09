// ============================================================
// ARCOBALENO engine: data parsing + Italian grammar as code
// No DOM in this file — everything here is pure and testable.
// ============================================================
'use strict';

// ---------- parse packed data (DW/DV come from data.js) ----------
// words: one line per category "cat:it,emoji,flag,lvl|..." (no gloss: nothing English ships)
// flags: m f (gender) p=masc plural-only q=fem plural-only i=invariable adj
const W = [], V = [];
DW.split('\n').forEach(line => {
  const ci = line.indexOf(':'), cat = line.slice(0, ci);
  line.slice(ci + 1).split('|').forEach(s => {
    const [it, e, fl, lvl] = s.split(',');
    const w = { it, e, cat, lvl: +lvl };
    w.g = fl == 'm' || fl == 'p' ? 'm' : fl == 'f' || fl == 'q' ? 'f'
      : /zione$|sione$/.test(it) ? 'f' : /o$/.test(it) ? 'm' : /a$/.test(it) ? 'f' : 'm';
    w.plOnly = fl == 'p' || fl == 'q';
    w.inv = fl == 'i';
    W.push(w);
  });
});
DV.split('|').forEach(s => {
  const [inf, aux, pp, fl, lvl, e] = s.split(',');      // e: the verb's emoji, shown above the Verbi prompt
  V.push({ inf, aux, pp, isc: fl.includes('i'), irr: fl.includes('x'), lvl: +lvl, e });
});
const verbByInf = {}; V.forEach(v => verbByInf[v.inf] = v);

// ---------- numbers 0..999999 ----------
const NU = 'zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici diciassette diciotto diciannove'.split(' ');
const NT = ' , ,venti,trenta,quaranta,cinquanta,sessanta,settanta,ottanta,novanta'.split(',');
function numCore(n) {
  if (n >= 1e6) {                                   // milione/miliardo are NOUNS: separate words,
    const u = n >= 1e9 ? 1e9 : 1e6, k = n / u | 0, r = n % u, w = u == 1e9 ? 'miliard' : 'milion';
    return (k == 1 ? 'un ' + w + (u == 1e9 ? 'o' : 'e') : num(k) + ' ' + w + 'i')   // un milione, due milioni
      + (r ? ' ' + num(r) : '');                    // un milione cinquecentomila
  }
  if (n < 20) return NU[n];
  if (n < 100) {
    let t = NT[n / 10 | 0], r = n % 10;
    if (!r) return t;
    if (r == 1 || r == 8) t = t.slice(0, -1);       // ventuno, ventotto
    return t + NU[r];
  }
  if (n < 1000) {
    const h = n / 100 | 0, r = n % 100;
    let s = (h > 1 ? NU[h] : '') + 'cento';
    if (!r) return s;
    // cento drops its final o before a word starting with o: the units "otto" and
    // the tens "ottanta". centotto, centottanta -- never centootto.
    if (r == 8 || (r >= 80 && r < 90)) s = s.slice(0, -1);
    return s + numCore(r);
  }
  if (n < 2000) return 'mille' + (n % 1000 ? numCore(n % 1000) : '');
  const k = n / 1000 | 0, r = n % 1000;
  // ventuno + mila -> ventunmila (the -o goes before mila), likewise centounmila
  return numCore(k).replace(/uno$/, 'un') + 'mila' + (r ? numCore(r) : '');
}
function num(n) {
  let s = numCore(n);
  // a compound ending in -tre takes the accent (ventitré, centotré, milletré) but a
  // bare "tre" does not, and neither does "tre" as its own word after milioni
  if (/[a-z]tre$/.test(s)) s = s.slice(0, -3) + 'tré';
  return s;
}

// ---------- articles ----------
const loStart = w => /^(s[bcdfghlmnpqrstvz]|z|gn|ps|pn|x|y|i[aeiou])/.test(w);
const vowStart = w => /^[aeiouàèéìòù]/.test(w);
function art(w, g, pl) {           // definite article
  if (g == 'm') return pl ? (loStart(w) || vowStart(w) ? 'gli' : 'i')
    : loStart(w) ? 'lo' : vowStart(w) ? "l'" : 'il';
  return pl ? 'le' : vowStart(w) ? "l'" : 'la';
}
function indef(w, g) {             // indefinite article
  return g == 'm' ? (loStart(w) ? 'uno' : 'un') : (vowStart(w) ? "un'" : 'una');
}
const joinArt = (a, w) => a.endsWith("'") ? a + w : a + ' ' + w;
// preposizioni articolate as ONE rule instead of a 35-cell table: a/da/su keep their
// letters, di -> de, in -> ne; then il -> l, lo/la/l' gain an l, i/gli/le are unchanged.
// al allo alla all' ai agli alle / del dello della dell' dei degli delle / nel ... / sul ... / dal ...
const prepArt = (p, a) => ({ di: 'de', in: 'ne' }[p] || p) + (a == 'il' ? 'l' : a[0] == 'l' ? 'l' + a : a);

// ---------- plurals ----------
const PL_EX = { uomo: 'uomini', uovo: 'uova', braccio: 'braccia', osso: 'ossa', orecchio: 'orecchie', mano: 'mani', moglie: 'mogli', zio: 'zii', re: 're' };
const PL_FEM = { uovo: 1, braccio: 1, osso: 1, orecchio: 1 };   // plurals that flip to feminine
// g is the noun's gender and CHANGES THE ANSWER for two whole classes, so pass it
// for nouns. adj() deliberately calls without it: an adjective's ending already
// encodes the agreement by the time it gets here.
function plural(w, g) {
  if (PL_EX[w]) return PL_EX[w];
  if (/[àèéìòù]$/.test(w) || !/[aeiou]$/.test(w)) return w;  // città, film, computer
  if (g == 'f' && /o$/.test(w)) return w;                    // la foto, la radio, la moto (mano is in PL_EX)
  if (g == 'm' && /a$/.test(w)) return w.slice(0, -1) + 'i'; // il problema -> i problemi, il fantasma -> i fantasmi
  if (/(cia|gia)$/.test(w))
    return /[aeiou][cg]ia$/.test(w) ? w.slice(0, -1) + 'e' : w.slice(0, -2) + 'e'; // camicie, docce
  if (/(ca|ga)$/.test(w)) return w.slice(0, -1) + 'he';       // banche, righe
  if (/a$/.test(w)) return w.slice(0, -1) + 'e';
  if (/io$/.test(w)) return w.slice(0, -1);                   // occhi, viaggi
  if (/ico$/.test(w)) return w.slice(0, -1) + 'i';            // amici, magici
  if (/(co|go)$/.test(w)) return w.slice(0, -1) + 'hi';       // giochi, alberghi
  if (/[oe]$/.test(w)) return w.slice(0, -1) + 'i';
  return w;
}
// adjective agreement; a = masc singular entry {it, inv}
function adj(a, g, pl) {
  const s = a.it || a;
  if (a.inv || !/[oe]$/.test(s)) return s;                    // blu, rosa, viola
  if (/e$/.test(s)) return pl ? plural(s) : s;                // verde/verdi
  const base = g == 'f' ? s.slice(0, -1) + 'a' : s;
  return pl ? plural(base) : base;
}

// ---------- conjugation ----------
const P_IT = ['io', 'tu', 'lui', 'noi', 'voi', 'loro'];       // lui/lei chosen by caller
const IRR_PRES = {
  essere: 'sono sei è siamo siete sono', avere: 'ho hai ha abbiamo avete hanno',
  andare: 'vado vai va andiamo andate vanno', fare: 'faccio fai fa facciamo fate fanno',
  stare: 'sto stai sta stiamo state stanno', dare: 'do dai dà diamo date danno',
  dire: 'dico dici dice diciamo dite dicono', venire: 'vengo vieni viene veniamo venite vengono',
  uscire: 'esco esci esce usciamo uscite escono', bere: 'bevo bevi beve beviamo bevete bevono',
  potere: 'posso puoi può possiamo potete possono', volere: 'voglio vuoi vuole vogliamo volete vogliono',
  dovere: 'devo devi deve dobbiamo dovete devono', sapere: 'so sai sa sappiamo sapete sanno',
  piacere: 'piaccio piaci piace piacciamo piacete piacciono',
  morire: 'muoio muori muore moriamo morite muoiono',
  scegliere: 'scelgo scegli sceglie scegliamo scegliete scelgono',
  tenere: 'tengo tieni tiene teniamo tenete tengono',
  salire: 'salgo sali sale saliamo salite salgono'
};
const PRES_END = { are: 'o i a iamo ate ano', ere: 'o i e iamo ete ono', ire: 'o i e iamo ite ono' };
function pres(v, p) {
  if (v.irr && IRR_PRES[v.inf]) return IRR_PRES[v.inf].split(' ')[p];
  const inf = v.inf, cls = inf.slice(-3);
  let stem = inf.slice(0, -3);
  const e = PRES_END[cls].split(' ')[p];
  if (v.isc && (p < 3 || p == 5)) stem += 'isc';              // capisco
  if (/^i/.test(e)) {
    if (/(car|gar)$/.test(inf.slice(0, -1))) stem += 'h';     // giochi, paghiamo
    else if (/i$/.test(stem)) stem = stem.slice(0, -1);       // mangi, studiamo
  }
  return stem + e;
}
const IMPF_STEM = { fare: 'face', dire: 'dice', bere: 'beve' };
function impf(v, p) {
  if (v.inf == 'essere') return 'ero eri era eravamo eravate erano'.split(' ')[p];
  const stem = IMPF_STEM[v.inf] || v.inf.slice(0, -3) + v.inf.slice(-3, -2); // parla-, ave-, dormi-
  return stem + ['vo', 'vi', 'va', 'vamo', 'vate', 'vano'][p];
}
const FUT_STEM = {
  essere: 'sar', avere: 'avr', andare: 'andr', fare: 'far', stare: 'star', dare: 'dar',
  vedere: 'vedr', potere: 'potr', volere: 'vorr', dovere: 'dovr', sapere: 'sapr',
  venire: 'verr', bere: 'berr', vivere: 'vivr', cadere: 'cadr', tenere: 'terr'
};
function fut(v, p) {
  let s = FUT_STEM[v.inf];
  if (!s) {
    const inf = v.inf, cls = inf.slice(-3);
    s = inf.slice(0, -3);
    if (cls == 'are') {
      if (/(care|gare)$/.test(inf)) s += 'h';                 // giocher-
      if (/(ciare|giare)$/.test(inf)) s = s.slice(0, -1);     // manger-
      s += 'er';
    } else s += cls[0] + 'r';                                 // prender-, dormir-
  }
  return s + ['ò', 'ai', 'à', 'emo', 'ete', 'anno'][p];
}
function pastPart(v) {
  if (v.pp) return v.pp;
  const c = v.inf.slice(-3);
  return v.inf.slice(0, -3) + (c == 'are' ? 'ato' : c == 'ere' ? 'uto' : 'ito');
}
// tense: 0 presente, 1 passato prossimo, 2 imperfetto, 3 futuro
// g: subject gender ('m'/'f') — matters for essere-aux participles
function conj(v, p, t, g) {
  if (t == 0) return pres(v, p);
  if (t == 2) return impf(v, p);
  if (t == 3) return fut(v, p);
  const aux = pres(verbByInf[v.aux == 'e' ? 'essere' : 'avere'], p);
  let part = pastPart(v);
  if (v.aux == 'e') part = part.slice(0, -1) + (p >= 3 ? 'i' : g == 'f' ? 'a' : 'o');
  return aux + ' ' + part;
}
const TENSE_IT = ['presente', 'passato prossimo', 'imperfetto', 'futuro'];

// ---------- sentence generator ----------
const BEV = { acqua: 1, caffè: 1, latte: 1, vino: 1, 'tè': 1, birra: 1, succo: 1 };
const TPL = [
  { v: 'mangiare', s: ['animali', 'persone'], o: ['cibo'], of: w => !BEV[w.it] },
  { v: 'bere', s: ['animali', 'persone'], o: ['cibo'], of: w => BEV[w.it] },
  { v: 'guardare', s: ['persone', 'animali'], o: ['natura', 'trasporti', 'animali', 'casa'] },
  { v: 'comprare', s: ['persone'], o: ['cibo', 'vestiti', 'oggetti'] },
  { v: 'amare', s: ['persone'], o: ['animali', 'cibo', 'natura', 'svago'] },
  { v: 'vedere', s: ['persone', 'animali'], o: ['animali', 'trasporti', 'natura'] },
  { v: 'volere', s: ['persone', 'animali'], o: ['cibo', 'oggetti', 'vestiti'] },
  { v: 'avere', s: ['persone'], o: ['animali', 'oggetti', 'vestiti'] }
];
const rnd = a => a[Math.random() * a.length | 0];
const pickWord = (cats, lvl, filt) => {
  const pool = W.filter(w => cats.includes(w.cat) && w.lvl <= lvl && w.e && !w.plOnly && (!filt || filt(w)));
  return rnd(pool);
};
// merge elided articles into the next tile: "l'" + "acqua" -> "l'acqua"
function mergeElision(tiles) {
  const out = [];
  for (const w of tiles) {
    if (out.length && out[out.length - 1].endsWith("'")) out[out.length - 1] += w;
    else out.push(w);
  }
  return out;
}
// CONTRACT: every shipped 'agg' word must read sensibly after "è" for a person or an
// animal ("la principessa è felice"), because the whole category is drawn from here.
// Adjectives that fail it are held at level 9 in words.tsv and never reach the build.
// returns {tiles:[...], emo, say} — tiles lowercase, no punctuation
function genSentence(lvl) {
  const colorAdj = W.filter(w => w.cat == 'colori' && w.e && w.it != 'colore');
  if (lvl >= 2 && Math.random() < .35) {          // "la principessa è felice"
    const s = pickWord(['persone', 'animali'], lvl);
    const a = s.cat == 'animali' && Math.random() < .4 ? rnd(colorAdj)
      : rnd(W.filter(w => w.cat == 'agg'));
    const tiles = mergeElision([art(s.it, s.g), s.it, 'è', adj(a, s.g)]);
    return { tiles, emo: s.e + (a.e || ''), say: tiles.join(' ') };
  }
  const t = rnd(TPL), v = verbByInf[t.v];
  const s = pickWord(t.s, lvl);
  const o = pickWord(t.o, lvl, t.of);
  const neg = lvl >= 3 && Math.random() < .3, pl = lvl >= 3 && Math.random() < .3;
  const tn = lvl >= 3 && Math.random() < .3 ? rnd([1, 3]) : 0;   // passato prossimo / futuro, 3 in 10 at level 3
  let tiles = [art(s.it, s.g, pl), pl ? plural(s.it, s.g) : s.it];   // i gatti neri mangiano: every part agrees
  let emo = pl ? s.e + s.e : s.e;                  // two cats = plural
  if (lvl >= 2 && s.cat == 'animali' && Math.random() < .5) {   // "il gatto nero" (animals only)
    const c = rnd(colorAdj);
    tiles.push(adj(c, s.g, pl)); emo += c.e;
  }
  if (neg) tiles.push('non');
  tiles.push(...conj(v, pl ? 5 : 2, tn, s.g).split(' '));   // 'ha mangiato' is two tiles
  tiles.push(art(o.it, o.g), o.it);
  emo += (neg ? '🚫' : '') + o.e;
  const out = mergeElision(tiles);
  return { tiles: out, emo, say: out.join(' '), tn };
}

// ---------- distractors ----------
// Words may SHARE a picture (mamma and donna are both 👩), so a distractor must never
// carry the answer's emoji and no two distractors may carry the same one: `used` is
// keyed by word AND by emoji. Otherwise a tile set could show one picture twice.
function wrongWords(right, n, hard) {
  const pool = W.filter(w => w != right && w.e && w.e != right.e &&
    (hard ? w.cat == right.cat : true));
  const out = [], used = { [right.it]: 1, [right.e]: 1 };
  let guard = 99;
  while (out.length < n && guard--) {
    const w = (pool.length >= n ? rnd(pool) : rnd(W.filter(x => x != right && x.e && x.e != right.e)));
    if (!used[w.it] && !used[w.e]) { used[w.it] = used[w.e] = 1; out.push(w); }
  }
  return out;
}
// Round to TWO SIGNIFICANT FIGURES: 456789 -> 450000. Caps any number at two non-zero
// digits, which is what keeps a spelled-out Italian number short enough to read.
const sig2 = n => n - n % 10 ** Math.max(0, ('' + n).length - 2);
// step: how far apart the near-miss distractors sit, so they do not spell almost
// identically. The caller passes the prompt's own magnitude.
function wrongNums(n, lo, hi, step = 1) {
  const s = new Set([n]);
  const tries = [n + step, n - step, n + 10 * step, n - 10 * step, n * 10, Math.floor(n / 10),
    +String(n).split('').reverse().join('')];
  const out = [];
  for (const t of tries) {
    if (out.length >= 3) break;
    if (t >= lo && t <= hi && !s.has(t)) { s.add(t); out.push(t); }
  }
  let guard = 99;
  while (out.length < 3 && guard--) {
    // sig2 the filler too, or it undoes the caller's rounding and drops a 456789 next
    // to three tidy choices. Its own magnitude, not `step`: when the prompt is 0 the
    // step is 1 and would round nothing at all.
    const t = sig2(lo + (Math.random() * (hi - lo + 1) | 0));
    if (!s.has(t)) { s.add(t); out.push(t); }
  }
  return out;
}
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
