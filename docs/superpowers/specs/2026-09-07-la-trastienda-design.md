# La Trastienda — diseño

Juego educativo estilo Terrario DOM para aprender módulos de Node.js (`require`, `module.exports`, `fs.readFile`). Tarea para el lunes 14/9/2026, anunciada en la clase 7 del Sprint 3 ("Construyendo la Trastienda de Mueblería Hermanos Jota").

## Objetivo

Que el jugador aprenda a **leer errores de Node y arreglarlos**. Cada nivel muestra archivos ya escritos con un bug y una terminal con el síntoma real. El jugador corrige el archivo hasta que la salida coincide con la esperada.

Fuera de alcance: REPL, `process`, NPM, `package.json`, Promises, `http`, Express.

## Reglas que se heredan de Terrario

- Un solo `index.html` (HTML, CSS y JS). Deployable arrastrando la carpeta a cualquier hosting estático.
- Vanilla JS, sin frameworks, sin bundler, sin build step.
- Textos en español rioplatense (voseo).
- Progreso en `localStorage`. Sin nube.
- El código del jugador corre con `new Function`. **No es un sandbox**: modelo de amenaza self-XSS solamente. No prometer aislamiento.
- Tests con jsdom que resuelven cada nivel con su `solution`.
- Conventional commits, sin atribución de IA.

## Historia (liviana)

La trastienda de Mueblería Hermanos Jota tiene un sistema en Node que dejó de andar. El guía es **Ramón**, encargado del depósito: sabe de muebles, no de código. Cada nivel abre con una línea de Ramón (qué se rompió y qué necesita), y cada capítulo cierra con una frase de él cuando vuelve a funcionar esa parte del sistema. No hay familia acumulable ni pantalla de personajes. Al terminar los 10 niveles, pantalla de cierre: la trastienda anda, adelanto de que "el lunes ese mismo `productos.js` responde `GET /productos`".

## Contenido

### Datos compartidos

Catálogo (mismo que la demo de clase):

```js
const catalogo = [
  { id: 1, nombre: "Silla de Comedor Nórdica", precio: 45000 },
  { id: 2, nombre: "Mesa de Roble Macizo", precio: 180000 },
  { id: 3, nombre: "Sofá de 3 Cuerpos Lino", precio: 320000 },
  { id: 4, nombre: "Biblioteca Modular Pino", precio: 95000 },
];
```

Inventario (`inventario.txt`):

```
Silla de Comedor - 15 unidades
Mesa de Roble - 5 unidades
Sofá de 3 Cuerpos - 0 unidades
Biblioteca Modular - 8 unidades
```

### Capítulo 1 — La caja (módulos)

| # | Título | Archivos | Bug | Síntoma en la terminal | Arreglo |
|---|---|---|---|---|---|
| 1 | El punto-barra | `app.js`, `productos.js` | `require("productos")` | `Error: Cannot find module 'productos'` | `require("./productos")` |
| 2 | La etiqueta de la caja | `app.js`, `productos.js` | falta `module.exports = catalogo` | `Productos en el catálogo: undefined` y luego `TypeError: catalogo.forEach is not a function` | agregar `module.exports = catalogo` |
| 3 | Varias herramientas | `app.js`, `productos.js`, `utilidades.js` | `module.exports = formatearPrecio` (una sola) con `const { formatearPrecio, calcularTotal } = require("./utilidades")` | `TypeError: calcularTotal is not a function` | `module.exports = { formatearPrecio, calcularTotal }` |
| 4 | El total no cierra | `app.js`, `productos.js` | en un producto la clave es `precios` en vez de `precio` | `Mesa de Roble Macizo — $undefined` y `Total: NaN` | corregir la clave |
| 5 | De fábrica | `leer.js`, `inventario.txt` | `require("./fs")` | `Error: Cannot find module './fs'` | `require("fs")` |

Nota sobre el nivel 4: en el plan de clase figura "Total da `NaN` → algún precio es string". Con `total = total + p.precio` un string **concatena** (`"45000180000..."`), no da `NaN`. `NaN` aparece con `undefined`, o sea con una clave mal escrita. El nivel usa la clave mal escrita para que el síntoma sea el real. La lección menciona el caso string como variante.

### Capítulo 2 — El depósito (`fs`)

