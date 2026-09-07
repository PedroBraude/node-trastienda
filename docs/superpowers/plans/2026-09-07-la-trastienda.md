# La Trastienda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-file browser game where the player fixes broken Node.js module code by reading the terminal error, across 10 levels in 2 chapters.

**Architecture:** One `index.html` holds CSS, HTML and JS. A fake Node runtime (`runNode`) executes the level's virtual files with `new Function`, a custom `require`, a fake `fs` with a deterministic callback queue, and a fake `console` that renders like Node. A level is won when the terminal output equals `expected`. UI, state and `localStorage` follow the patterns of `~/Github/js-dom-terrario/index.html`.

**Tech Stack:** Vanilla JS/HTML/CSS. Tests: `node --test` + `jsdom` (only devDependency). Deploy: GitHub Pages via Actions.

**Spec:** `docs/superpowers/specs/2026-09-07-la-trastienda-design.md`

## Global Constraints

- One `index.html`; no frameworks, no bundler, no build step.
- All UI copy in Rioplatense Spanish (voseo: "escribí", "tocá", "podés"; never "puedes", "haz clic").
- Code identifiers, comments and commit messages in English. Commit messages: conventional commits, **no AI attribution, no Co-Authored-By**.
- Player code runs with `new Function`; it is NOT a sandbox. Never claim isolation in copy or docs. Threat model: self-XSS.
- Progress only in `localStorage`, key `la-trastienda`.
- Fictitious base path inside the fake runtime: `/home/jota/trastienda/`.
- Use `bat`/`rg`/`fd`/`sd`/`eza` instead of `cat`/`grep`/`find`/`sed`/`ls` when inspecting files.
- Reference implementation for UI/CSS/a11y patterns: `~/Github/js-dom-terrario/index.html` (797 lines: CSS 29–221, HTML 222–288, JS 289–795). Read it before Task 5.

---

## File Structure

- `package.json` — `{"name":"la-trastienda","private":true,"scripts":{"test":"node --test"},"devDependencies":{"jsdom":"^30.0.1"}}`. CommonJS (no `"type":"module"`).
- `index.html` — the whole game. Script order inside the single `<script>`: runtime (`inspect`, `runNode`), data (`CHAPTERS`, `LEVELS`), state + persistence, UI (`loadLevel`, `selectTab`, `setFileContent`, `run`, `renderNav`), keyboard, boot.
- `test/load.js` — jsdom loader that returns the game's top-level API via `win.eval`.
- `test/runtime.test.js` — tests `runNode` alone.
- `test/levels.test.js` — every level solvable by `solution`, initial files do not solve it, `expected` matches solution output, a11y, player-code boundary.
- `README.md`, `LICENSE`, `CLAUDE.md`, `.github/workflows/pages.yml`, `manifest.webmanifest`.

---

### Task 1: Scaffold, test loader, and `runNode` for modules (`require` / `module.exports`)

**Files:**
- Create: `package.json`, `.gitignore`, `index.html`, `test/load.js`, `test/runtime.test.js`

**Interfaces:**
- Produces: `runNode(files: Record<string,string>, entry: string): { output: string, ok: boolean }` defined as a top-level `function` in `index.html`'s script. `inspect(value, depth=0): string`. Both reachable from tests via `test/load.js` → `loadGame()`.

- [ ] **Step 1: Scaffold**

`package.json`:
```json
{
  "name": "la-trastienda",
  "version": "0.1.0",
  "private": true,
  "description": "Juego para aprender módulos de Node.js arreglando código roto",
  "scripts": { "test": "node --test" },
  "devDependencies": { "jsdom": "^30.0.1" }
}
```
`.gitignore`: `node_modules/`.

`index.html` minimal shell (will grow in Task 5):
```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>La Trastienda</title>
</head>
<body>
<script>
'use strict';
// ---------- Fake Node runtime ----------
</script>
</body>
</html>
```

`test/load.js`:
```js
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

module.exports = { loadGame };
```
Note: until Task 4/5 exist, `win.eval` of missing names throws. For Task 1 only, use a narrower loader call in the test: `win.eval('({ runNode, inspect })')`. Add a second export:
```js
function loadRuntime() {
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', url: 'http://localhost/' });
  return dom.window.eval('({ runNode, inspect })');
}
module.exports = { loadGame, loadRuntime };
```

Run `npm install`.

- [ ] **Step 2: Write the failing tests (modules)**

`test/runtime.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRuntime } = require('./load');

const { runNode, inspect } = loadRuntime();

const PRODUCTOS = `const catalogo = [
  { id: 1, nombre: "Silla", precio: 10 },
  { id: 2, nombre: "Mesa", precio: 20 },
];
module.exports = catalogo;
`;

test('require with ./ resolves a local module and runs it', () => {
  const r = runNode({
    'app.js': 'const c = require("./productos");\nconsole.log("Total:", c.length);',
    'productos.js': PRODUCTOS,
  }, 'app.js');
  assert.equal(r.ok, true);
  assert.equal(r.output, 'Total: 2');
});

test('require with ./x.js resolves like ./x', () => {
  const r = runNode({
    'app.js': 'console.log(require("./productos.js").length);',
    'productos.js': PRODUCTOS,
  }, 'app.js');
  assert.equal(r.output, '2');
});

test('require without ./ fails with Cannot find module and a require stack', () => {
  const r = runNode({
    'app.js': 'const c = require("productos");\nconsole.log("never");',
    'productos.js': PRODUCTOS,
  }, 'app.js');
  assert.equal(r.ok, false);
  assert.equal(r.output,
    "Error: Cannot find module 'productos'\nRequire stack:\n- /home/jota/trastienda/app.js\n    at /home/jota/trastienda/app.js");
});

test('require ./missing fails with Cannot find module', () => {
  const r = runNode({ 'app.js': 'require("./fs");' }, 'app.js');
  assert.equal(r.ok, false);
  assert.match(r.output, /^Error: Cannot find module '\.\/fs'/);
});

test('module without module.exports gives an empty object', () => {
  const r = runNode({
    'app.js': 'const c = require("./productos");\nconsole.log("Productos:", c.length);\nc.forEach(() => {});',
    'productos.js': 'const catalogo = [1, 2];',
  }, 'app.js');
  assert.equal(r.ok, false);
  assert.equal(r.output,
    'Productos: undefined\nTypeError: c.forEach is not a function\n    at /home/jota/trastienda/app.js');
});

test('a module is evaluated once per run', () => {
  const r = runNode({
    'app.js': 'require("./m"); require("./m");',
    'm.js': 'console.log("loaded");',
  }, 'app.js');
  assert.equal(r.output, 'loaded');
});

test('errors thrown inside a required module are attributed to that module', () => {
  const r = runNode({
    'app.js': 'require("./m");',
    'm.js': 'null.x;',
  }, 'app.js');
  assert.equal(r.ok, false);
  assert.match(r.output, /^TypeError: .*\n    at \/home\/jota\/trastienda\/m\.js$/);
});

test('console.log formats values like Node', () => {
  assert.equal(inspect('hola'), 'hola');
  assert.equal(inspect(['a', 1]), "[ 'a', 1 ]");
  assert.equal(inspect({ id: 1, nombre: 'Silla' }), "{ id: 1, nombre: 'Silla' }");
  assert.equal(inspect([]), '[]');
  assert.equal(inspect({}), '{}');
  assert.equal(inspect(undefined), 'undefined');
  assert.equal(inspect(null), 'null');
  assert.equal(inspect(NaN), 'NaN');
  const r = runNode({ 'app.js': 'console.log("a", 1, undefined, [2]);' }, 'app.js');
  assert.equal(r.output, 'a 1 undefined [ 2 ]');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `runNode is not defined` (thrown from `win.eval`).

- [ ] **Step 4: Implement runtime (modules part) in `index.html`**

Inside the `<script>`, after the runtime comment:
```js
const BASE = '/home/jota/trastienda/';

