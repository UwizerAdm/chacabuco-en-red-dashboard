# Chacabuco en Red — Dashboard público

Dashboard de performance publicitaria para el publisher **chacabucoenred.com**,
integrado vía **Playvid 360 / MCM de Uwizer**. Página estática sin login, pensada
para compartir con el publisher (Chacabuco en Red) un link fijo que se actualiza solo.

## Arquitectura

- `index.html` — página pública. Lee `data.json` (fetch relativo, sin credenciales).
  Estilo: paleta violeta/negra de Uwizer (ver sección Estilo).
- `data.json` — generado automáticamente. NO editar a mano salvo para debug.
  Estructura: `{ updated_at, domain, range_days, daily: [{date, impression, revenue, ecpm}], totals }`.
- `fetch-data.js` — corre server-side (GitHub Actions), nunca en el navegador.
  Llama a `https://config.360playvid.info/services/dashboardApi` una vez por día
  (la API no da desglose diario nativo, así que se pide día por día).
  Usa `PLAYVID_EMAIL` / `PLAYVID_PASSWORD` desde variables de entorno — **nunca
  hardcodear estas credenciales en ningún archivo**.
- `.github/workflows/update-data.yml` — cron diario (07:00 UTC) que corre
  `fetch-data.js` con los secrets del repo y comitea el `data.json` actualizado.

## Hosting

- Repo: `UwizerAdm/chacabuco-en-red-dashboard` (GitHub, público — necesario para
  GitHub Pages gratis).
- URL pública: https://uwizeradm.github.io/chacabuco-en-red-dashboard/
- Pages configurado: deploy from branch `main`, carpeta `/ (root)`.
- Secrets ya cargados: `PLAYVID_EMAIL`, `PLAYVID_PASSWORD`.

## Pendiente: soporte multi-sitio (mismo login 360playvid)

Juani va a sumar ~5 sitios más al mismo esquema de dashboard público. Los 5
usan el **mismo login de 360playvid** que Chacabuco en Red (una sola cuenta,
varios dominios) — esto es clave: la API ya devuelve **todos los dominios de
la cuenta en el mismo array `success`** por cada request, así que no hace
falta ningún fetch adicional ni pedirle nada nuevo a 360playvid. Solo hay que
filtrar más de un dominio sobre la misma respuesta que ya se pide hoy.

**Refactor a implementar (cuando Juani lo pida explícitamente — no adelantarse):**

1. `fetch-data.js`: reemplazar el `TARGET_DOMAIN` fijo por un array `SITES`:
```js
   const SITES = [
     { slug: 'chacabuco-en-red', domain: 'chacabucoenred.com', displayName: 'Chacabuco en Red' },
     // ... resto de los sitios, con el domain EXACTO como lo devuelve la API
   ];
```
   Por cada día del rango, hacer **un solo `fetch` a la API** (como ahora) y de
   esa misma respuesta extraer la fila que matchea cada `site.domain` de la
   lista — no un fetch por sitio.

2. Escribir un `data.json` por sitio en `sites/<slug>/data.json`, con la misma
   estructura que ya existe (`updated_at, domain, range_days, daily, totals`)
   más un campo `displayName` para que el HTML no tenga el nombre hardcodeado.

3. `index.html` pasa a vivir en `sites/<slug>/index.html` (copia idéntica del
   actual, pero leyendo `displayName`/`domain` desde `data.json` en vez de
   tenerlo en el markup — hoy dice "Chacabuco en Red" y "chacabucoenred.com"
   hardcodeado en el `<h1>` y el `<p>` del header, hay que sacar eso).

4. URLs resultantes, todas bajo el mismo repo/Pages, sin necesidad de crear
   repos nuevos:
   `https://uwizeradm.github.io/chacabuco-en-red-dashboard/sites/<slug>/`

5. Mismo cron, mismos secrets (`PLAYVID_EMAIL`/`PLAYVID_PASSWORD`) — no hace
   falta agregar secrets nuevos porque es el mismo login para todos los sitios.

**Antes de programar esto:** correr un fetch de un solo día y loguear
`data.success.map(r => r.domain)` para confirmar el nombre exacto de cada
dominio nuevo tal como lo devuelve la API (evitar adivinar el string).

## Cosas importantes a tener en cuenta

- **RESUELTO (ago 2026):** el mismatch de Inventory/RPM entre este dashboard y
  el panel nativo de 360playvid se debía a que la API sí devuelve el campo
  `inventory` (llamadas al player) por default junto con `impression`,
  `ecpm` y `revenue` — el doc original no lo mencionaba y el script no lo
  capturaba. Ya está arreglado: `fetch-data.js` guarda `inventory` en cada
  día, y el RPM se calcula como `revenue / inventory * 1000` (mismo criterio
  que 360playvid). Fill rate puede superar el 100% en sesiones largas (el
  player puede servir más de un ad por cada llamada) — dato de Liat (contacto
  de 360playvid), no es un error.
- Los días sin inventario real (antes del lanzamiento, ej. julio 2026) se
  recortan del lado del front (`index.html`, función `render()`) buscando el
  primer día con `inventory > 0 || revenue > 0`. No se borran de `data.json`
  por si hace falta el histórico completo en el futuro.

## Estilo / marca (Uwizer)

- Fondo: negro-violeta (`#0a0714`), glow radial violeta en el header.
- Acento principal: violeta `#8b5cf6` / `#a78bfa`, degradé hacia `#5b21b6`.
- Tipografías: Space Grotesk (headers), IBM Plex Sans (cuerpo), IBM Plex Mono
  (números/datos), Poppins (solo para el wordmark "uwizer" del logo).
- Logo Uwizer embebido como SVG inline en el header (texto, no imagen).
- Mantener el motivo de "red de nodos" (líneas + puntos violeta) como elemento
  decorativo — es un guiño a "Chacabuco **en Red**".

## Convenciones de trabajo

- Después de cualquier cambio en `index.html` o `fetch-data.js`, hacer
  `git add`, `git commit` con mensaje descriptivo en español, y `git push`.
- No es necesario correr el workflow manualmente después de cambios de estilo
  (`index.html` no depende del cron) — solo hace falta re-correrlo
  (`gh workflow run update-data.yml`) si se cambia `fetch-data.js`.
- El usuario (Juani) trabaja en Rioplatense — mantener ese registro en
  cualquier texto visible en la página o en mensajes/emails relacionados.