| # | Título | Archivos | Bug | Síntoma | Arreglo |
|---|---|---|---|---|---|
| 6 | En qué idioma | `leer.js`, `inventario.txt` | `readFile("inventario.txt", callback)` sin `"utf8"` | `<Buffer 53 69 6c 6c 61 20 ... N more bytes>` | agregar `"utf8"` |
| 7 | Afuera del callback | `leer.js`, `inventario.txt` | el callback solo asigna `contenido = texto`; el `console.log(contenido)` está afuera | `Inventario:` seguido de `undefined` | mover los `console.log` adentro del callback |
| 8 | Anota y sigue | `leer.js`, `inventario.txt` | el callback cuenta líneas en `muebles`; `console.log("Muebles:", muebles)` está afuera | `Pedí el inventario, sigo con lo mío...`, `Muebles: 0`, y recién después el inventario | mover el conteo adentro del callback |
| 9 | Que no explote | `leer.js`, `inventario-viejo.txt` | lee `inventario.txt` (no existe); `if (error)` imprime el mensaje pero no hace `return`; después usa `contenido.split` | mensaje `No pude leer el inventario: ENOENT: no such file or directory, open 'inventario.txt'` y abajo `TypeError: Cannot read properties of undefined (reading 'split')` | agregar `return` |
| 10 | Caso borde | `leer.js`, `inventario.txt` (con una línea extra `Perchero de Pie - 10 unidades`) | cuenta sin stock con `linea.includes("0 unidades")` | `Muebles sin stock: 2` (son 1) | `linea.endsWith("- 0 unidades")` |

El nivel 9 además exige que `leer.js` contenga `return` (check extra): borrar el código de abajo también "arregla" la salida pero no enseña la lección.

### Campos de cada nivel

```js
{
  ch: 0,
  title: "El punto-barra",
  story: "...",        // línea de Ramón (HTML)
  lesson: "...",       // concepto corto con <pre> (HTML)
  task: "...",         // consigna (HTML)
  hint: "...",
  files: { "app.js": "...", "productos.js": "..." },  // estado inicial
  entry: "app.js",     // qué corre `node`
  expected: "...",     // salida esperada exacta
  solution: { "app.js": "..." },  // solo los archivos que cambian; se mezcla sobre files
  check: files => true, // opcional; recibe los archivos del jugador
}
```

`CHAPTERS = [{ name: "La caja", desc, cierre }, { name: "El depósito", desc, cierre }]`.

## Runtime falso

`runNode(files, entry)` devuelve `{ output: string, ok: boolean }`. `output` es exactamente lo que se ve en la terminal.

- **Módulos.** Cada archivo `.js` se envuelve con `new Function("require", "module", "exports", "console", "__dirname", '"use strict";\n' + code)`. `module = { exports: {} }`. Cache por archivo dentro de una corrida (dos `require` del mismo archivo devuelven el mismo objeto). Sin `"use strict"` no hay diferencia pedagógica, pero mantiene el mismo criterio que Terrario.
- **`require(spec)`.**
  - `"fs"` → objeto `fs` falso. `"path"` → `{ join }` mínimo.
  - Empieza con `./` → busca `spec` y `spec + ".js"` en `files`. Si no está: `Error: Cannot find module './x'`.
  - Cualquier otra cosa: `Error: Cannot find module 'x'` con `Require stack:` y la ruta del archivo que lo pidió. Ruta ficticia base: `/home/jota/trastienda/`.
- **`fs.readFile(name, [encoding], callback)`.** No ejecuta el callback: lo encola. Al vaciar la cola: si `name` no está en `files`, llama `callback(error)` con `error.message = "ENOENT: no such file or directory, open 'name'"` y `error.code = "ENOENT"`. Si está y hay encoding `"utf8"`/`"utf-8"`, `callback(null, contenido)`. Si no hay encoding, `callback(null, buffer)` donde `buffer` es un objeto marcado que `console.log` formatea como Node: `<Buffer 53 69 ...>` con los primeros 50 bytes en hex y `... N more bytes` si hay más. Bytes via `TextEncoder`.
- **Cola.** Se ejecuta el módulo de entrada completo; después se vacían las tareas encoladas en orden FIFO (una tarea puede encolar otras). Sin `setTimeout`: determinístico, sincrónico, testeable.
- **`console.log(...args)`.** Une args con espacio. Strings tal cual; números, booleanos, `undefined`, `null` como Node; arrays y objetos con un `inspect` chico (`[ 1, 2, 3 ]`, `{ id: 1, nombre: 'Silla' }`); el buffer falso con su formato. Suficiente para estos niveles; no busca fidelidad total.
- **Errores no atrapados.** Cortan la corrida. Se imprimen como `${name}: ${message}` y una línea `    at /home/jota/trastienda/<archivo>`. Para `Cannot find module` se agrega `Require stack:` y `- <ruta>`. Un error dentro de un callback encolado corta lo que queda de la cola, igual que en Node.
- **Frontera.** Igual que Terrario: `new Function` con los nombres sombreados. No es sandbox; comentario en el código y nota en README con el mismo texto que Terrario.