function inspect(v, depth = 0) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return depth === 0 ? v : "'" + v + "'";
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'function') return '[Function: ' + (v.name || 'anonymous') + ']';
  if (v.__buffer) return formatBuffer(v);
  if (Array.isArray(v)) {
    return v.length ? '[ ' + v.map(x => inspect(x, depth + 1)).join(', ') + ' ]' : '[]';
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (!keys.length) return '{}';
    return '{ ' + keys.map(k => k + ': ' + inspect(v[k], depth + 1)).join(', ') + ' }';
  }
  return String(v);
}

function makeBuffer(text) {
  return { __buffer: true, bytes: new TextEncoder().encode(text) };
}

function formatBuffer(b) {
  const shown = Array.from(b.bytes.slice(0, 50)).map(x => x.toString(16).padStart(2, '0')).join(' ');
  const rest = b.bytes.length - 50;
  return '<Buffer ' + shown + (rest > 0 ? ' ... ' + rest + ' more bytes' : '') + '>';
}

// Runs the virtual project in a fake Node. NOT a sandbox: player code runs in
// this page with `new Function`; only `require`, `module`, `exports`, `console`
// and `__dirname` are shadowed. Threat model is self-XSS (the player's own
// code, in the player's own browser). If player code is ever shown to other
// players, move execution into an <iframe sandbox>.
function runNode(files, entry) {
  const lines = [];
  const queue = [];   // { fn, file } tasks scheduled by the fake fs
  const cache = {};   // file name -> module object
  let current = entry;

  const fakeConsole = { log: (...args) => lines.push(args.map(a => inspect(a)).join(' ')) };
  fakeConsole.error = fakeConsole.warn = fakeConsole.info = fakeConsole.log;

  function moduleError(spec, from) {
    const e = new Error("Cannot find module '" + spec + "'");
    e.code = 'MODULE_NOT_FOUND';
    e.requireStack = [BASE + from];
    e.__file = from; // Node attributes the throw to the file that called require
    return e;
  }

  const fakePath = { join: (...parts) => parts.join('/').replace(/\/+/g, '/') };

  const fakeFs = {
    readFile(name, encoding, callback) {
      if (typeof encoding === 'function') { callback = encoding; encoding = null; }
      const key = name.startsWith(BASE) ? name.slice(BASE.length) : name;
      queue.push({ file: current, fn() {
        if (!(key in files)) {
          const err = new Error("ENOENT: no such file or directory, open '" + name + "'");
          err.code = 'ENOENT';
          callback(err);
        } else if (encoding && /^utf-?8$/i.test(encoding)) {
          callback(null, files[key]);
        } else {
          callback(null, makeBuffer(files[key]));
        }
      } });
    },
  };

  function resolve(spec, from) {
    if (spec === 'fs') return fakeFs;
    if (spec === 'path') return fakePath;
    if (typeof spec === 'string' && spec.startsWith('./')) {
      const base = spec.slice(2);
      const name = (base in files) ? base : ((base + '.js') in files) ? base + '.js' : null;
      if (name === null || !name.endsWith('.js')) throw moduleError(spec, from);
      return load(name);
    }
    throw moduleError(spec, from);
  }

  function load(name) {
    if (cache[name]) return cache[name].exports;
    const module = { exports: {} };
    cache[name] = module;
    const previous = current;
    current = name;
    try {
      // `document` and `window` are shadowed with undefined so the player gets
      // the same experience as the Node REPL (no DOM here). Still not a sandbox.
      new Function('require', 'module', 'exports', 'console', '__dirname', 'document', 'window',
        '"use strict";\n' + files[name])(
        spec => resolve(spec, name), module, module.exports, fakeConsole, BASE.slice(0, -1), undefined, undefined);
    } catch (err) {
      if (err && typeof err === 'object' && !err.__file) err.__file = name;
      throw err;
    } finally {
      current = previous;
    }
    return module.exports;
  }

  function formatError(err, file) {
    const name = (err && err.name) || 'Error';
    const msg = err && err.message !== undefined ? err.message : String(err);
    let out = name + ': ' + msg;
    if (err && err.requireStack) out += '\nRequire stack:\n' + err.requireStack.map(p => '- ' + p).join('\n');
    return out + '\n    at ' + BASE + file;
  }

  let ok = true;
  try {
    if (!(entry in files)) throw moduleError('./' + entry, entry);
    load(entry);
    while (queue.length) {
      const task = queue.shift();
      current = task.file;
      task.fn();
    }
  } catch (err) {
    ok = false;
    // `current` is restored by load()'s finally, so re-derive the failing file
    // from the error when it carries one; otherwise use the last known file.
    lines.push(formatError(err, err && err.__file ? err.__file : current));
  }
  return { output: lines.join('\n'), ok };
}
```
Attribution: errors thrown while evaluating a module get `__file = name` in `load()`'s catch; `moduleError` sets `__file` to the requiring file; errors from queued callbacks have no `__file`, so `current = task.file` applies. Add one more test to `test/runtime.test.js`:
```js
test('document and window are undefined inside player code', () => {
  const r = runNode({ 'a.js': 'console.log(typeof document, typeof window);' }, 'a.js');
  assert.equal(r.output, 'undefined undefined');
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: 9 passing.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore index.html test/load.js test/runtime.test.js
git commit -m "feat: fake Node runtime with require and module.exports"
```

---

### Task 2: `fs.readFile`, callback queue, Buffer, ENOENT

**Files:**
- Modify: `index.html` (runtime already contains `fakeFs` from Task 1; this task verifies behaviour and fixes gaps)
- Modify: `test/runtime.test.js`

**Interfaces:**
- Consumes: `runNode`, `inspect` from Task 1.
- Produces: verified fs semantics that levels 5–10 rely on.

- [ ] **Step 1: Write the failing tests**

Append to `test/runtime.test.js`:
```js
const INVENTARIO = 'Silla de Comedor - 15 unidades\nMesa de Roble - 5 unidades\nSofá de 3 Cuerpos - 0 unidades\nBiblioteca Modular - 8 unidades';

test('readFile with utf8 delivers the text after the main module finishes', () => {
  const r = runNode({
    'leer.js': `const fs = require("fs");
fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  console.log(contenido);
});
console.log("Pedí el archivo, sigo con lo mío...");`,
    'inventario.txt': INVENTARIO,
  }, 'leer.js');
  assert.equal(r.ok, true);
  assert.equal(r.output, 'Pedí el archivo, sigo con lo mío...\n' + INVENTARIO);
});

test('readFile without encoding delivers a Buffer that prints like Node', () => {
  const r = runNode({
    'leer.js': 'require("fs").readFile("inventario.txt", (e, c) => console.log(c));',
    'inventario.txt': INVENTARIO,
  }, 'leer.js');
  assert.match(r.output, /^<Buffer 53 69 6c 6c 61 20 .* \.\.\. 71 more bytes>$/);
});

test('readFile of a short file prints the whole Buffer without "more bytes"', () => {
  const r = runNode({
    'leer.js': 'require("fs").readFile("a.txt", (e, c) => console.log(c));',
    'a.txt': 'hola',
  }, 'leer.js');
  assert.equal(r.output, '<Buffer 68 6f 6c 61>');
});

test('readFile of a missing file calls back with an ENOENT error and no content', () => {
  const r = runNode({
    'leer.js': `require("fs").readFile("inventario.txt", "utf8", (error, contenido) => {
  console.log(error.code, error.message, contenido);
});`,
  }, 'leer.js');
  assert.equal(r.output, "ENOENT ENOENT: no such file or directory, open 'inventario.txt' undefined");
});

test('an error inside a callback stops the run and is reported on that file', () => {
  const r = runNode({
    'leer.js': `const fs = require("fs");
fs.readFile("nope.txt", "utf8", (error, contenido) => {
  if (error) { console.log("No pude leer:", error.message); }
  contenido.split("\\n");
});
fs.readFile("nope.txt", "utf8", () => console.log("never"));`,
  }, 'leer.js');
  assert.equal(r.ok, false);
  const lines = r.output.split('\n');
  assert.equal(lines[0], "No pude leer: ENOENT: no such file or directory, open 'nope.txt'");
  assert.match(lines[1], /^TypeError: /);
  assert.equal(lines[2], '    at /home/jota/trastienda/leer.js');
  assert.equal(lines.length, 3);
});

test('path.join with __dirname still finds the virtual file', () => {
  const r = runNode({
    'leer.js': `const fs = require("fs"); const path = require("path");
fs.readFile(path.join(__dirname, "a.txt"), "utf8", (e, c) => console.log(c));`,
    'a.txt': 'hola',
  }, 'leer.js');
  assert.equal(r.output, 'hola');
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all pass if Task 1 was implemented as written. If any fail, fix `fakeFs` / queue in `runNode` (do not weaken the tests).

- [ ] **Step 3: Commit**

```bash
git add index.html test/runtime.test.js
git commit -m "test: fake fs readFile, Buffer, ENOENT and callback order"
```

---

### Task 3: Level data (`CHAPTERS`, `LEVELS`) and data-only tests

**Files:**
- Modify: `index.html` (add data section after runtime)
- Create: `test/levels.test.js` (data part; UI tests added in Task 5)

**Interfaces:**
- Consumes: `runNode`.
- Produces: `CHAPTERS`, `LEVELS`, `normalize(text)`, `withSolution(level)`. Level shape per spec: `{ ch, title, story, lesson, task, hint, files, entry, expected, solution, check? }`.

- [ ] **Step 1: Write the failing tests**

`test/levels.test.js`:
```js
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
```
Note on the cross-check: level 5 (`require("./fs")`) and level 6 (missing `"utf8"`) share `leer.js` names with different content, so applying one solution file wholesale to the other level replaces the whole file. That is the point of the test: each solution must not be a general "correct leer.js" that solves neighbours. Design the `leer.js` per level with distinct output (headers, counts) so this holds; the level table below already does.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: `test/levels.test.js` fails with `LEVELS is not defined` (via `win.eval`).

- [ ] **Step 3: Add data to `index.html`**

Append after the runtime:
```js
// ---------- Data ----------
function normalize(text) {
  return String(text).split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
}

function withSolution(lv) {
  return { ...lv.files, ...lv.solution };
}

const CATALOGO = `const catalogo = [
  { id: 1, nombre: "Silla de Comedor Nórdica", precio: 45000 },
  { id: 2, nombre: "Mesa de Roble Macizo", precio: 180000 },
  { id: 3, nombre: "Sofá de 3 Cuerpos Lino", precio: 320000 },
  { id: 4, nombre: "Biblioteca Modular Pino", precio: 95000 },
];
`;
const PRODUCTOS_OK = CATALOGO + '\nmodule.exports = catalogo;\n';

// Level 4 uses a five-product catalog so its solution cannot also solve level 2
// (and vice versa): the cross-check test in test/levels.test.js enforces this.
const CATALOGO_5_ROTO = `const catalogo = [
  { id: 1, nombre: "Silla de Comedor Nórdica", precio: 45000 },
  { id: 2, nombre: "Mesa de Roble Macizo", precios: 180000 },
  { id: 3, nombre: "Sofá de 3 Cuerpos Lino", precio: 320000 },
  { id: 4, nombre: "Biblioteca Modular Pino", precio: 95000 },
  { id: 5, nombre: "Perchero de Pie", precio: 12000 },
];

module.exports = catalogo;
`;
const CATALOGO_5_OK = CATALOGO_5_ROTO.replace('precios:', 'precio:');

const INVENTARIO = `Silla de Comedor - 15 unidades
Mesa de Roble - 5 unidades
Sofá de 3 Cuerpos - 0 unidades
Biblioteca Modular - 8 unidades
`;

const LISTADO = `Silla de Comedor Nórdica — $45000
Mesa de Roble Macizo — $180000
Sofá de 3 Cuerpos Lino — $320000
Biblioteca Modular Pino — $95000`;

const INVENTARIO_SALIDA = 'Inventario de Hermanos Jota:\n' + INVENTARIO;

const CHAPTERS = [
  { name: 'La caja', desc: 'require y module.exports',
    cierre: 'El catálogo volvió a andar. Cada archivo es una caja: la etiqueta afuera es module.exports, y pedirla por nombre es require.' },
  { name: 'El depósito', desc: 'fs.readFile y el callback',
    cierre: 'El inventario se lee solo. Primero el error, después el dato. Y JavaScript anota y sigue: no espera a nadie.' },
];

const LEVELS = [
  // ---- Capítulo 1: La caja ----
  {
    ch: 0, title: 'El punto-barra',
    story: 'Bienvenido a la trastienda. Acá guardamos los muebles y un sistema en Node que armó el sobrino de los Jota antes de irse. Desde que se fue, nada corre. Empecemos por el catálogo: corré <code>node app.js</code> y fijate qué dice.',
    lesson: '<p>Un módulo es un archivo <code>.js</code> que exporta algo. Para pedir uno tuyo, <code>require</code> necesita la ruta con <strong>punto-barra</strong>: <code>./</code> significa "en esta carpeta". Sin eso, Node cree que le pedís un paquete instalado y no lo encuentra.</p><pre>const catalogo = require("./productos");</pre><p>La extensión <code>.js</code> se puede omitir.</p>',
    task: 'Leé el error de la terminal y arreglá el <code>require</code> de <code>app.js</code> para que muestre el catálogo.',
    hint: 'Sin punto es de fábrica; con punto es nuestro. Falta el ./ antes de productos.',
    files: {
      'app.js': `const catalogo = require("productos");

console.log("Productos en el catálogo:", catalogo.length);
catalogo.forEach((producto) => {
  console.log(\`\${producto.nombre} — $\${producto.precio}\`);
});
`,
      'productos.js': PRODUCTOS_OK,
    },
    entry: 'app.js',
    expected: 'Productos en el catálogo: 4\n' + LISTADO,
    solution: {
      'app.js': `const catalogo = require("./productos");

console.log("Productos en el catálogo:", catalogo.length);
catalogo.forEach((producto) => {
  console.log(\`\${producto.nombre} — $\${producto.precio}\`);
});
`,
    },
  },
  {
    ch: 0, title: 'La etiqueta de la caja',
    story: 'Bien. Ahora el listado corto que usamos para el remito. Dice <em>undefined</em>, y "undefined" no es un mueble que tengamos.',
    lesson: '<p>Cada archivo en Node es una caja cerrada: lo que definís adentro es privado. Para que otro archivo pueda usarlo, tenés que ponerle la <strong>etiqueta</strong> afuera:</p><pre>module.exports = catalogo;</pre><p>Sin etiqueta, <code>require</code> devuelve una caja vacía: <code>{}</code>. Y un objeto vacío no tiene <code>length</code> ni <code>forEach</code>. Fijate que JavaScript no avisa en la primera línea: dice <code>undefined</code> y sigue hasta que explota.</p>',
    task: 'Mirá <code>productos.js</code>. El array está, pero falta algo al final. Hacé que <code>app.js</code> reciba el catálogo.',
    hint: 'Al final de productos.js: module.exports = catalogo;',
    files: {
      'app.js': `const catalogo = require("./productos");

console.log("Remito de hoy:", catalogo.length, "productos");
catalogo.forEach((producto) => {
  console.log("-", producto.nombre);
});
`,
      'productos.js': CATALOGO,
    },
    entry: 'app.js',
    expected: `Remito de hoy: 4 productos
- Silla de Comedor Nórdica
- Mesa de Roble Macizo
- Sofá de 3 Cuerpos Lino
- Biblioteca Modular Pino`,
    solution: { 'productos.js': PRODUCTOS_OK },
  },
  {
    ch: 0, title: 'Varias herramientas',
    story: 'Los precios tienen que salir con puntitos de mil, como en la vidriera. El sobrino hizo un archivo de utilidades, pero solo una funciona.',
    lesson: '<p>Si una caja tiene varias herramientas, exportás un <strong>objeto</strong> y sacás las que necesitás con llaves:</p><pre>module.exports = { formatearPrecio, calcularTotal };\n\nconst { formatearPrecio, calcularTotal } = require("./utilidades");</pre><p>Si exportás una sola función y del otro lado sacás con llaves, las dos quedan <code>undefined</code>: una función no tiene una propiedad llamada <code>formatearPrecio</code>.</p>',
    task: 'Arreglá la exportación de <code>utilidades.js</code> para que <code>app.js</code> pueda usar las dos funciones.',
    hint: 'module.exports tiene que ser un objeto con las dos funciones adentro, entre llaves.',
    files: {
      'app.js': `const catalogo = require("./productos");
const { formatearPrecio, calcularTotal } = require("./utilidades");

catalogo.forEach((producto) => {
  console.log(\`\${producto.nombre} — \${formatearPrecio(producto.precio)}\`);
});
console.log("Total del catálogo:", formatearPrecio(calcularTotal(catalogo)));
`,
      'productos.js': PRODUCTOS_OK,
      'utilidades.js': `function formatearPrecio(precio) {
  return "$" + precio.toLocaleString("es-AR");
}

function calcularTotal(productos) {
  let total = 0;
  productos.forEach((p) => {
    total = total + p.precio;
  });
  return total;
}

module.exports = formatearPrecio;
`,
    },
    entry: 'app.js',
    expected: `Silla de Comedor Nórdica — $45.000
Mesa de Roble Macizo — $180.000
Sofá de 3 Cuerpos Lino — $320.000
Biblioteca Modular Pino — $95.000
Total del catálogo: $640.000`,
    solution: {
      'utilidades.js': `function formatearPrecio(precio) {
  return "$" + precio.toLocaleString("es-AR");
}

function calcularTotal(productos) {
  let total = 0;
  productos.forEach((p) => {
    total = total + p.precio;
  });
  return total;
}

module.exports = { formatearPrecio, calcularTotal };
`,
    },
  },
  {
    ch: 0, title: 'El total no cierra',
    story: 'La caja del día. El total dice <em>NaN</em>. Yo sé de muebles, no sé qué es NaN, pero sé que no es plata.',
    lesson: '<p><code>NaN</code> quiere decir <em>Not a Number</em>: algo que no era número entró en una cuenta. Si un producto no tiene la propiedad <code>precio</code>, leerla da <code>undefined</code>, y <code>45000 + undefined</code> es <code>NaN</code>.</p><p>Leé la salida línea por línea: el síntoma aparece antes del total. Un <code>$undefined</code> te dice exactamente qué producto tiene el dato mal.</p><p>Variante: si el precio fuera un string (<code>"180000"</code>), el <code>+</code> no suma, <strong>pega</strong>: <code>"45000180000"</code>. Otro síntoma, misma causa: un dato que no es número.</p>',
    task: 'Encontrá en <code>productos.js</code> el producto con el dato mal y corregilo.',
    hint: 'Compará las claves de los cinco productos. Una está escrita distinto.',
    files: {
      'app.js': `const catalogo = require("./productos");

let total = 0;
catalogo.forEach((producto) => {
  console.log(\`\${producto.nombre} — $\${producto.precio}\`);
  total = total + producto.precio;
});

console.log("Cantidad:", catalogo.length);
console.log("Total:", total);
`,
      'productos.js': CATALOGO_5_ROTO,
    },
    entry: 'app.js',
    expected: LISTADO + '\nPerchero de Pie — $12000\nCantidad: 5\nTotal: 652000',
    solution: { 'productos.js': CATALOGO_5_OK },
  },
  {
    ch: 0, title: 'De fábrica',
    story: 'Ahora el inventario del depósito, que está en un archivo de texto. El programa que lo lee no encuentra... ¿fs? Yo no tengo ningún archivo que se llame así.',
    lesson: '<p>Además de las cajas que armamos nosotros, Node trae cajas <strong>de fábrica</strong>. La primera que importa es <code>fs</code>, <em>file system</em>: leer y escribir archivos. Las de fábrica se piden <strong>sin</strong> punto-barra:</p><pre>const fs = require("fs");</pre><p>Regla: sin punto es de fábrica; con punto es nuestro.</p>',
    task: 'Arreglá el <code>require</code> de <code>leer.js</code>.',
    hint: 'fs no es un archivo tuyo. Sacale el ./',
    files: {
      'leer.js': `const fs = require("./fs");

fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  if (error) {
    console.log("No pude leer el inventario:", error.message);
    return;
  }
  console.log("Inventario de Hermanos Jota:");
  console.log(contenido);
});
`,
      'inventario.txt': INVENTARIO,
    },
    entry: 'leer.js',
    expected: INVENTARIO_SALIDA,
    solution: {
      'leer.js': `const fs = require("fs");

fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  if (error) {
    console.log("No pude leer el inventario:", error.message);
    return;
  }
  console.log("Inventario de Hermanos Jota:");
  console.log(contenido);
});
`,
    },
  },
  // ---- Capítulo 2: El depósito ----
  {
    ch: 1, title: 'En qué idioma',
    story: 'El inventario sale, pero en jeroglíficos. Yo pedí una lista de muebles, no esto.',
    lesson: '<p>Un archivo en disco son bytes. Si no le decís a <code>readFile</code> en qué idioma leerlos, te devuelve un <code>Buffer</code>: los bytes crudos en hexadecimal. Le tenés que pasar la codificación:</p><pre>fs.readFile("inventario.txt", "utf8", (error, contenido) => { ... });</pre>',
    task: 'Agregá lo que falta en la llamada a <code>readFile</code> para que salga texto.',
    hint: 'Entre el nombre del archivo y el callback va "utf8".',
    files: {
      'leer.js': `const fs = require("fs");

fs.readFile("inventario.txt", (error, contenido) => {
  if (error) {
    console.log("No pude leer el inventario:", error.message);
    return;
  }
  console.log("Stock en el depósito:");
  console.log(contenido);
});
`,
      'inventario.txt': INVENTARIO,
    },
    entry: 'leer.js',
    expected: 'Stock en el depósito:\n' + INVENTARIO,
    solution: {
      'leer.js': `const fs = require("fs");

fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  if (error) {
    console.log("No pude leer el inventario:", error.message);
    return;
  }
  console.log("Stock en el depósito:");
  console.log(contenido);
});
`,
    },
  },
  {
    ch: 1, title: 'Afuera del callback',
    story: 'Otra vez <em>undefined</em>. Esta vez el archivo se lee bien, lo vi. Pero cuando lo muestra, no hay nada.',
    lesson: '<p>Leer del disco lleva tiempo. <code>readFile</code> no espera: <strong>anota</strong> que cuando el archivo esté, tiene que llamar a tu función. Mientras tanto, el programa sigue con la línea de abajo.</p><p>Por eso <code>console.log(contenido)</code> afuera del callback corre <em>antes</em> de que el archivo llegue: en ese momento <code>contenido</code> todavía no tiene nada. El dato solo existe <strong>adentro</strong> del callback.</p>',
    task: 'Mové lo que muestra el inventario adentro del callback de <code>readFile</code>.',
    hint: 'Los dos console.log tienen que quedar dentro de la función flecha que recibe (error, texto).',
    files: {
      'leer.js': `const fs = require("fs");

let contenido;
fs.readFile("inventario.txt", "utf8", (error, texto) => {
  contenido = texto;
});

console.log("Lo que hay en el depósito:");
console.log(contenido);
`,
      'inventario.txt': INVENTARIO,
    },
    entry: 'leer.js',
    expected: 'Lo que hay en el depósito:\n' + INVENTARIO,
    solution: {
      'leer.js': `const fs = require("fs");

fs.readFile("inventario.txt", "utf8", (error, texto) => {
  console.log("Lo que hay en el depósito:");
  console.log(texto);
});
`,
    },
  },
  {
    ch: 1, title: 'Anota y sigue',
    story: 'Necesito saber cuántos renglones tiene el inventario. El programa dice cero, y después muestra cuatro. ¿En qué quedamos?',
    lesson: '<p>Mirá el orden de la salida: "Pedí el inventario, sigo con lo mío..." aparece <strong>antes</strong> que el inventario. Eso es JavaScript: anota y sigue. Es el barista que toma el pedido y atiende al siguiente.</p><p>El conteo se hace adentro del callback, pero se muestra afuera, antes de que el callback corra. En ese momento <code>muebles</code> todavía vale <code>0</code>. Lo que dependa del archivo va adentro del callback.</p>',
    task: 'Hacé que el conteo se muestre después del inventario, con el número correcto. La línea "sigo con lo mío" tiene que seguir saliendo primero.',
    hint: 'Mové el console.log del conteo adentro del callback, después de mostrar el contenido.',
    files: {
      'leer.js': `const fs = require("fs");

let muebles = 0;
fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  const lineas = contenido.trim().split("\\n");
  muebles = lineas.length;
  console.log(contenido);
});

console.log("Pedí el inventario, sigo con lo mío...");
console.log("Muebles en el depósito:", muebles);
`,
      'inventario.txt': INVENTARIO,
    },
    entry: 'leer.js',
    // INVENTARIO ends with "\n" and console.log adds its own, so there is a
    // blank line before the count, exactly as in real Node.
    expected: 'Pedí el inventario, sigo con lo mío...\n' + INVENTARIO + '\nMuebles en el depósito: 4',
    solution: {
      'leer.js': `const fs = require("fs");

fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  const lineas = contenido.trim().split("\\n");
  const muebles = lineas.length;
  console.log(contenido);
  console.log("Muebles en el depósito:", muebles);
});

console.log("Pedí el inventario, sigo con lo mío...");
`,
    },
  },
  {
    ch: 1, title: 'Que no explote',
    story: 'Renombré el inventario a <code>inventario-viejo.txt</code> para hacer uno nuevo. El programa avisa que no lo encuentra, bien, pero después tira un error rojo enorme. Si no lo encuentra, que avise y listo.',
    lesson: '<p>La costumbre de Node: el callback recibe <code>(error, contenido)</code>. <strong>Primero el error, después el dato.</strong> Si <code>error</code> no es <code>null</code>, salió mal y <code>contenido</code> es <code>undefined</code>.</p><p>Avisar no alcanza: si después del <code>if (error)</code> seguís usando <code>contenido</code>, explota. Hay que <strong>cortar</strong> ahí:</p><pre>if (error) {\n  console.log("No pude leer el inventario:", error.message);\n  return;\n}</pre>',
    task: 'Hacé que el programa muestre solo el aviso de error y no explote. No cambies el nombre del archivo: el inventario nuevo lo hace Ramón después.',
    hint: 'Falta un return adentro del if (error).',
    files: {
      'leer.js': `const fs = require("fs");

fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  if (error) {
    console.log("No encontré el inventario:", error.message);
  }
  const lineas = contenido.trim().split("\\n");
  console.log("Muebles en el depósito:", lineas.length);
});
`,
      'inventario-viejo.txt': INVENTARIO,
    },
    entry: 'leer.js',
    expected: "No encontré el inventario: ENOENT: no such file or directory, open 'inventario.txt'",
    solution: {
      'leer.js': `const fs = require("fs");

fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  if (error) {
    console.log("No encontré el inventario:", error.message);
    return;
  }
  const lineas = contenido.trim().split("\\n");
  console.log("Muebles en el depósito:", lineas.length);
});
`,
    },
    check: files => /\breturn\b/.test(files['leer.js']) && /\.split\(/.test(files['leer.js']),
  },
  {
    ch: 1, title: 'Caso borde',
    story: 'Último. Quiero saber cuántos muebles están sin stock para pedirlos. El programa dice dos. Yo cuento uno. Y yo cuento bien.',
    lesson: '<p>El programa busca líneas que contengan <code>"0 unidades"</code>. Pero <code>"10 unidades"</code> también contiene <code>"0 unidades"</code>. Eso es un <strong>caso borde</strong>: un dato válido que tu condición no previó.</p><p>Hay que ser más preciso. Por ejemplo, mirar cómo <em>termina</em> la línea:</p><pre>linea.endsWith("- 0 unidades")</pre>',
    task: 'Corregí la condición para que cuente solo los muebles con exactamente 0 unidades.',
    hint: 'includes("0 unidades") agarra "10 unidades". Probá con endsWith.',
    files: {
      'leer.js': `const fs = require("fs");

fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  if (error) {
    console.log("No pude leer el inventario:", error.message);
    return;
  }
  const lineas = contenido.trim().split("\\n");
  let sinStock = 0;
  lineas.forEach((linea) => {
    if (linea.includes("0 unidades")) {
      sinStock = sinStock + 1;
    }
  });
  console.log("Muebles sin stock:", sinStock);
});
`,
      'inventario.txt': INVENTARIO + 'Perchero de Pie - 10 unidades\n',
    },
    entry: 'leer.js',
    expected: 'Muebles sin stock: 1',
    solution: {
      'leer.js': `const fs = require("fs");

fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  if (error) {
    console.log("No pude leer el inventario:", error.message);
    return;
  }
  const lineas = contenido.trim().split("\\n");
  let sinStock = 0;
  lineas.forEach((linea) => {
    if (linea.endsWith("- 0 unidades")) {
      sinStock = sinStock + 1;
    }
  });
  console.log("Muebles sin stock:", sinStock);
});
`,
    },
  },
];
```
Notes for the implementer:
- `INVENTARIO` ends with `\n`, so outputs that print it as the last line end with a trailing newline that `normalize` strips. When something is printed after it (level 8), a blank line appears in between, as in real Node; the expected string carries that blank line.
- Cross-check design: levels that share a file name must produce different output. Level 4 uses a 5-product catalog (vs level 2's 4 products); level 7 prints "Lo que hay en el depósito:" (vs level 5's "Inventario de Hermanos Jota:" and level 6's "Stock en el depósito:"); level 9 prints "No encontré el inventario:" (vs "No pude leer el inventario:" in levels 5, 6 and 10). Keep these distinct if you edit copy.
- The `\`` and `\${` escapes inside the outer template literals are required because level files are themselves template literals.
- `toLocaleString("es-AR")` requires ICU; Node ≥ 13 ships full ICU. The "solution produces expected output" test guards this.
- Until Task 5 exists, `test/load.js`'s `loadGame` evaluates names that do not exist yet (`state`, `loadLevel`, ...). For this task, temporarily define them in `index.html` as `let state, loadLevel, selectTab, setFileContent, run, saveProgress, restoreProgress, unlockedUpTo;` placeholders right after the data section, with a comment `// UI bindings are defined in the UI section below` that Task 5 replaces. This is scaffolding, not a placeholder in the deliverable.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all runtime tests pass; `levels.test.js` 10×3 + 2 pass. If a level's "initial files do NOT produce expected" test fails, that level does not demonstrate its symptom: fix the level, not the test. If the cross-check fails, make the two levels' outputs differ (change a header string in one of them).

- [ ] **Step 5: Commit**

```bash
git add index.html test/levels.test.js
git commit -m "feat: chapters and ten levels with expected output and solutions"
```

---

### Task 4: UI, state, persistence, run loop

**Files:**
- Modify: `index.html` (CSS in `<style>`, body markup, UI section of the script)
- Modify: `test/levels.test.js` (append UI tests)

**Interfaces:**
- Consumes: `runNode`, `normalize`, `withSolution`, `LEVELS`, `CHAPTERS`.
- Produces (top-level bindings, all needed by `test/load.js`):
  - `state = { current: number, done: Set<number>, files: { [levelIndex]: { [name]: string } } }`
  - `loadLevel(i: number): void` — sets `state.current`, ensures `state.files[i]` exists (copy of `LEVELS[i].files`), renders guide, tabs, editor, expected terminal, clears player terminal.
  - `selectTab(name: string): void` — flushes the textarea into the active file, switches active file, fills textarea.
  - `setFileContent(name: string, text: string): void` — writes into `state.files[state.current][name]`; if `name` is the active tab, updates the textarea too.
  - `run(): void` — flushes textarea, calls `runNode`, prints output in `#terminal`, evaluates win, updates `state.done`, saves.
  - `saveProgress(): void` / `restoreProgress(): void` — `localStorage` key `la-trastienda`, shape `{ done: number[], files: {...}, current: number }`.
  - `unlockedUpTo(): number` — first index not in `done`, capped to `LEVELS.length - 1`.

- [ ] **Step 1: Write the failing UI tests**

Append to `test/levels.test.js`:
```js
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
```
The second assertion documents the honest boundary (README must say the same).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: UI tests fail (`loadLevel is not a function` or missing `#terminal`).

- [ ] **Step 3: Write the markup**

Replace the `<body>` shell. Structure (ids are contract with tests):
```html
<body>
<div class="app">
  <aside class="left">
    <header class="brand">
      <h1>La Trastienda</h1>
      <p class="sub">Mueblería Hermanos Jota · módulos de Node.js</p>
    </header>

    <nav aria-label="Capítulos" class="chapters" id="chapters"></nav>
    <nav aria-label="Niveles" class="levels" id="levels"></nav>

    <section class="guide" aria-label="Ramón, encargado del depósito">
      <div class="avatar" aria-hidden="true">🧔</div>
      <div class="bubble">
        <p class="who">Ramón</p>
        <div id="story"></div>
      </div>
    </section>

    <section class="lesson" id="lesson"></section>
    <section class="task">
      <h2>Consigna</h2>
      <div id="task"></div>
      <div class="actions">
        <button type="button" id="hintBtn">Pista</button>
        <button type="button" id="solutionBtn">Ver solución</button>
      </div>
      <p id="hint" hidden></p>
      <pre id="solutionView" hidden></pre>
    </section>

    <p class="foot">Progreso guardado en este navegador. <a href="https://github.com/PedroBraude/node-trastienda">Código</a></p>
  </aside>

  <main class="right">
    <div class="level-head">
      <span class="chip" id="levelChip"></span>
      <h2 id="levelTitle"></h2>
    </div>

    <div class="editor">
      <div role="tablist" id="tabs" aria-label="Archivos"></div>
      <label for="code" class="sr-only">Contenido del archivo</label>
      <textarea id="code" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
      <div class="run-row">
        <button type="button" id="runBtn" class="primary">Correr <code id="runCmd">node app.js</code></button>
        <span class="kbd">Ctrl + Enter</span>
      </div>
    </div>

    <div class="terminals">
      <section class="term">
        <h3>Tu terminal</h3>
        <pre id="terminal" aria-live="polite"></pre>
      </section>
      <section class="term goal">
        <h3>Debería salir</h3>
        <pre id="expected"></pre>
      </section>
    </div>

    <p id="feedback" class="feedback" aria-live="polite"></p>
    <div id="nextRow"></div>
  </main>
</div>

<div id="win" class="win" hidden>
  <div class="win-card">
    <h2>La trastienda anda</h2>
    <p>Diez archivos arreglados leyendo lo que decía la terminal. Eso es el trabajo: leer el error, encontrar la causa, corregir.</p>
    <p>Este mismo <code>productos.js</code> es el que la semana que viene va a responder <code>GET /productos</code> desde Express. No cambia el dato: cambia quién lo pide.</p>
    <button type="button" id="resetBtn">Volver a empezar</button>
  </div>
</div>
<script> ... </script>
</body>
```

- [ ] **Step 4: CSS**

Add a `<style>` in `<head>`. Start from Terrario's CSS (`~/Github/js-dom-terrario/index.html` lines 29–221): keep its variables, `.app` grid (two columns, `@media (max-width: 860px)` → one column), `.left`/`.right`, `.guide`/`.bubble`, buttons, `.sr-only`, `prefers-reduced-motion`. Replace the stage/goal styles with:
```css
.editor { display: flex; flex-direction: column; gap: 6px; }
#tabs { display: flex; gap: 4px; flex-wrap: wrap; }
#tabs button { border: 1px solid var(--line); border-bottom: none; background: var(--panel); padding: 6px 12px; border-radius: 8px 8px 0 0; font-family: ui-monospace, monospace; cursor: pointer; }
#tabs button[aria-selected="true"] { background: var(--ink); color: var(--paper); }
#code { width: 100%; min-height: 260px; font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 12px; border: 1px solid var(--line); border-radius: 0 8px 8px 8px; resize: vertical; tab-size: 2; }
.terminals { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 560px) { .terminals { grid-template-columns: 1fr; } }
.term pre { background: #111; color: #e6e6e6; padding: 12px; border-radius: 8px; min-height: 160px; overflow-x: auto; font: 13px/1.5 ui-monospace, monospace; white-space: pre-wrap; margin: 0; }
.term.goal pre { color: #b9f6ca; }
.term pre .err { color: #ff8a80; }
.term pre .prompt { color: #8ab4f8; }
.feedback.ok { color: var(--ok); font-weight: 600; }
.feedback.bad { color: var(--bad); }
.win[hidden] { display: none; }
.win { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; padding: 16px; }
.win-card { background: var(--paper); padding: 24px; border-radius: 12px; max-width: 520px; }
```
Palette: warm wood tones (`--paper: #fbf5ec; --ink: #2b2118; --line: #d9c7b0; --panel: #f3e7d6; --ok: #2e7d32; --bad: #b3261e; --accent: #b5651d`). Define in `:root` and use consistently; the page must not depend on Terrario's greens.

- [ ] **Step 5: UI script**

Append after the data section (replacing the scaffolding placeholders from Task 3):
```js
// ---------- State & persistence ----------
const STORE_KEY = 'la-trastienda';
const state = { current: 0, done: new Set(), files: {} };

function saveProgress() {
  const data = { done: [...state.done], files: state.files, current: state.current };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
}

function restoreProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.done = new Set(Array.isArray(data.done) ? data.done : []);
    state.files = data.files && typeof data.files === 'object' ? data.files : {};
    state.current = Number.isInteger(data.current) ? data.current : 0;
  } catch (e) { /* corrupt storage: start fresh */ }
}

function unlockedUpTo() {
  let n = 0;
  while (n < LEVELS.length - 1 && state.done.has(n)) n++;
  return n;
}

// ---------- UI ----------
const $ = sel => document.querySelector(sel);
let activeFile = null;

function levelFiles() {
  const i = state.current;
  if (!state.files[i]) state.files[i] = { ...LEVELS[i].files };
  return state.files[i];
}

function flushEditor() {
  if (activeFile !== null) levelFiles()[activeFile] = $('#code').value;
}

function setFileContent(name, text) {
  levelFiles()[name] = text;
  if (name === activeFile) $('#code').value = text;
}

function selectTab(name) {
  flushEditor();
  activeFile = name;
  $('#code').value = levelFiles()[name];
  for (const b of $('#tabs').querySelectorAll('button')) {
    const on = b.dataset.file === name;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  }
}

function renderTabs() {
  const tabs = $('#tabs');
  tabs.innerHTML = '';
  for (const name of Object.keys(levelFiles())) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.file = name;
    b.textContent = name;
    b.addEventListener('click', () => selectTab(name));
    tabs.appendChild(b);
  }
}

function renderNav() {
  const chapters = $('#chapters');
  chapters.innerHTML = '';
  CHAPTERS.forEach((c, i) => {
    const done = LEVELS.every((l, n) => l.ch !== i || state.done.has(n));
    const el = document.createElement('div');
    el.className = 'chapter' + (i === LEVELS[state.current].ch ? ' active' : '') + (done ? ' done' : '');
    el.innerHTML = '<strong>' + (i + 1) + '. ' + c.name + '</strong><span>' + c.desc + '</span>';
    chapters.appendChild(el);
  });
  const levels = $('#levels');
  levels.innerHTML = '';
  const max = unlockedUpTo();
  LEVELS.forEach((l, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(i + 1);
    b.title = l.title;
    b.disabled = i > max;
    b.setAttribute('aria-current', i === state.current ? 'true' : 'false');
    if (state.done.has(i)) b.classList.add('done');
    b.addEventListener('click', () => loadLevel(i));
    levels.appendChild(b);
  });
}

function setTerminal(el, entry, text, isError) {
  el.innerHTML = '';
  const prompt = document.createElement('span');
  prompt.className = 'prompt';
  prompt.textContent = '$ node ' + entry + '\n';
  el.appendChild(prompt);
  const body = document.createElement('span');
  if (isError) body.className = 'err';
  body.textContent = text;
  el.appendChild(body);
}

function loadLevel(i) {
  flushEditor();
  state.current = i;
  activeFile = null;
  const lv = LEVELS[i];
  $('#levelChip').textContent = 'Capítulo ' + (lv.ch + 1) + ' · Nivel ' + (i + 1) + ' de ' + LEVELS.length;
  $('#levelTitle').textContent = lv.title;
  $('#story').innerHTML = lv.story;
  $('#lesson').innerHTML = lv.lesson;
  $('#task').innerHTML = lv.task;
  $('#hint').hidden = true;
  $('#hint').textContent = lv.hint;
  $('#solutionView').hidden = true;
  $('#runCmd').textContent = 'node ' + lv.entry;
  setTerminal($('#expected'), lv.entry, lv.expected, false);
  $('#terminal').innerHTML = '';
  $('#feedback').textContent = '';
  $('#feedback').className = 'feedback';
  $('#nextRow').innerHTML = '';
  renderTabs();
  selectTab(lv.entry);
  renderNav();
  saveProgress();
}

const PRAISE = ['Eso. Leíste el error y lo arreglaste.', 'Ahí está. La terminal siempre te dice dónde mirar.', 'Bien. Un archivo menos roto en la trastienda.'];

function run() {
  flushEditor();
  const i = state.current;
  const lv = LEVELS[i];
  const files = levelFiles();
  const r = runNode(files, lv.entry);
  setTerminal($('#terminal'), lv.entry, r.output, !r.ok);
  const won = normalize(r.output) === normalize(lv.expected) && (!lv.check || lv.check(files));
  const fb = $('#feedback');
  $('#nextRow').innerHTML = '';
  if (!won) {
    fb.className = 'feedback bad';
    fb.textContent = r.ok
      ? 'Corre, pero la salida no es la que debería. Compará las dos terminales línea por línea.'
      : 'La terminal muestra un error. Leelo: dice qué pasó y en qué archivo.';
    saveProgress();
    return;
  }
  const first = !state.done.has(i);
  state.done.add(i);
  fb.className = 'feedback ok';
  let msg = PRAISE[i % PRAISE.length];
  const ch = lv.ch;
  const chapterDone = LEVELS.every((l, n) => l.ch !== ch || state.done.has(n));
  if (first && chapterDone) msg += ' ' + CHAPTERS[ch].cierre;
  fb.textContent = msg;
  renderNav();
  saveProgress();
  if (state.done.size === LEVELS.length) {
    $('#win').hidden = false;
    $('#resetBtn').focus();
    return;
  }
  if (i + 1 < LEVELS.length) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'primary';
    b.textContent = 'Siguiente nivel';
    b.addEventListener('click', () => loadLevel(i + 1));
    $('#nextRow').appendChild(b);
  }
}

function showSolution() {
  const lv = LEVELS[state.current];
  const view = $('#solutionView');
  view.textContent = Object.entries(lv.solution)
    .map(([name, text]) => '// ' + name + '\n' + text).join('\n');
  view.hidden = false;
}

// ---------- Keyboard ----------
let escapeArmed = false;
$('#code').addEventListener('keydown', e => {
  const ta = e.target;
  if (e.key === 'Escape') { escapeArmed = true; return; }
  if (e.key === 'Tab' && !escapeArmed) {
    e.preventDefault();
    const s = ta.selectionStart, end = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = s + 2;
    return;
  }
  escapeArmed = false;
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
});

// ---------- Boot ----------
$('#runBtn').addEventListener('click', run);
$('#hintBtn').addEventListener('click', () => { $('#hint').hidden = false; });
$('#solutionBtn').addEventListener('click', showSolution);
$('#resetBtn').addEventListener('click', () => {
  state.done = new Set(); state.files = {}; state.current = 0;
  saveProgress();
  $('#win').hidden = true;
  loadLevel(0);
});
restoreProgress();
loadLevel(Math.min(state.current, unlockedUpTo()));
```
Bindings `restoreProgress` and `unlockedUpTo` must be exported by `test/load.js`.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: all pass. Common failures: the `Tab` test needs the listener bound before tests run (it is, at boot); the `#win` test needs `hidden` toggled via the property, not `style.display`.

- [ ] **Step 7: Manual check**

Run `npx serve .` (or open `index.html`) and click through levels 1, 5, 6, 9 in a browser. Check: tabs switch, Ctrl+Enter runs, error lines are red, mobile width (< 860px) stacks to one column with no horizontal scroll.

- [ ] **Step 8: Commit**

```bash
git add index.html test/levels.test.js test/load.js
git commit -m "feat: game UI with file tabs, terminals, progress and win screen"
```

---

### Task 5: README, LICENSE, CLAUDE.md, Pages workflow, share meta

**Files:**
- Create: `README.md`, `LICENSE`, `CLAUDE.md`, `.github/workflows/pages.yml`, `manifest.webmanifest`
- Modify: `index.html` `<head>` (meta tags, manifest link)

- [ ] **Step 1: Copy and adapt from Terrario**

Read `~/Github/js-dom-terrario/README.md`, `LICENSE`, `CLAUDE.md`, `.github/workflows/*.yml`, `manifest.webmanifest`, and the `<head>` of its `index.html`. Reproduce each for this project:
- `LICENSE`: MIT, "Pedro Lucas Braude", year 2026.
- `.github/workflows/pages.yml`: identical trigger (push to `main`), `npm ci` + `npm test`, then upload the repo root and deploy to Pages.
- `manifest.webmanifest`: name "La Trastienda", short_name "Trastienda", `start_url: "./"`, theme color `#b5651d`, background `#fbf5ec`. No icons yet (add `docs/` icon later if desired; the manifest is valid without them).
- `<head>` meta: `description` ("Aprendé módulos de Node.js arreglando código roto en la trastienda de Mueblería Hermanos Jota"), Open Graph title/description/url (`https://pedrobraude.github.io/node-trastienda/`), `twitter:card summary`, `<link rel="manifest" href="manifest.webmanifest">`. Skip `og:image` until a screenshot exists.

- [ ] **Step 2: Write README.md** (Spanish, voseo)

Sections: qué es (una línea + link al juego), cómo jugar (leés la terminal, arreglás el archivo, Ctrl+Enter), qué enseña (lista de los 10 niveles por título), cómo correr local y tests, nota de frontera de seguridad (copiar la nota de Terrario: no es sandbox, self-XSS, si el código se comparte va a iframe sandbox), licencia.

- [ ] **Step 3: Write CLAUDE.md**

Mirror `~/Github/js-dom-terrario/CLAUDE.md` structure: estructura (un `index.html`, `test/`, `docs/`), reglas que no se negocian (sin frameworks/build, no cambiar historia ni nombres ni orden de niveles, rioplatense, `new Function` no es sandbox, `localStorage`, sin atribución de IA, conventional commits), cómo correr, `npm test` con los 10 niveles.

- [ ] **Step 4: Run tests and commit**

Run: `npm test` (expected: all pass).
```bash
git add README.md LICENSE CLAUDE.md .github/workflows/pages.yml manifest.webmanifest index.html
git commit -m "docs: README, license, project rules, Pages workflow and share meta"
```

---

### Task 6: Publish

**Files:** none new.

- [ ] **Step 1: Create the public repo and push**

```bash
gh repo create PedroBraude/node-trastienda --public --source=. --remote=origin --description "Juego para aprender módulos de Node.js arreglando código roto" --push
```

- [ ] **Step 2: Enable Pages with GitHub Actions as the source**

```bash
gh api -X POST repos/PedroBraude/node-trastienda/pages -f build_type=workflow
```
If it returns 409 (already exists), continue.

- [ ] **Step 3: Verify**

Wait for the workflow: `gh run watch` (or `gh run list --limit 1`). Then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://pedrobraude.github.io/node-trastienda/
```
Expected: `200`. Report the URL.
