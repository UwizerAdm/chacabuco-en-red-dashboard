// Se ejecuta del lado del servidor (GitHub Actions), nunca en el navegador.
// Las credenciales viven en variables de entorno (GitHub Secrets), no en este archivo.

const API_URL = 'https://config.360playvid.info/services/dashboardApi';
const TARGET_DOMAIN = 'chacabucoenred.com';
const RANGE_DAYS = 30;

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
  const match = (data.success || []).find((r) =>
    (r.domain || '').toLowerCase().includes(TARGET_DOMAIN)
  );
  return {
    date: dateStr,
    inventory: match ? (match.inventory ?? match.impression) : 0,
    impression: match ? match.impression : 0,
    revenue: match ? match.revenue : 0,
    ecpm: match ? match.ecpm : 0,
  };
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Faltan las variables de entorno PLAYVID_EMAIL / PLAYVID_PASSWORD.');
    process.exit(1);
  }

  const dates = getDateList(RANGE_DAYS);
  const daily = [];

  for (const d of dates) {
    try {
      daily.push(await fetchDay(d));
    } catch (err) {
      console.error('Error consultando', d, '-', err.message);
      daily.push({ date: d, inventory: 0, impression: 0, revenue: 0, ecpm: 0 });
    }
  }

  const totalInv = daily.reduce((s, r) => s + r.inventory, 0);
  const totalImpr = daily.reduce((s, r) => s + r.impression, 0);
  const totalRev = daily.reduce((s, r) => s + r.revenue, 0);
  const rpm = totalInv > 0 ? (totalRev / totalInv) * 1000 : 0;
  const fillrate = totalInv > 0 ? (totalImpr / totalInv) * 100 : 0;

  const output = {
    updated_at: new Date().toISOString(),
    domain: TARGET_DOMAIN,
    range_days: RANGE_DAYS,
    daily,
    totals: { inventory: totalInv, impression: totalImpr, revenue: totalRev, rpm, fillrate },
  };

  require('fs').writeFileSync('chacabuco-en-red/data.json', JSON.stringify(output, null, 2));
  console.log('chacabuco-en-red/data.json actualizado:', output.updated_at);
}

main();
