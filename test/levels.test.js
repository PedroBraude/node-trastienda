const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./load');

const game = loadGame();
const { LEVELS, CHAPTERS, runNode, normalize, withSolution } = game;

test('there are 10 levels in 2 chapters', () => {
  assert.equal(LEVELS.length, 10);
  assert.equal(CHAPTERS.length, 2);
  for (const lv of LEVELS) assert.ok(lv.ch === 0 || lv.ch === 1);
});

for (const [i, lv] of LEVELS.entries()) {
  test(`nivel ${i + 1}: initial files do NOT produce the expected output`, () => {
    const r = runNode(lv.files, lv.entry);
    const passes = normalize(r.output) === normalize(lv.expected) && (!lv.check || lv.check(lv.files));
    assert.equal(passes, false);
  });

  test(`nivel ${i + 1}: solution produces exactly the expected output`, () => {
    const files = withSolution(lv);
    const r = runNode(files, lv.entry);
    assert.equal(r.ok, true, r.output);
    assert.equal(normalize(r.output), normalize(lv.expected));
    if (lv.check) assert.equal(lv.check(files), true);
  });

  test(`nivel ${i + 1}: solution only touches files that exist and entry exists`, () => {
    assert.ok(lv.entry in lv.files);
    for (const name of Object.keys(lv.solution)) assert.ok(name in lv.files, name);
  });
}

test('no solution solves a different level', () => {
  for (const [i, a] of LEVELS.entries()) {
    for (const [j, b] of LEVELS.entries()) {
      if (i === j) continue;
      const files = { ...b.files, ...a.solution };
      const r = runNode(files, b.entry);
      const solved = normalize(r.output) === normalize(b.expected) && (!b.check || b.check(files));
      assert.equal(solved, false, `solution of level ${i + 1} also solves level ${j + 1}`);
    }
  }
});

for (const [i, lv] of LEVELS.entries()) {
  test(`nivel ${i + 1}: solving it through the UI marks it done`, () => {
    const g = loadGame();
    g.loadLevel(i);
    for (const [name, text] of Object.entries(lv.solution)) g.setFileContent(name, text);
    g.run();
    assert.ok(g.state.done.has(i));
    assert.equal(g.doc.querySelector('#terminal').textContent.includes('$ node ' + lv.entry), true);
  });
}

test('running the initial files shows the symptom and does not mark done', () => {
  const g = loadGame();
  g.loadLevel(0);
  g.run();
  assert.equal(g.state.done.has(0), false);
  assert.match(g.doc.querySelector('#terminal').textContent, /Cannot find module 'productos'/);
});

test('tabs switch the editor between files and keep edits', () => {
  const g = loadGame();
  g.loadLevel(0);
  const code = g.doc.querySelector('#code');
  assert.equal(code.value, LEVELS[0].files['app.js']);
  code.value = '// edited';
  g.selectTab('productos.js');
  assert.equal(code.value, LEVELS[0].files['productos.js']);
  g.selectTab('app.js');
  assert.equal(code.value, '// edited');
  assert.equal(g.state.files[0]['app.js'], '// edited');
});

test('progress persists in localStorage and restores on reload', () => {
  const g = loadGame();
  g.loadLevel(0);
  g.setFileContent('app.js', LEVELS[0].solution['app.js']);
  g.run();
  const raw = g.win.localStorage.getItem('la-trastienda');
  const saved = JSON.parse(raw);
  assert.deepEqual(saved.done, [0]);
  assert.equal(saved.files[0]['app.js'], LEVELS[0].solution['app.js']);

  // Simulate a reload by loading a fresh DOM with the same storage contents.
  const g2 = loadGame();
  g2.win.localStorage.setItem('la-trastienda', raw);
  g2.restoreProgress();
  assert.ok(g2.state.done.has(0));
  assert.equal(g2.unlockedUpTo(), 1);
});

test('level buttons beyond the first unsolved level are disabled', () => {
  const g = loadGame();
  const buttons = [...g.doc.querySelectorAll('#levels button')];
  assert.equal(buttons.length, LEVELS.length);
  assert.equal(buttons[0].disabled, false);
  assert.equal(buttons[1].disabled, true);
});

test('finishing a chapter shows its closing line, finishing all shows the win screen', () => {
  const g = loadGame();
  for (const [i, lv] of LEVELS.entries()) {
    g.loadLevel(i);
    for (const [name, text] of Object.entries(lv.solution)) g.setFileContent(name, text);
    g.run();
    if (i === 4) assert.match(g.doc.querySelector('#feedback').textContent, /El catálogo volvió a andar/);
  }
  assert.equal(g.doc.querySelector('#win').hidden, false);
});

test('terminals are live regions and the editor has a label', () => {
  const g = loadGame();
  assert.equal(g.doc.querySelector('#terminal').getAttribute('aria-live'), 'polite');
  assert.equal(g.doc.querySelector('#feedback').getAttribute('aria-live'), 'polite');
  assert.ok(g.doc.querySelector('label[for="code"]'));
  assert.equal(g.doc.querySelector('#tabs').getAttribute('role'), 'tablist');
});

test('Tab inserts two spaces; Esc then Tab leaves the editor', () => {
  const g = loadGame();
  const code = g.doc.querySelector('#code');
  code.value = 'a';
  code.selectionStart = code.selectionEnd = 1;
  code.focus();
  const tab = new g.win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  code.dispatchEvent(tab);
  assert.equal(tab.defaultPrevented, true);
  assert.equal(code.value, 'a  ');
  const esc = new g.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  code.dispatchEvent(esc);
  const tab2 = new g.win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  code.dispatchEvent(tab2);
  assert.equal(tab2.defaultPrevented, false);
});

test('player code sees Node-like globals, not the page (shadowed names only; not a sandbox)', () => {
  const g = loadGame();
  const r = g.runNode({ 'app.js': 'console.log(typeof document, typeof window, typeof module.exports, typeof require);' }, 'app.js');
  assert.equal(r.output, 'undefined undefined object function');
  // The boundary is only the shadowed names: globalThis still reaches the page.
  const r2 = g.runNode({ 'app.js': 'console.log(typeof globalThis.document);' }, 'app.js');
  assert.equal(r2.output, 'object');
});

test('corrupted progress in localStorage does not crash and is clamped', () => {
  const g = loadGame();
  g.win.localStorage.setItem('la-trastienda', JSON.stringify({ done: [-1, 99, 0], files: {}, current: -5 }));
  g.restoreProgress();
  assert.deepEqual([...g.state.done], [0]);
  assert.equal(g.state.current, 0);
  g.win.localStorage.setItem('la-trastienda', '{not json');
  assert.doesNotThrow(() => g.restoreProgress());
});
