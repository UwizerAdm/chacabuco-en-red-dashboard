# Chacabuco en Red — Dashboard público

Página estática que muestra performance de chacabucoenred.com (vía 360playvid),
sin login para quien la ve. Los datos se actualizan una vez por día con un
GitHub Action que corre con credenciales guardadas como secreto.

## Puesta en marcha (una sola vez)

1. Crear un repo en GitHub (puede ser privado o público, no afecta el resultado)
   y subir estos 4 archivos manteniendo la estructura:
   - `index.html`
   - `data.json`
   - `fetch-data.js`
   - `.github/workflows/update-data.yml`

2. Ir a **Settings → Secrets and variables → Actions → New repository secret**
   y crear dos secretos:
   - `PLAYVID_EMAIL` → el email del dashboard de 360playvid
   - `PLAYVID_PASSWORD` → la contraseña del dashboard de 360playvid

   Estos valores quedan encriptados. Nadie que abra el repo o la página
   pública los puede ver, ni siquiera en los logs del Action.

3. Ir a **Settings → Pages** → en "Build and deployment" elegir
   **Deploy from a branch**, branch `main`, carpeta `/ (root)`. Guardar.
   GitHub te da una URL del tipo:
   `https://<tu-usuario>.github.io/<nombre-repo>/`
   Esa es la URL que le mandás a Chacabuco.

4. Ir a la pestaña **Actions** del repo → elegir el workflow
   "Actualizar datos Chacabuco en Red" → **Run workflow** (botón manual)
   para generar el primer `data.json` real sin esperar al cron.

## Funcionamiento diario

- Todos los días a las 07:00 UTC (~04:00 hora Argentina) el Action corre
  solo, llama a la API de 360playvid día por día de los últimos 30 días,
  y comitea el `data.json` actualizado.
- La página pública (`index.html`) solo lee `data.json` — nunca ve ni
  necesita el email/contraseña.
- Si querés cambiar el horario, editar la línea `cron:` en
  `.github/workflows/update-data.yml` (formato UTC).

## Si algo no actualiza

- Revisar la pestaña **Actions**: ahí se ve si el job de un día falló
  (por ejemplo, si 360playvid cambia credenciales o bloquea el request).
- La página muestra "(desactualizado)" en rojo si `data.json` tiene más
  de 30 horas sin refrescar, para que se note de un vistazo si el cron
  dejó de correr.
