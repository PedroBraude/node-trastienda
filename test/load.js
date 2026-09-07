const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Loads index.html in jsdom and exposes the game's top-level bindings.
// Classic <script> top-level const/function are not window properties, so we
// pull them out with win.eval.
function loadGame() {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const win = dom.window;
  const api = win.eval(
    '({ runNode, inspect, normalize, withSolution, CHAPTERS, LEVELS, state, loadLevel, selectTab, setFileContent, run, saveProgress, restoreProgress, unlockedUpTo })'
  );
  return { dom, win, doc: win.document, ...api };
}

function loadRuntime() {
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', url: 'http://localhost/' });
  return dom.window.eval('({ runNode, inspect })');
}

module.exports = { loadGame, loadRuntime };
