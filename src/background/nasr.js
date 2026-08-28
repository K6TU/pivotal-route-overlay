// FAA NASR 28-day subscription: discover the current cycle, download the APT/NAV/FIX CSV zips,
// and persist decoded lookup indexes to chrome.storage.local.
//
// The download/unzip/CSV pipeline is carried over from the original background.js; only the
// lat/lon window kept during import has changed (see inBounds below).

import { DATA_BOUNDS } from '../common/regions.js';

const ROOT = 'https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/';

/**
 * Lat/lon window we keep records for. Covers every region Pivotal renders, including the Gulf
 * and Canada maps, so a route is never rejected for want of an index entry the map could show.
 */
function inBounds(lat, lon) {
  return lat <= DATA_BOUNDS.latMax && lat >= DATA_BOUNDS.latMin &&
         lon >= DATA_BOUNDS.lonMin && lon <= DATA_BOUNDS.lonMax;
}

async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

async function fetchBuf(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

/** Find the current 28-day cycle from the FAA subscription index page. */
export async function discoverCycle(post = () => {}) {
  post({ phase: 'start', url: ROOT });
  const html = await fetchText(ROOT);

  // Prefer the first link under the <h2>Current</h2> heading.
  let cycleKey = null;
  const section = html.match(/<h2[^>]*>\s*Current\s*<\/h2>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (section) {
    const link = section[1].match(/NASR_Subscription\/(\d{4}-\d{2}-\d{2})/);
    if (link) cycleKey = link[1];
  }
  // Fall back to the first cycle link anywhere on the page.
  if (!cycleKey) {
    const m = html.match(/NASR_Subscription\/(\d{4}-\d{2}-\d{2})/);
    if (m) cycleKey = m[1];
  }
  if (!cycleKey) throw new Error('Cycle link not found');

  const url = ROOT + cycleKey + '/';
  post({ phase: 'cycle', url, cycleKey });
  return { cycleKey, url };
}

function parseDatasetUrls(html) {
  const out = {};
  const re = /<a[^>]+href="([^"]+?_(APT|NAV|FIX)_CSV\.zip)"/g;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    out[m[2]] = href.startsWith('http') ? href : ('https://nfdc.faa.gov' + href);
  }
  return out;
}

/** Minimal ZIP reader — stored and deflate entries, via DecompressionStream. */
async function unzip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = {};
  const decoder = new TextDecoder('utf-8');
  let pos = 0;

  for (;;) {
    // Scan for the next local file header signature (0x04034b50).
    let found = false;
    while (pos + 4 <= buf.length) {
      if (dv.getUint32(pos, true) === 0x04034b50) { found = true; break; }
      pos++;
    }
    if (!found) break;

    const compMethod = dv.getUint16(pos + 8, true);
    const csize = dv.getUint32(pos + 18, true);
    const nlen = dv.getUint16(pos + 26, true);
    const elen = dv.getUint16(pos + 28, true);
    const name = decoder.decode(buf.subarray(pos + 30, pos + 30 + nlen));
    const dataStart = pos + 30 + nlen + elen;
    const data = buf.subarray(dataStart, dataStart + csize);
    pos = dataStart + csize;

    if (compMethod === 0) {
      out[name] = new Uint8Array(data);
    } else {
      if (!('DecompressionStream' in globalThis)) {
        throw new Error('Zip requires deflate decode but no DecompressionStream');
      }
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      out[name] = new Uint8Array(await new Response(stream).arrayBuffer());
    }
  }
  return out;
}

