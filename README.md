# Dashboards públicos — 360playvid / Uwizer

Páginas estáticas que muestran performance publicitaria de varios publishers
(vía 360playvid), sin login para quien las ve. Todos comparten el mismo login
de 360playvid (una cuenta, varios dominios) y los datos se actualizan una vez
por día con un único GitHub Action.

## Sitios

El repo tiene un dominio propio configurado (`CNAME` → `dashboard.uwizer.com`),
así que las URLs que se comparten con cada publisher son:

| Sitio | Dominio (360playvid) | URL pública del dashboard |
|---|---|---|
| Chacabuco en Red | chacabucoenred.com | https://dashboard.uwizer.com/chacabuco-en-red/ |
| Conexión Migrante | conexionmigrante.com | https://dashboard.uwizer.com/conexion-migrante/ |
| TSN Necochea | tsnnecochea.com.ar | https://dashboard.uwizer.com/tsn-necochea/ |
| La Hora | lahora.com.ec | https://dashboard.uwizer.com/la-hora/ |
| El Libertador de Corrientes | diarioellibertador.com.ar | https://dashboard.uwizer.com/el-libertador/ |

(La URL de GitHub Pages sin dominio propio también sirve como fallback:
`https://uwizeradm.github.io/chacabuco-en-red-dashboard/<slug>/`.)

Cada sitio vive en su propia carpeta (`<slug>/index.html` + `<slug>/data.json`)
pero comparte el mismo `index.html` (misma plantilla para los 5, sin nombre de
sitio hardcodeado: lee `displayName`/`domain`/`logo` desde su propio
`data.json`).

## Puesta en marcha (una sola vez)

1. Crear un repo en GitHub (puede ser privado o público, no afecta el resultado)
   y subir estos archivos manteniendo la estructura:
   - `chacabuco-en-red/index.html`, `conexion-migrante/index.html`,
     `tsn-necochea/index.html`, `la-hora/index.html`,
     `el-libertador/index.html` (y sus `data.json`)
   - `fetch-data.js`
   - `.github/workflows/update-data.yml`
   - `CNAME` (solo si se usa un dominio propio, ver paso 3)

2. Ir a **Settings → Secrets and variables → Actions → New repository secret**
   y crear dos secretos:
   - `PLAYVID_EMAIL` → el email del dashboard de 360playvid
   - `PLAYVID_PASSWORD` → la contraseña del dashboard de 360playvid

   Estos valores quedan encriptados. Nadie que abra el repo o las páginas
   públicas los puede ver, ni siquiera en los logs del Action. Son los
   mismos para los 5 sitios — no hace falta crear secretos nuevos al sumar
   un sitio más.

3. Ir a **Settings → Pages** → en "Build and deployment" elegir
   **Deploy from a branch**, branch `main`, carpeta `/ (root)`. Guardar.
   GitHub te da URLs del tipo:
   `https://<tu-usuario>.github.io/<nombre-repo>/<slug>/`

   Este repo además tiene dominio propio (`CNAME` → `dashboard.uwizer.com`),
   por lo que cada sitio también queda disponible en
   `https://dashboard.uwizer.com/<slug>/` — esas son las URLs que se
   comparten con cada publisher (ver tabla arriba). Para configurar un
   dominio propio desde cero: agregar el archivo `CNAME` en la raíz del
   repo con ese dominio adentro, y crear un registro DNS tipo `CNAME` en el
   proveedor del dominio (`dashboard` → `<tu-usuario>.github.io`, sin
   proxy/orange-cloud si es Cloudflare, al menos hasta que GitHub emita el
   certificado HTTPS).

4. Ir a la pestaña **Actions** del repo → elegir el workflow
   "Actualizar datos de los dashboards" → **Run workflow** (botón manual)
   para generar el primer `data.json` real de los 5 sitios sin esperar al cron.

## Funcionamiento diario

- Todos los días a las 07:00 UTC (~04:00 hora Argentina) el Action corre
  solo: mira hasta qué día tiene datos cada `data.json` y le pide a la API
  solo los días que le faltan hasta ayer (un solo fetch por día para los 5
  sitios, porque la API devuelve todos los dominios de la cuenta en la misma
  respuesta), y **suma** esos días al histórico existente — nunca lo pisa.
  El historial de cada sitio crece para siempre desde el día que se sumó
  (ver botón "Todo el historial" en el dashboard). Si el cron se saltea un
  día (pasa — ver "Si algo no actualiza" abajo), la corrida siguiente
  rellena el hueco sola.
- Cada página pública (`index.html`) solo lee su propio `data.json` — nunca
  ve ni necesita el email/contraseña.
- Si querés cambiar el horario, editar la línea `cron:` en
  `.github/workflows/update-data.yml` (formato UTC).

## Sumar un sitio nuevo (mismo login de 360playvid)

1. Agregar una entrada al array `SITES` en `fetch-data.js` (`slug`, `domain`
   exacto como lo devuelve la API, `displayName`, `logo`).
2. Crear la carpeta `<slug>/` con una copia de `index.html` y
   `uwizer-favicon-32.png` de cualquier otro sitio (son idénticos, no hay
   nada que editar en el HTML).
3. Agregar `<slug>/data.json` al `git add` del step "Commitear data.json
   actualizado" en `.github/workflows/update-data.yml`.
4. Correr el workflow a mano una vez para generar el primer `data.json`.

## Logo del publisher en el header

Cada sitio define su logo en `fetch-data.js` (array `SITES`, campo `logo`):

- `{ type: 'image', file: 'nombre-del-archivo.png' }` — el archivo debe estar
  subido en `<slug>/nombre-del-archivo.png`.
- `{ type: 'placeholder', initials: 'XX' }` — mientras no hay logo real, el
  header muestra un chip con esas iniciales sobre fondo violeta suave.

Para reemplazar un placeholder por el logo real: subir el archivo a la
carpeta del sitio y cambiar ese `logo` en `fetch-data.js` — es el único lugar
a tocar, el `index.html` no cambia. Si el logo no es horizontal (por ejemplo
un isotipo cuadrado o circular con texto chico abajo), agregar un campo
`height` en píxeles (ej. `{ type: 'image', file: '...png', height: 64 }`)
para que se lea bien en el chip — el default sin ese campo es 40px.

## Si algo no actualiza

- Revisar la pestaña **Actions**: ahí se ve si el job de un día falló
  (por ejemplo, si 360playvid cambia credenciales o bloquea el request) —
  afecta a los 5 sitios por igual, porque comparten el mismo fetch.
- Cada página muestra "(desactualizado)" en rojo si su `data.json` tiene más
  de 30 horas sin refrescar, para que se note de un vistazo si el cron
  dejó de correr.
- GitHub a veces demora o directamente saltea una corrida de `schedule` en
  repos de poca actividad (no es un bug nuestro). Si un número no coincide
  con el panel nativo de 360playvid, antes que nada correr
  `gh run list --workflow=update-data.yml` para ver si el `data.json` le
  falta el día más reciente, y si es así, `gh workflow run update-data.yml`
  a mano — la corrida siguiente rellena el hueco sola gracias al historial
  acumulativo.