## Validación

Al correr: `runNode(files, entry)`. Gana si `normalize(output) === normalize(expected)` y `check(files)` (si existe) es `true`. `normalize` recorta espacios al final de cada línea y líneas vacías finales. No se ignora nada más: el orden de las líneas es parte de la lección (nivel 8).

Éxito: marca el nivel en `state.done`, guarda, muestra frase de Ramón, botón "Siguiente". Si se completa un capítulo, agrega su `cierre`. Si `done.size === LEVELS.length`, pantalla final. Desbloqueo implícito como Terrario: se puede entrar hasta el primer nivel no hecho.

## Pantalla

Dos columnas, misma grilla que Terrario.

- **Izquierda:** marca, capítulos, botones de nivel (deshabilitados los bloqueados), burbuja de Ramón (`story`), lección (`lesson`), consigna (`task`), botón "Pista", botón "Ver solución" (muestra el diff en texto: qué archivo y qué línea).
- **Derecha:** pestañas de archivos (`role="tablist"`), un `textarea` por archivo (todas editables, `.txt` incluido), botón "Correr `node <entry>`" y Ctrl/Cmd+Enter, y dos terminales lado a lado con `aria-live="polite"`: "Tu terminal" y "Debería salir". Cada terminal empieza con `$ node <entry>`.
- **Teclado:** Tab inserta dos espacios; Esc y luego Tab sale del editor (misma trampa evitada que en Terrario).
- **Mobile:** una columna bajo 860px; terminales apiladas bajo 560px.
- `prefers-reduced-motion` respeta.

## Progreso

`localStorage` clave `la-trastienda`. Forma: `{ done: number[], files: { [levelIndex]: { [name]: string } }, current: number }`. Guardar en cada corrida y al cambiar de nivel. "Volver a empezar" en la pantalla final borra todo.

## Tests

`npm test` corre `node --test`. Única devDependency: `jsdom`.

`test/runtime.test.js` (el runtime solo, sin UI): `require` sin `./` tira `Cannot find module`; `./x` y `./x.js` resuelven igual; `module.exports` sin tocar es `{}`; `readFile` sin encoding entrega buffer con formato `<Buffer ...>`; archivo inexistente entrega error `ENOENT` y `contenido` `undefined`; el callback corre después del código que sigue al `readFile`; un error dentro del callback corta la cola.

`test/levels.test.js` (jsdom, carga `index.html` con `runScripts: "dangerously"`, extrae `LEVELS`, `state`, `loadLevel`, `run`, `runNode` con `win.eval`):

1. Por cada nivel: cargar, escribir `solution` en los archivos, correr, `state.done.has(i)`.
2. Por cada nivel: los `files` iniciales NO resuelven el nivel (si resuelven, el nivel no enseña nada).
3. Por cada nivel: `runNode(merge(files, solution), entry).output` normalizado es igual a `expected` (así `expected` no queda desincronizado con la solución).
4. Accesibilidad de teclado (Tab/Esc) y `aria-live` en las terminales.
5. El código del jugador no alcanza el `document` real ni `window` real (misma prueba que Terrario, adaptada).

## Repo y deploy

- `~/Github/node-trastienda`, público en `PedroBraude/node-trastienda`.
- Archivos: `index.html`, `test/`, `package.json`, `README.md`, `LICENSE` (MIT, Pedro Lucas Braude), `CLAUDE.md` (reglas de arriba), `.github/workflows/pages.yml` (test y deploy de la raíz a GitHub Pages en push a `main`, copiado de Terrario), `docs/` con captura y Open Graph cuando haya.
- Meta Open Graph y manifest como Terrario, con el nombre "La Trastienda".
