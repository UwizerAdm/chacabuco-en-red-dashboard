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

## Cosas importantes a tener en cuenta

- **"Impressions" y "RPM" en este dashboard NO van a matchear 1:1 con el panel
  nativo de 360playvid.** El panel nativo muestra "Inventory" (probablemente ad
  requests, antes de fill), mientras que la API de Dashboard solo expone
  `impression` (impresiones ya monetizadas). El **Revenue sí matchea exacto**
  entre ambos paneles — eso confirma que la diferencia es de definición de
  métrica, no un bug de timezone ni de cálculo.
- Ya se le mandó un mail a 360playvid preguntando si pueden exponer el campo
  real de "Inventory" en la API. Si lo confirman: hay que sumar ese campo en
  `fetch-data.js` (nuevo campo en el objeto que arma cada `fetchDay`) y ajustar
  `index.html` para mostrarlo en la card de Impressions/RPM en vez del cálculo
  actual basado en `impression`.
- Los días sin inventario real (antes del lanzamiento, ej. julio 2026) se
  recortan del lado del front (`index.html`, función `render()`) buscando el
  primer día con `impression > 0 || revenue > 0`. No se borran de `data.json`
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
