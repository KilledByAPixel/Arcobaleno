// DEV ONLY. Loaded by the root index.html and by nothing else: tools/build.js bundles
// data.js + engine.js + game.js, so none of this reaches dist/ or costs a single byte
// of the 13,312. Open index.html, then use dbg.* from the browser console.
'use strict';
window.dbg = {
  // dbg.lvl(6) every skill, dbg.lvl(6, 3) just Verbi. Order: Parole Articoli Numeri
  // Verbi Frasi Ascolto Ripasso.
  lvl(n, i) {
    n = Math.max(1, Math.min(6, n | 0));
    if (i == null) S.lvl = S.lvl.map(() => n); else S.lvl[i] = n;
    save(); showHome();
    console.log('levels:', S.lvl.join(' '));
  },
  // Fill the rainbow as if every game were played today. Pass true to replay the
  // completion celebration (unicorn gallop + fanfare).
  done(celebrate) {
    S.arcs = [1, 1, 1, 1, 1, 1, 1];
    if (S.lastFull !== S.day) { S.streak++; S.lastFull = S.day; }
    save(); showHome(!!celebrate);
    console.log('rainbow complete, streak', S.streak);
  },
  // Empty the rainbow again without touching levels or streak.
  clear() { S.arcs = [0, 0, 0, 0, 0, 0, 0]; save(); showHome(); console.log('arcs cleared'); },
  streak(n) { S.streak = n | 0; save(); showHome(); console.log('streak', S.streak); },
  // Teach the review system some words so Ripasso and the Dizionario have content.
  // Every word up to `lvl` gets a review entry that is due today.
  learn(lvl = 3) {
    let n = 0;
    for (const w of W) if (w.lvl <= lvl && w.e) { S.it['w' + w.it] = { b: 1, d: S.day }; n++; }
    save(); showHome();
    console.log(n + ' words marked as met (Dizionario + Ripasso now have content)');
  },
  // Pretend a number of days passed, to exercise rollover and the streak break.
  skip(days = 1) {
    S.day -= days | 0; S.lastFull -= days | 0;
    save(); showHome();
    console.log('save moved back ' + days + ' day(s); reload or open home to roll over');
  },
  reset() { localStorage.removeItem('arco'); location.reload(); },
  // What is the game showing right now?
  state() {
    const q = (window.__test || {}).q;
    console.log({ levels: S.lvl.join(' '), arcs: S.arcs.join(''), streak: S.streak,
      known: known().length, voice: VOICE ? VOICE.name : null,
      question: q ? { mode: ['pick', 'assemble', 'teach'][q.mode], answer: q.answer || (q.choices || []).filter(c => c.ok).map(c => c.t)[0] } : null });
  },
  help() {
    console.log(['dbg.lvl(6)       every skill to level 6   dbg.lvl(6, 3) just Verbi',
                 'dbg.done(true)   fill the rainbow (true replays the celebration)',
                 'dbg.clear()      empty the rainbow again',
                 'dbg.learn(3)     mark every word up to level 3 as met',
                 'dbg.streak(30)   set the streak',
                 'dbg.skip(2)      pretend 2 days passed, to test rollover',
                 'dbg.state()      dump levels, arcs, voice and the current question',
                 'dbg.reset()      wipe the save and reload'].join('\n'));
  }
};
console.log('%cArcobaleno dev build', 'font-weight:bold', '— type dbg.help() for test commands');
