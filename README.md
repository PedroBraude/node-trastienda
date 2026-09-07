# La Trastienda

Un juego para aprender módulos de Node.js: `require`, `module.exports` y `fs.readFile`. La trastienda de Mueblería Hermanos Jota tiene un sistema que dejó de andar, y Ramón (el encargado del depósito) te va guiando mientras arreglás, uno por uno, los archivos rotos.

Es un solo archivo, `index.html`. Sin frameworks, sin build, sin instalar nada.

## Cómo jugar

1. Leé lo que te cuenta Ramón: qué se rompió y qué necesita.
2. A la derecha tenés pestañas con los archivos del nivel (todos editables) y dos terminales: **la tuya** (lo que da tu código al correrlo) y **la que debería salir**.
3. Corregí el archivo y tocá **Correr `node <entry>`** (o `Ctrl+Enter`).
4. Si tu terminal coincide con la esperada, ganás el nivel y pasás al siguiente.
5. Si te trabás, **Ver pista** te orienta y **Ver solución** te muestra el diff.

Los niveles se agrupan en 2 capítulos: **La caja** (módulos) y **El depósito** (`fs`).

El progreso se guarda solo en tu navegador (`localStorage`).

## Qué enseña

**Capítulo 1 — La caja (módulos)**

1. El punto-barra — `require` con ruta relativa
2. La etiqueta de la caja — `module.exports`
3. Varias herramientas — exportar varias funciones con un objeto
4. El total no cierra — leer bien las claves de un objeto
5. De fábrica — módulos nativos (`require("fs")`)

**Capítulo 2 — El depósito (`fs`)**

6. En qué idioma — `fs.readFile` con encoding `"utf8"`
7. Afuera del callback — usar el resultado dentro del callback
8. Anota y sigue — el callback es asincrónico, el código de abajo corre antes
9. Que no explote — cortar la ejecución con `return` al manejar un error
10. Caso borde — leer con cuidado la condición, no solo el caso feliz

## Correrlo local

Alcanza con abrir `index.html` en el navegador. Si preferís un servidor:

```sh
npx serve .
# o
python3 -m http.server 8080
```

## Tests

```sh
npm install
npm test
```

Los tests cargan `index.html` con jsdom y resuelven cada nivel con su propia `solution`, además de probar el runtime falso de Node por separado. Si agregás un nivel, el test lo cubre automáticamente.

## Deploy

Cada push a `main` corre `npm test` y, si pasa, publica la raíz del repo en GitHub Pages con la Action de `.github/workflows/pages.yml`. La URL queda en `https://<usuario>.github.io/<repo>/`.

Configuración manual, una sola vez, en el repo de GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**. Sin eso, la Action falla en el paso de deploy.

## Seguridad: cómo corre el código del jugador

El código que escribís se ejecuta con `new Function` **en la misma página**, no en un iframe. Recibe un `require`, un `module` y un `console` falsos, así que el "Node" que ve tu código es siempre el simulado del juego, no el real.

Eso es una comodidad para aprender, no una barrera de seguridad. Riesgo residual, documentado a propósito:

- `Function('return this')()` devuelve el `window` real. También son accesibles `localStorage`, `fetch`, `location` y las variables del juego (`state`, `LEVELS`).
- No hay Content Security Policy que lo impida, porque el juego necesita `new Function` para funcionar.

Por qué está bien así: el código es tuyo y corre solo en tu navegador, igual que si lo escribieras en la consola de DevTools. Nadie más lo ejecuta. Lo peor que puede pasar es que rompas la página para vos, y se arregla recargando.

Si algún día el juego mostrara o ejecutara código de otras personas (por ejemplo, soluciones compartidas por link), esto deja de alcanzar: habría que mover la ejecución a un `<iframe sandbox>` de otro origen y comunicarse por `postMessage`.

## Licencia

MIT. Ver [LICENSE](LICENSE).
