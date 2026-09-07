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

test('document and window are undefined inside player code', () => {
  const r = runNode({ 'a.js': 'console.log(typeof document, typeof window);' }, 'a.js');
  assert.equal(r.output, 'undefined undefined');
});
