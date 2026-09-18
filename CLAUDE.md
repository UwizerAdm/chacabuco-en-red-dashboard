# Chacabuco en Red y otros — Dashboards públicos

Dashboards de performance publicitaria para varios publishers, todos
integrados vía **Playvid 360 / MCM de Uwizer** y con el **mismo login de
360playvid** (una cuenta, varios dominios). Páginas estáticas sin login,
pensadas para compartir con cada publisher un link fijo que se actualiza solo.

## Sitios activos (multi-sitio implementado sep 2026)

| slug | displayName | domain (exacto, según la API) |
|---|---|---|
| `chacabuco-en-red` | Chacabuco en Red | `chacabucoenred.com` |
| `conexion-migrante` | Conexión Migrante | `conexionmigrante.com` |
| `tsn-necochea` | TSN Necochea | `tsnnecochea.com.ar` |
| `la-hora` | La Hora | `lahora.com.ec` |

Estos 4 dominios están confirmados (se corrió un fetch de un día y se logueó
`data.success.map(r => r.domain)` antes de implementar, tal como indica el
proceso de abajo). Si se suma un sitio nuevo, repetir ese chequeo — nunca
adivinar el dominio a partir del nombre del sitio.

## Arquitectura

- Cada sitio vive en su propia carpeta en la raíz del repo:
  `<slug>/index.html` + `<slug>/data.json` + `<slug>/uwizer-favicon-32.png`
  (y el logo, si ya existe — ver "Logo por sitio" abajo). **No** usan un
  prefijo `sites/` — se decidió mantener el patrón que ya existía para
  Chacabuco en Red (carpeta en la raíz) y no romper su URL pública ya
  compartida con el publisher.
- `<slug>/index.html` — es el **mismo archivo para los 4 sitios**, sin nombre
  de sitio hardcodeado. Lee `displayName`, `domain`, `titleAccent`, `slug` y
  `logo` desde el `data.json` de su propia carpeta (fetch relativo, sin
  credenciales) y los usa para el header, el `<title>`, y los export
  CSV/Excel. Estilo: paleta violeta/negra de Uwizer (ver sección Estilo).
  Para editar el dashboard de cualquier sitio hay que tocar este archivo en
  las 4 carpetas (o resolverlo con un script que las sincronice) — hoy son
  copias idénticas.
- `<slug>/data.json` — generado automáticamente por `fetch-data.js`. NO
  editar a mano salvo para debug. Estructura: `{ updated_at, slug, domain,
  displayName, titleAccent, logo, range_days, daily: [{date, impression,
  revenue, ecpm}], totals }`.
- `fetch-data.js` — corre server-side (GitHub Actions), nunca en el navegador.
  Define el array `SITES` (slug/domain/displayName/titleAccent/logo por
  sitio) y por cada día del rango hace **un solo fetch** a
  `https://config.360playvid.info/services/dashboardApi` (la API no da
  desglose diario nativo, así que se pide día por día) — de esa misma
  respuesta extrae la fila que matchea el `domain` de cada sitio en `SITES`
  y escribe `<slug>/data.json`. Usa `PLAYVID_EMAIL` / `PLAYVID_PASSWORD`
  desde variables de entorno — **nunca hardcodear estas credenciales en
  ningún archivo**.
- `.github/workflows/update-data.yml` — cron diario (07:00 UTC) que corre
  `fetch-data.js` con los secrets del repo y comitea los 4 `data.json`
  actualizados.

## Logo por sitio

En `fetch-data.js`, cada entrada de `SITES` tiene un campo `logo`:
- `{ type: 'image', file: 'archivo.png' }` — el archivo vive en
  `<slug>/archivo.png` (ej. Chacabuco en Red: `chacabuco-logo.png`).
- `{ type: 'placeholder', initials: 'XX' }` — todavía no hay logo real; el
  header dibuja un chip con esas iniciales sobre fondo violeta suave (mismo
  tamaño/radio que el chip con imagen). Es el caso hoy de Conexión Migrante
  (`CM`), TSN Necochea (`TSN`) y La Hora (`LH`).

Para reemplazar un placeholder por el logo real: subir el archivo a la
carpeta del sitio y cambiar ese `logo` en `fetch-data.js` — es el único lugar
a tocar, `index.html` no cambia (lee el `logo` desde `data.json`).

