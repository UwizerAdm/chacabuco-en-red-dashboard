// Se ejecuta del lado del servidor (GitHub Actions), nunca en el navegador.
// Las credenciales viven en variables de entorno (GitHub Secrets), no en este archivo.

const API_URL = 'https://config.360playvid.info/services/dashboardApi';
// Ventana inicial SOLO para un sitio que todavía no tiene data.json (primera
// corrida). Una vez que existe data.json, cada corrida acumula sobre lo que
// ya hay (no pisa el historial) — solo pide a la API los días nuevos desde
// el último que ya tiene guardado hasta "ayer".
const BOOTSTRAP_DAYS = 30;

// Todos los sitios comparten el mismo login de 360playvid (una cuenta, varios
// dominios) — la API devuelve todos los dominios de la cuenta en el mismo
// array `success` por request, así que se hace un solo fetch por día y de
// esa misma respuesta se extrae la fila de cada sitio.
//
// logo: 'image' -> hay un archivo de logo real en la carpeta del sitio.
//       'placeholder' -> todavía no hay logo, el front dibuja un chip con
//       las iniciales. Para reemplazar un placeholder por el logo real:
//       cambiar acá el `logo` de ese sitio a { type: 'image', file: '...png' }
//       y subir el archivo a <slug>/<file>. Ese es el único lugar a tocar.
const SITES = [
  {
    slug: 'chacabuco-en-red',
    domain: 'chacabucoenred.com',
    displayName: 'Chacabuco en Red',
    titleAccent: 'en Red', // qué parte del displayName va con el degradé violeta en el <h1>
    logo: { type: 'image', file: 'chacabuco-logo.png' },
  },
  {
    slug: 'conexion-migrante',
    domain: 'conexionmigrante.com',
    displayName: 'Conexión Migrante',
    // Logo cuadrado (ícono + texto en 2 líneas) en vez de horizontal como el
    // de Chacabuco — a 40px de alto el texto queda ilegible, así que este
    // sitio necesita más alto en el chip. `height` es opcional en `logo`;
    // si no está, el front usa el default (40px).
    logo: { type: 'image', file: 'conexion-migrante-logo.png', height: 64 },
  },
  {
    slug: 'tsn-necochea',
    domain: 'tsnnecochea.com.ar',
    displayName: 'TSN Necochea',
    // Logo cuadrado (isotipo "tsn" + "necochea" abajo), mismo caso que
    // Conexión Migrante: necesita más alto que el default para leerse.
    logo: { type: 'image', file: 'tsn-necochea-logo.png', height: 64 },
    // Muestra una tarjeta extra con el eCPM bruto, antes de la comisión de
    // 360playvid: eCPM reportado / (1 - platformShare). Opcional, solo este sitio.
    grossEcpm: { platformShare: 0.20 },
  },
  {
    slug: 'la-hora',
    domain: 'lahora.com.ec',
    displayName: 'La Hora',
    // Logo circular cuadrado, mismo caso que Conexión Migrante/TSN Necochea.
    logo: { type: 'image', file: 'la-hora-logo.png', height: 64 },
  },
  {
    slug: 'el-libertador',
    domain: 'diarioellibertador.com.ar',
    displayName: 'El Libertador de Corrientes',
    // Logo cuadrado (isotipo + wordmark + tagline), mismo caso que los
    // otros 3 sitios con logo no horizontal.
    logo: { type: 'image', file: 'el-libertador-logo.png', height: 64 },
  },
];

const EMAIL = process.env.PLAYVID_EMAIL;
const PASSWORD = process.env.PLAYVID_PASSWORD;

const fs = require('fs');

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

function dateRangeList(startStr, endStr) {
  const list = [];
  for (let d = new Date(startStr + 'T00:00:00Z'); isoDate(d) <= endStr; d.setUTCDate(d.getUTCDate() + 1)) {
    list.push(isoDate(d));
  }
  return list;
}

function loadExistingDaily(slug) {
  try {
    const parsed = JSON.parse(fs.readFileSync(`${slug}/data.json`, 'utf8'));
    return Array.isArray(parsed.daily) ? parsed.daily : [];
  } catch {
    return []; // todavía no existe data.json para este sitio (primera corrida)
  }
}

async function fetchDay(dateStr) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: dateStr, email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' para ' + dateStr);
  const data = await res.json();
  const rows = data.success || [];

  const bySite = {};
  for (const site of SITES) {
    const match = rows.find((r) => (r.domain || '').toLowerCase().includes(site.domain));
    bySite[site.slug] = {
      date: dateStr,
      inventory: match ? (match.inventory ?? match.impression) : 0,
      impression: match ? match.impression : 0,
      revenue: match ? match.revenue : 0,
      ecpm: match ? match.ecpm : 0,
    };
  }
  return bySite;
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Faltan las variables de entorno PLAYVID_EMAIL / PLAYVID_PASSWORD.');
    process.exit(1);
  }

  const yesterday = addDays(isoDate(new Date()), -1); // el dato más reciente disponible es "ayer"

  const existingBySite = {};
  const startBySite = {};
  for (const site of SITES) {
    const existing = loadExistingDaily(site.slug);
    existingBySite[site.slug] = existing;
    const lastDate = existing.length ? existing[existing.length - 1].date : null;
    // Si ya hay historial, seguir desde el día siguiente al último guardado.
    // Si no hay nada (sitio nuevo), arrancar con la ventana de bootstrap.
    startBySite[site.slug] = lastDate ? addDays(lastDate, 1) : addDays(yesterday, -(BOOTSTRAP_DAYS - 1));
  }

  const overallStart = Object.values(startBySite).reduce((min, d) => (d < min ? d : min));
  const dates = overallStart <= yesterday ? dateRangeList(overallStart, yesterday) : [];

  const newDailyBySite = {};
  for (const site of SITES) newDailyBySite[site.slug] = [];

  for (const d of dates) {
    try {
      const bySite = await fetchDay(d);
      for (const site of SITES) {
        if (d >= startBySite[site.slug]) newDailyBySite[site.slug].push(bySite[site.slug]);
      }
    } catch (err) {
      console.error('Error consultando', d, '-', err.message);
      for (const site of SITES) {
        if (d >= startBySite[site.slug]) {
          newDailyBySite[site.slug].push({ date: d, inventory: 0, impression: 0, revenue: 0, ecpm: 0 });
        }
      }
    }
  }

  for (const site of SITES) {
    // Concat simple: startBySite garantiza que newDaily no se solapa con existing.
    const daily = existingBySite[site.slug].concat(newDailyBySite[site.slug]);
    const totalInv = daily.reduce((s, r) => s + r.inventory, 0);
    const totalImpr = daily.reduce((s, r) => s + r.impression, 0);
    const totalRev = daily.reduce((s, r) => s + r.revenue, 0);
    const rpm = totalInv > 0 ? (totalRev / totalInv) * 1000 : 0;
    const fillrate = totalInv > 0 ? (totalImpr / totalInv) * 100 : 0;

    const output = {
      updated_at: new Date().toISOString(),
      slug: site.slug,
      domain: site.domain,
      displayName: site.displayName,
      titleAccent: site.titleAccent || null,
      logo: site.logo,
      grossEcpm: site.grossEcpm || null,
      range_days: daily.length, // historial acumulado total, no una ventana fija
      daily,
      totals: { inventory: totalInv, impression: totalImpr, revenue: totalRev, rpm, fillrate },
    };

    fs.writeFileSync(`${site.slug}/data.json`, JSON.stringify(output, null, 2));
    console.log(`${site.slug}/data.json actualizado (${daily.length} días acumulados):`, output.updated_at);
  }
}

main();
