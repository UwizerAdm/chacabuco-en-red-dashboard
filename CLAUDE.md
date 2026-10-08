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
| `el-libertador` | El Libertador de Corrientes | `diarioellibertador.com.ar` |

Estos 5 dominios están confirmados (se corrió un fetch de un día y se logueó
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
- `<slug>/index.html` — es el **mismo archivo para los 5 sitios**, sin nombre
  de sitio hardcodeado. Lee `displayName`, `domain`, `titleAccent`, `slug` y
  `logo` desde el `data.json` de su propia carpeta (fetch relativo, sin
  credenciales) y los usa para el header, el `<title>`, y los export
  CSV/Excel. Estilo: paleta violeta/negra de Uwizer (ver sección Estilo).
  Para editar el dashboard de cualquier sitio hay que tocar este archivo en
  las 5 carpetas (o resolverlo con un script que las sincronice) — hoy son
  copias idénticas.
- `<slug>/data.json` — generado automáticamente por `fetch-data.js`. NO
  editar a mano salvo para debug (o para una migración puntual, como se hizo
  para agregar campos nuevos sin perder el histórico real). Estructura:
  `{ updated_at, slug, domain, displayName, titleAccent, logo, range_days,
  daily: [{date, impression, revenue, ecpm}], totals }`. **`daily` es
  acumulativo (implementado oct 2026):** arranca el día que se sumó el sitio
  y crece para siempre, un día más por corrida — no es una ventana de 30
  días. `range_days` es simplemente `daily.length` (el total acumulado a la
  fecha), no una constante fija.
- `fetch-data.js` — corre server-side (GitHub Actions), nunca en el navegador.
  Define el array `SITES` (slug/domain/displayName/titleAccent/logo por
  sitio). Por cada corrida: lee el `data.json` existente de cada sitio,
  calcula desde qué día le faltan datos (el siguiente al último que ya
  tiene guardado; si el sitio es nuevo y no tiene `data.json` todavía, arranca
  con una ventana de bootstrap de `BOOTSTRAP_DAYS` = 30 días) y pide a la API
  **un solo fetch por día** (nunca uno por sitio) solo para los días que
  faltan — de esa misma respuesta extrae la fila que matchea el `domain` de
  cada sitio en `SITES` y agrega (nunca pisa) ese día al `daily` existente.
  Si el cron se salteó uno o más días (pasa, ver más abajo), el próximo run
  rellena el hueco completo solo, sin intervención manual. Usa
  `PLAYVID_EMAIL` / `PLAYVID_PASSWORD` desde variables de entorno — **nunca
  hardcodear estas credenciales en ningún archivo**.
- El dashboard (`<slug>/index.html`) tiene un botón **"Todo el historial" /
  "All Time"** (`currentMode.type === 'all'`) además de
  Ayer/7 días/30 días/Mes en curso/rango personalizado — muestra todos los
  días que haya en `daily` desde que el sitio arrancó.
- `.github/workflows/update-data.yml` — cron diario (07:00 UTC) que corre
  `fetch-data.js` con los secrets del repo y comitea los 5 `data.json`
  actualizados.

## Logo por sitio

En `fetch-data.js`, cada entrada de `SITES` tiene un campo `logo`. Los 5
sitios ya tienen logo real (ninguno quedó con placeholder):
- `{ type: 'image', file: 'archivo.png' }` — el archivo vive en
  `<slug>/archivo.png` (ej. Chacabuco en Red: `chacabuco-logo.png`).
- `{ type: 'image', file: '...', height: 64 }` — el campo `height` (px) es
  opcional, default 40px si no está. Se usa cuando el logo no es horizontal
  como el de Chacabuco sino cuadrado/circular con texto chico abajo (isotipo
  + wordmark en 2 líneas) — a 40px ese texto queda ilegible. Caso de
  Conexión Migrante, TSN Necochea, La Hora y El Libertador de Corrientes,
  los cuatro con `height: 64`.
- `{ type: 'placeholder', initials: 'XX' }` — todavía no hay logo real; el
  header dibuja un chip con esas iniciales sobre fondo violeta suave (mismo
  tamaño/radio que el chip con imagen). Usar si se suma un sitio nuevo sin
  logo listo todavía.

Para reemplazar un placeholder por el logo real: subir el archivo a la
carpeta del sitio y cambiar ese `logo` en `fetch-data.js` — es el único lugar
a tocar, `index.html` no cambia (lee el `logo` desde `data.json`).

Ojo: en la raíz del repo hay dos PNG sueltos, `conexion-migrante-logo.png`
y `tsn-necochea-logo.png` (sin trackear en git). Son copias idénticas de
`conexion-migrante/conexion-migrante-logo.png` y
`tsn-necochea/tsn-necochea-logo.png`. Ni `fetch-data.js` ni `index.html`
los usan (el logo siempre se busca dentro de `<slug>/`), así que se pueden
ignorar.

`titleAccent` (opcional, por sitio): qué substring del `displayName` se
muestra con el degradé violeta en el `<h1>`. Chacabuco en Red usa
`'en Red'` (mantiene el look original: "Chacabuco" plano + "en Red"
degradé). Los sitios nuevos no tienen `titleAccent` todavía → el título se
muestra completo en color plano.

## Hosting

- Repo: `UwizerAdm/chacabuco-en-red-dashboard` (GitHub, público — necesario para
  GitHub Pages gratis).
- Dominio propio configurado (`CNAME` → `dashboard.uwizer.com`). URLs
  públicas que se comparten con cada publisher (una por sitio, ver tabla
  arriba): `https://dashboard.uwizer.com/<slug>/`
  (fallback sin dominio propio: `https://uwizeradm.github.io/chacabuco-en-red-dashboard/<slug>/`).
- Pages configurado: deploy from branch `main`, carpeta `/ (root)`.
- Secrets ya cargados: `PLAYVID_EMAIL`, `PLAYVID_PASSWORD` (mismos para los 5
  sitios, no hace falta agregar secrets nuevos al sumar un sitio más).

## Sumar otro sitio nuevo

El proceso que se siguió para los 5 sitios de arriba (y que hay que repetir
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

- **Cron de GitHub Actions puede demorarse o saltearse (visto sep 2026):** el
  `schedule: cron: '0 7 * * *'` no siempre dispara puntual — GitHub demora o
  directamente saltea corridas programadas en repos de poca actividad (es un
  comportamiento conocido de Actions, no un bug nuestro). Si un número de
  algún sitio no coincide con el panel nativo de 360playvid, **antes que
  nada** revisar `gh run list --workflow=update-data.yml` para ver si al
  `data.json` le falta el día más reciente, y si es así correr
  `gh workflow run update-data.yml` a mano. Caso real: el 2026-09-28 el cron
  de las 07:00 UTC no había corrido, el dashboard de Chacabuco en Red tenía
  Inventario MTD = 513.923 vs 526.046 del panel nativo (faltaba el
  27/09 = 12.123) — al correr el workflow a mano los números coincidieron
  exacto.
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
  a los 5 sitios por igual porque comparten el mismo `index.html`.
- **Fee de Uwizer sobre el revenue (ago 2026, cambiado oct 2026):** cada
  `data.json` guarda el `revenue` crudo tal cual lo reporta 360playvid.
  Desde oct 2026 el dashboard muestra los dos números en tarjetas separadas:
  "Total Revenue" / "Ingresos Totales" = revenue crudo de 360playvid, y
  "Net Revenue" / "Ingresos Netos" = crudo menos el 12,5% (constante
  `UWIZER_FEE` en el `<script>`). `getRows()` arma ambos campos por fila:
  `grossRevenue` (crudo) y `revenue` (neto). El RPM usa el revenue crudo
  (`grossRevenue / inventory * 1000`), así que coincide con el del panel de
  360playvid (salvo en sitios con `grossEcpm`, ver abajo). `fetch-data.js` solo guarda `inventory`, `impression`,
  `revenue` y `ecpm` (no se verificó si la API manda además un campo de
  RPM); igual, para cualquier rango de varios días el RPM hay que
  calcularlo sobre los totales, como hace el panel. Los
  charts (Datos diarios → Ingresos Netos, y el de barras) muestran el neto.
  El export CSV/Excel trae las dos columnas, Ingresos Totales e Ingresos
  Netos, y el RPM. Si el % del fee cambia, solo hay que tocar `UWIZER_FEE`.

- **eCPM bruto (oct 2026, solo TSN Necochea):** el eCPM/revenue que reporta
  360playvid ya viene neto de su comisión (20%). Para los sitios con
  `grossEcpm: { platformShare: 0.20 }` en `SITES` (`fetch-data.js` → llega a
  `data.json`), `index.html` muestra una 6ª tarjeta "eCPM Bruto" =
  `(revenue_crudo / impresiones * 1000) / (1 - platformShare)` (dividir por
  0,8 = +25%, no +20%). En esos sitios "Ingresos Totales" (y por lo tanto el
  RPM Inventario y las columnas del export) también se muestran en bruto: `grossRevenue` en
  `getRows()` = revenue crudo / (1 - platformShare) = impresiones × eCPM
  bruto / 1000. "Ingresos Netos" NO cambia: sigue siendo revenue crudo de
  360playvid × (1 - UWIZER_FEE), que es lo que efectivamente se le paga.
  Sin ese campo la tarjeta queda oculta y todo se calcula como en el resto.
  Para sumarlo a otro sitio: agregar el campo en `SITES` y correr el workflow.

- **RPM Inventario (oct 2026):** la tarjeta se llama "RPM Inventory" / "RPM
  Inventario" porque no es un RPM por página vista (360playvid no tiene ese
  dato): es Ingresos Totales / inventario (llamadas al player) × 1000. En
  sitios con `grossEcpm` usa los Ingresos Totales en bruto, así que no
  coincide con el RPM del panel de 360playvid — decisión de Juani.

## Estilo / marca (Uwizer)

- Fondo: negro-violeta (`#0a0714`), glow radial violeta en el header.
- Acento principal: violeta `#8b5cf6` / `#a78bfa`, degradé hacia `#5b21b6`.
- Tipografías: Space Grotesk (headers), IBM Plex Sans (cuerpo), IBM Plex Mono
  (números/datos), Poppins (solo para el wordmark "uwizer" del logo).
- Logo Uwizer embebido como SVG inline en el header (texto, no imagen).
- Mantener el motivo de "red de nodos" (líneas + puntos violeta) como elemento
  decorativo — es un guiño a "Chacabuco **en Red**".

## Convenciones de trabajo

- `index.html` es el mismo archivo en las 5 carpetas de sitio — un cambio de
  estilo/funcionalidad hay que aplicarlo en las 5 (`chacabuco-en-red/`,
  `conexion-migrante/`, `tsn-necochea/`, `la-hora/`, `el-libertador/`), no
  solo en una.
- Después de cualquier cambio en `index.html` (en las 5 carpetas) o en
  `fetch-data.js`, hacer `git add`, `git commit` con mensaje descriptivo en
  español, y `git push`.
- No es necesario correr el workflow manualmente después de cambios de estilo
  (`index.html` no depende del cron) — solo hace falta re-correrlo
  (`gh workflow run update-data.yml`) si se cambia `fetch-data.js`.
- El usuario (Juani) trabaja en Rioplatense — mantener ese registro en
  cualquier texto visible en la página o en mensajes/emails relacionados.