/** RFC-4180-ish CSV parser returning an array of header-keyed objects. */
function parseCSV(text) {
  const rows = [];
  let i = 0, cell = '', inQuote = false, row = [];
  while (i < text.length) {
    const c = text[i++];
    if (inQuote) {
      if (c === '"') {
        if (text[i] === '"') { cell += '"'; i++; } else { inQuote = false; }
      } else cell += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c === '\r') { /* ignore */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }

  const head = (rows.shift() || []).map(s => s.trim());
  return rows.map(r => {
    const o = {};
    for (let j = 0; j < head.length; j++) o[head[j]] = r[j] || '';
    return o;
  });
}

function toNum(s) {
  const n = parseFloat(String(s || '').trim());
  return Number.isFinite(n) ? n : NaN;
}

/** Download one dataset zip and return the parsed rows of its *_BASE.csv. */
async function loadDataset(url, baseCsvRe, fallbackName, phase, post) {
  post({ phase: `${phase}_start`, url });
  const files = await unzip(await fetchBuf(url));
  post({ phase: `${phase}_unzipped`, fileCount: Object.keys(files).length });
  const name = Object.keys(files).find(n => baseCsvRe.test(n)) || fallbackName;
  const csv = new TextDecoder('utf-8').decode(files[name] || new Uint8Array());
  return parseCSV(csv);
}

/** Fetch the current cycle end-to-end and write the indexes to chrome.storage.local. */
export async function fetchAndPersistCycle(post = () => {}) {
  const { cycleKey, url } = await discoverCycle(post);
  const urls = parseDatasetUrls(await fetchText(url));

  const airports = {}, navaids = {}, fixes = {};

  if (urls.APT) {
    for (const r of await loadDataset(urls.APT, /\/?APT_BASE\.csv$/i, 'APT_BASE.csv', 'apt', post)) {
      const lat = toNum(r['LAT_DECIMAL']), lon = toNum(r['LONG_DECIMAL']);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const icao = (r['ICAO_ID'] || '').trim().toUpperCase();
      const faa = (r['ARPT_ID'] || '').trim().toUpperCase();
      // ICAO-identified airports key on the ICAO id; the rest key on "A/<FAA id>".
      const key = icao || (faa ? 'A/' + faa : null);
      if (!key) continue;
      airports[key] = { faaLocId: faa || '', icaoId: icao || undefined, lat, lon, name: (r['ARPT_NAME'] || '').trim() };
    }
    post({ phase: 'apt_parsed', count: Object.keys(airports).length });
  }

  if (urls.NAV) {
    for (const r of await loadDataset(urls.NAV, /\/?NAV_BASE\.csv$/i, 'NAV_BASE.csv', 'nav', post)) {
      if ((r['NAV_TYPE'] || '').trim().toUpperCase().includes('NDB')) continue;
      const id = (r['NAV_ID'] || '').trim().toUpperCase();
      if (id.length !== 3) continue;
      const lat = toNum(r['LAT_DECIMAL']), lon = toNum(r['LONG_DECIMAL']);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inBounds(lat, lon)) continue;
      const freqMHz = toNum(r['FREQ']);
      navaids[id] = { id, lat, lon, freqMHz: Number.isFinite(freqMHz) ? freqMHz : undefined };
    }
    post({ phase: 'nav_parsed', count: Object.keys(navaids).length });
  }

  if (urls.FIX) {
    for (const r of await loadDataset(urls.FIX, /\/?FIX_BASE\.csv$/i, 'FIX_BASE.csv', 'fix', post)) {
      const id = (r['FIX_ID'] || '').trim().toUpperCase();
      if (id.length !== 5) continue;
      const lat = toNum(r['LAT_DECIMAL']), lon = toNum(r['LONG_DECIMAL']);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inBounds(lat, lon)) continue;
      fixes[id] = { id, lat, lon };
    }
    post({ phase: 'fix_parsed', count: Object.keys(fixes).length });
  }

  await chrome.storage.local.set({
    PRO_AIRPORT_INDEX: airports,
    PRO_NAV_INDEX: navaids,
    PRO_FIX_INDEX: fixes,
    PRO_META: {
      counts: {
        airports: Object.keys(airports).length,
        navaids: Object.keys(navaids).length,
        fixes: Object.keys(fixes).length
      },
      cycleKey,
      cycleDate: cycleKey,
      fetchedAt: Date.now()
    }
  });

  post({ phase: 'done', meta: { cycleKey } });
}
