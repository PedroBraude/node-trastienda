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
