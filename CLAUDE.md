# La Trastienda

Juego educativo para aprender módulos de Node.js (`require`, `module.exports`, `fs.readFile`). Estilo Terrario DOM: 10 niveles en 2 capítulos, con historia (un sistema de la trastienda de Mueblería Hermanos Jota que dejó de andar) y un guía (Ramón, el encargado del depósito).

## Estructura

- `index.html`: todo el juego (HTML, CSS y JS). Tiene que seguir siendo deployable arrastrando la carpeta a cualquier hosting estático.
- `test/runtime.test.js`: tests del runtime falso de Node (`runNode`) por separado.
- `test/levels.test.js`: tests con jsdom que resuelven cada nivel con su `solution`.
- `docs/`: capturas e imagen Open Graph, cuando existan.

## Reglas que no se negocian

- Sin frameworks, sin bundler, sin build step. Vanilla JS, HTML y CSS.
- No cambiar la historia, los nombres de los personajes ni el orden de los niveles.
- Textos en español rioplatense (voseo): "escribí", "tocá", "podés". Nunca "puedes", "vosotros", "haz clic".
- El código del jugador corre con `new Function` (ver `runNode`) contra un `require`, `module` y `console` falsos. NO es un sandbox: el modelo de amenaza es self-XSS solamente. No prometer aislamiento en textos ni docs; si alguna vez el código de un jugador se muestra a otro, hay que pasar a un iframe con `sandbox`.
- Progreso siempre en `localStorage`.
- Nada de atribución de IA en commits. Conventional commits.

## Cómo correr

- Local: abrir `index.html` o `npx serve .`
- Tests: `npm test` (los 10 niveles tienen que pasar).
