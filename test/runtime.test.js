const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRuntime } = require('./load');

const { runNode, inspect } = loadRuntime();

const PRODUCTS_JS = `const catalogo = [
  { id: 1, nombre: "Silla", precio: 10 },
  { id: 2, nombre: "Mesa", precio: 20 },
];
module.exports = catalogo;
`;

test('require with ./ resolves a local module and runs it', () => {
  const r = runNode({
    'app.js': 'const c = require("./productos");\nconsole.log("Total:", c.length);',
    'productos.js': PRODUCTS_JS,
  }, 'app.js');
  assert.equal(r.ok, true);
  assert.equal(r.output, 'Total: 2');
});

test('require with ./x.js resolves like ./x', () => {
  const r = runNode({
    'app.js': 'console.log(require("./productos.js").length);',
    'productos.js': PRODUCTS_JS,
  }, 'app.js');
  assert.equal(r.output, '2');
});

test('require without ./ fails with Cannot find module and a require stack', () => {
  const r = runNode({
    'app.js': 'const c = require("productos");\nconsole.log("never");',
    'productos.js': PRODUCTS_JS,
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

test('document and window are undefined inside player code', () => {
  const r = runNode({ 'a.js': 'console.log(typeof document, typeof window);' }, 'a.js');
  assert.equal(r.output, 'undefined undefined');
});

const INVENTORY_TXT = 'Silla de Comedor - 15 unidades\nMesa de Roble - 5 unidades\nSofá de 3 Cuerpos - 0 unidades\nBiblioteca Modular - 8 unidades';

test('readFile with utf8 delivers the text after the main module finishes', () => {
  const r = runNode({
    'leer.js': `const fs = require("fs");
fs.readFile("inventario.txt", "utf8", (error, contenido) => {
  console.log(contenido);
});
console.log("Pedí el archivo, sigo con lo mío...");`,
    'inventario.txt': INVENTORY_TXT,
  }, 'leer.js');
  assert.equal(r.ok, true);
  assert.equal(r.output, 'Pedí el archivo, sigo con lo mío...\n' + INVENTORY_TXT);
});

test('readFile without encoding delivers a Buffer that prints like Node', () => {
  const r = runNode({
    'leer.js': 'require("fs").readFile("inventario.txt", (e, c) => console.log(c));',
    'inventario.txt': INVENTORY_TXT,
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