`titleAccent` (opcional, por sitio): qué substring del `displayName` se
muestra con el degradé violeta en el `<h1>`. Chacabuco en Red usa
`'en Red'` (mantiene el look original: "Chacabuco" plano + "en Red"
degradé). Los sitios nuevos no tienen `titleAccent` todavía → el título se
muestra completo en color plano.

## Hosting

- Repo: `UwizerAdm/chacabuco-en-red-dashboard` (GitHub, público — necesario para
  GitHub Pages gratis).
- URLs públicas (una por sitio, ver tabla arriba):
  `https://uwizeradm.github.io/chacabuco-en-red-dashboard/<slug>/`
- Pages configurado: deploy from branch `main`, carpeta `/ (root)`.
- Secrets ya cargados: `PLAYVID_EMAIL`, `PLAYVID_PASSWORD` (mismos para los 4
  sitios, no hace falta agregar secrets nuevos al sumar un sitio más).

## Sumar otro sitio nuevo

El proceso que se siguió para los 4 sitios de arriba (y que hay que repetir
si se suma un quinto, mismo login de 360playvid):

1. Correr un fetch de un solo día y loguear `data.success.map(r => r.domain)`
   para confirmar el nombre exacto del dominio nuevo tal como lo devuelve la
   API — nunca adivinarlo a partir del nombre del sitio.
2. Agregar una entrada a `SITES` en `fetch-data.js` (slug/domain/displayName/logo).
3. Crear `<slug>/` con una copia de `index.html` y `uwizer-favicon-32.png` de
   cualquier otro sitio (son idénticos).
4. Sumar `<slug>/data.json` al `git add` en `.github/workflows/update-data.yml`.
5. Correr el workflow a mano una vez para generar el primer `data.json`.

No hace falta ningún fetch adicional ni pedirle nada nuevo a 360playvid — la
API ya devuelve todos los dominios de la cuenta en el mismo array `success`
por request, solo hay que filtrar un dominio más sobre la misma respuesta.

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
  recortan del lado del front (`<slug>/index.html`, función `render()`)
  buscando el primer día con `inventory > 0 || revenue > 0`. No se borran de
  `data.json` por si hace falta el histórico completo en el futuro. Aplica
  a los 4 sitios por igual porque comparten el mismo `index.html`.
- **Fee de Uwizer sobre el revenue (ago 2026):** cada `data.json` guarda el
  `revenue` crudo tal cual lo reporta 360playvid — **no** es el número que
  ve el publisher. `index.html` descuenta un 12,5% (constante `UWIZER_FEE`
  en el `<script>`) dentro de `getRows()`, el único punto donde se arma el
  revenue para todo lo demás (KPI card, ambos charts, tooltips, export
  CSV/Excel). Por eso el RPM mostrado también es más bajo que
  `revenue_crudo / inventory * 1000` — usa el revenue ya neto. Si el % del
  fee cambia, solo hay que tocar `UWIZER_FEE`. El label de esta métrica es
  "Total Revenue" / "Ingresos Totales" (no "Revenue"/"Ingresos" a secas).

## Estilo / marca (Uwizer)

- Fondo: negro-violeta (`#0a0714`), glow radial violeta en el header.
- Acento principal: violeta `#8b5cf6` / `#a78bfa`, degradé hacia `#5b21b6`.
- Tipografías: Space Grotesk (headers), IBM Plex Sans (cuerpo), IBM Plex Mono
  (números/datos), Poppins (solo para el wordmark "uwizer" del logo).
- Logo Uwizer embebido como SVG inline en el header (texto, no imagen).
- Mantener el motivo de "red de nodos" (líneas + puntos violeta) como elemento
  decorativo — es un guiño a "Chacabuco **en Red**".

## Convenciones de trabajo

- `index.html` es el mismo archivo en las 4 carpetas de sitio — un cambio de
  estilo/funcionalidad hay que aplicarlo en las 4 (`chacabuco-en-red/`,
  `conexion-migrante/`, `tsn-necochea/`, `la-hora/`), no solo en una.
- Después de cualquier cambio en `index.html` (en las 4 carpetas) o en
  `fetch-data.js`, hacer `git add`, `git commit` con mensaje descriptivo en
  español, y `git push`.
- No es necesario correr el workflow manualmente después de cambios de estilo
  (`index.html` no depende del cron) — solo hace falta re-correrlo
  (`gh workflow run update-data.yml`) si se cambia `fetch-data.js`.
- El usuario (Juani) trabaja en Rioplatense — mantener ese registro en
  cualquier texto visible en la página o en mensajes/emails relacionados.
