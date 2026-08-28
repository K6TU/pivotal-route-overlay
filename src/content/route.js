// Decode a route string into lat/lon points using the cached FAA NASR indexes.

import { interp, clipPath, marksAlongPath } from '../common/geo.js';

const POINTS_PER_LEG = 25;

/** Load the NASR lookup indexes from extension storage. */
export async function getIndexes() {
  const st = await chrome.storage.local.get(['PRO_AIRPORT_INDEX', 'PRO_NAV_INDEX', 'PRO_FIX_INDEX']);
  return {
    airports: st.PRO_AIRPORT_INDEX || {},
    navaids: st.PRO_NAV_INDEX || {},
    fixes: st.PRO_FIX_INDEX || {}
  };
}

/**
 * Resolve one route token to a position.
 *
 * Token forms, in the order they are tried:
 *   KSFO      4-letter ICAO airport id
 *   A/HWD     explicit FAA location id for an airport without an ICAO id
 *   MODNA     5-letter intersection / waypoint
 *   OAK       3-letter VOR / navaid
 *   1O2       bare FAA location id (3-4 chars), tried last so it can't shadow a VOR
 */
function resolveToken(tok, { airports, navaids, fixes }) {
  if (/^[A-Z]{4}$/.test(tok) && airports[tok]) return airports[tok];
  if (/^A\/[A-Z0-9]{3,4}$/.test(tok) && airports[tok]) return airports[tok];
  if (/^[A-Z]{5}$/.test(tok) && fixes[tok]) return fixes[tok];
  if (/^[A-Z]{3}$/.test(tok) && navaids[tok]) return navaids[tok];
  if (/^[A-Z0-9]{3,4}$/.test(tok) && airports['A/' + tok]) return airports['A/' + tok];
  return null;
}

/**
 * Parse a route string into waypoints and a densified lat/lon path.
 * Returns {error} naming the first token that could not be resolved.
 */
export async function parseRoute(str, indexes) {
  if (!str || !str.trim()) return { error: 'Enter a route first' };

  const toks = str.trim().toUpperCase().split(/\s+/);
  const idx = indexes || await getIndexes();

  const waypoints = [];
  for (const tok of toks) {
    const p = resolveToken(tok, idx);
    if (!p) return { error: tok };
    waypoints.push({ id: tok, lat: p.lat, lon: p.lon });
  }
  if (waypoints.length < 2) return { error: 'Enter at least two route points' };

  // Densify each leg so clipping against the map edge lands on a straight line, not a chord.
  const latlngs = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1];
    latlngs.push(...interp([a.lat, a.lon], [b.lat, b.lon], POINTS_PER_LEG));
  }

  return { waypoints, latlngs };
}

/**
 * Clip a parsed route to a region and compute hour marks.
 *
 * Hour marks are measured along the *full* route, not the clipped one, so a route that starts
 * off-screen still shows its marks at the correct along-track times. Marks outside the region
 * are dropped.
 */
export function buildRouteGeometry(parsed, bounds, airspeedKt) {
  const clipped = clipPath(parsed.latlngs, bounds);
  if (clipped.length < 2) return { latlngs: [], marks: [] };

  const allMarks = marksAlongPath(parsed.latlngs, airspeedKt);
  const marks = allMarks.filter(([lat, lon]) =>
    lat <= bounds.latMax && lat >= bounds.latMin &&
    lon >= bounds.lonMin && lon <= bounds.lonMax);

  return { latlngs: clipped, marks };
}
