# Dashboards públicos — 360playvid / Uwizer

Páginas estáticas que muestran performance publicitaria de varios publishers
(vía 360playvid), sin login para quien las ve. Todos comparten el mismo login
de 360playvid (una cuenta, varios dominios) y los datos se actualizan una vez
por día con un único GitHub Action.

## Sitios

| Sitio | Dominio | URL pública |
|---|---|---|
| Chacabuco en Red | chacabucoenred.com | https://uwizeradm.github.io/chacabuco-en-red-dashboard/chacabuco-en-red/ |
| Conexión Migrante | conexionmigrante.com | https://uwizeradm.github.io/chacabuco-en-red-dashboard/conexion-migrante/ |
| TSN Necochea | tsnnecochea.com.ar | https://uwizeradm.github.io/chacabuco-en-red-dashboard/tsn-necochea/ |
| La Hora | lahora.com.ec | https://uwizeradm.github.io/chacabuco-en-red-dashboard/la-hora/ |

Cada sitio vive en su propia carpeta (`<slug>/index.html` + `<slug>/data.json`)
pero comparte el mismo `index.html` (misma plantilla para los 4, sin nombre de
sitio hardcodeado: lee `displayName`/`domain`/`logo` desde su propio
`data.json`).

## Puesta en marcha (una sola vez)

1. Crear un repo en GitHub (puede ser privado o público, no afecta el resultado)
   y subir estos archivos manteniendo la estructura:
   - `chacabuco-en-red/index.html`, `conexion-migrante/index.html`,
     `tsn-necochea/index.html`, `la-hora/index.html` (y sus `data.json`)
   - `fetch-data.js`
   - `.github/workflows/update-data.yml`
   - `CNAME` (solo si se usa un dominio propio, ver paso 3)

2. Ir a **Settings → Secrets and variables → Actions → New repository secret**
   y crear dos secretos:
   - `PLAYVID_EMAIL` → el email del dashboard de 360playvid
   - `PLAYVID_PASSWORD` → la contraseña del dashboard de 360playvid

   Estos valores quedan encriptados. Nadie que abra el repo o las páginas
   públicas los puede ver, ni siquiera en los logs del Action. Son los
   mismos para los 4 sitios — no hace falta crear secretos nuevos al sumar
   un sitio más.

3. Ir a **Settings → Pages** → en "Build and deployment" elegir
   **Deploy from a branch**, branch `main`, carpeta `/ (root)`. Guardar.
   GitHub te da URLs del tipo:
   `https://<tu-usuario>.github.io/<nombre-repo>/<slug>/`

   Si en cambio se usa un dominio propio (ej. `dashboard.uwizer.com`):
   agregar un archivo `CNAME` en la raíz del repo con ese dominio adentro,
   y crear un registro DNS tipo `CNAME` en el proveedor del dominio
   (`dashboard` → `<tu-usuario>.github.io`, sin proxy/orange-cloud si es
   Cloudflare, al menos hasta que GitHub emita el certificado HTTPS).
   La URL final de cada sitio queda `https://dashboard.uwizer.com/<slug>/`
   — esas son las que se comparten con cada publisher.

4. Ir a la pestaña **Actions** del repo → elegir el workflow
   "Actualizar datos de los dashboards" → **Run workflow** (botón manual)
   para generar el primer `data.json` real de los 4 sitios sin esperar al cron.

## Funcionamiento diario

- Todos los días a las 07:00 UTC (~04:00 hora Argentina) el Action corre
  solo: llama a la API de 360playvid día por día de los últimos 30 días
  (un solo fetch por día para los 4 sitios, porque la API devuelve todos
  los dominios de la cuenta en la misma respuesta) y comitea los 4
  `data.json` actualizados.
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
a tocar, el `index.html` no cambia.

## Si algo no actualiza

- Revisar la pestaña **Actions**: ahí se ve si el job de un día falló
  (por ejemplo, si 360playvid cambia credenciales o bloquea el request) —
  afecta a los 4 sitios por igual, porque comparten el mismo fetch.
- Cada página muestra "(desactualizado)" en rojo si su `data.json` tiene más
  de 30 horas sin refrescar, para que se note de un vistazo si el cron
  dejó de correr.
