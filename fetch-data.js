// Se ejecuta del lado del servidor (GitHub Actions), nunca en el navegador.
// Las credenciales viven en variables de entorno (GitHub Secrets), no en este archivo.

const API_URL = 'https://config.360playvid.info/services/dashboardApi';
const RANGE_DAYS = 30;

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
  },
  {
    slug: 'la-hora',
    domain: 'lahora.com.ec',
    displayName: 'La Hora',
    // Logo circular cuadrado, mismo caso que Conexión Migrante/TSN Necochea.
    logo: { type: 'image', file: 'la-hora-logo.png', height: 64 },
  },
];

const EMAIL = process.env.PLAYVID_EMAIL;
const PASSWORD = process.env.PLAYVID_PASSWORD;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function getDateList(days) {
  const list = [];
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1); // el dato más reciente disponible es "ayer"
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    list.push(isoDate(d));
  }
  return list;
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

  const dates = getDateList(RANGE_DAYS);
  const dailyBySite = {};
  for (const site of SITES) dailyBySite[site.slug] = [];

  for (const d of dates) {
    try {
      const bySite = await fetchDay(d);
      for (const site of SITES) dailyBySite[site.slug].push(bySite[site.slug]);
    } catch (err) {
      console.error('Error consultando', d, '-', err.message);
      for (const site of SITES) {
        dailyBySite[site.slug].push({ date: d, inventory: 0, impression: 0, revenue: 0, ecpm: 0 });
      }
    }
  }

  for (const site of SITES) {
    const daily = dailyBySite[site.slug];
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
      range_days: RANGE_DAYS,
      daily,
      totals: { inventory: totalInv, impression: totalImpr, revenue: totalRev, rpm, fillrate },
    };

    require('fs').writeFileSync(`${site.slug}/data.json`, JSON.stringify(output, null, 2));
    console.log(`${site.slug}/data.json actualizado:`, output.updated_at);
  }
}

main();
