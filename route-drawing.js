// Helper: Haversine distance in NM
function haversineNM(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 3440.065;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getClipCode(lat, lon, bounds) {
  let code = 0;
  if (lat > bounds.latMax) code |= 1;
  if (lat < bounds.latMin) code |= 2;
  if (lon < bounds.lonMin) code |= 4;
  if (lon > bounds.lonMax) code |= 8;
  return code;
}

function clipSegment(p1, p2, bounds) {
  let [lat1, lon1] = p1;
  let [lat2, lon2] = p2;
  let code1 = getClipCode(lat1, lon1, bounds);
  let code2 = getClipCode(lat2, lon2, bounds);
  while (true) {
    if (!(code1 | code2)) {
      return [[lat1, lon1], [lat2, lon2]];
    } else if (code1 & code2) {
      return null;
    } else {
      let codeOut = code1 ? code1 : code2;
      let lat, lon;
      if (codeOut & 1) {
        lat = bounds.latMax;
        lon = lon1 + (lon2 - lon1) * (bounds.latMax - lat1) / (lat2 - lat1);
      } else if (codeOut & 2) {
        lat = bounds.latMin;
        lon = lon1 + (lon2 - lon1) * (bounds.latMin - lat1) / (lat2 - lat1);
      } else if (codeOut & 4) {
        lon = bounds.lonMin;
        lat = lat1 + (lat2 - lat1) * (bounds.lonMin - lon1) / (lon2 - lon1);
      } else if (codeOut & 8) {
        lon = bounds.lonMax;
        lat = lat1 + (lat2 - lat1) * (bounds.lonMax - lon1) / (lon2 - lon1);
      }
      if (codeOut === code1) {
        lat1 = lat; lon1 = lon; code1 = getClipCode(lat1, lon1, bounds);
      } else {
        lat2 = lat; lon2 = lon; code2 = getClipCode(lat2, lon2, bounds);
      }
    }
  }
}

function parseRoute(str, getIndexes) {
  return (async function() {
    if (!str || !str.trim()) throw new Error('Enter a route first');
    const toks = str.trim().toUpperCase().split(/\s+/);
    const { airports, navaids, fixes } = await getIndexes();
    function findAirport(tok) {
      if (/^[A-Z]{4}$/.test(tok)) {
        const a = airports[tok]; if (a) return [a.lat, a.lon, tok];
      }
      const a = airports['A/' + tok]; if (a) return [a.lat, a.lon, tok];
      return null;
    }
    function findFix(tok) { const f = fixes[tok]; if (f) return [f.lat, f.lon, tok]; return null; }
    function findVOR(tok) { const v = navaids[tok]; if (v) return [v.lat, v.lon, tok]; return null; }

    const points = [];
    for (const tok of toks) {
      let p = null;
      if (/^[A-Z]{4}$/.test(tok) || /^A\/[A-Z0-9]{3,4}$/.test(tok)) { p = findAirport(tok); }
      if (!p && /^[A-Z]{5}$/.test(tok)) p = findFix(tok);
      if (!p && /^[A-Z]{3}$/.test(tok)) p = findVOR(tok);
      if (!p && /^[A-Z0-9]{3,4}$/.test(tok)) { const a = airports['A/' + tok]; if (a) p = [a.lat, a.lon, tok]; }
      if (!p) return { error: tok };
      points.push(p);
    }
    if (points.length < 2) return { error: 'Could not resolve enough waypoints.' };
    const latlngs = [];
    for (let i = 0; i < points.length - 1; i++) {
      latlngs.push(...interp([points[i][0], points[i][1]], [points[i + 1][0], points[i + 1][1]], 25));
    }
    const wps = points.map(p => ({ id: p[2], lat: p[0], lon: p[1] }));
    return { waypoints: wps, latlngs };
  })();
}

function interp(A, B, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
  }
  return out;
}

function drawRoute(parsed, opts) {
  console.debug('[drawRoute] called with:', { parsed, opts });
  if (!parsed) {
    console.warn('[drawRoute] No parsed route provided:', parsed);
    return;
  }
  if (!window.MAP_AREAS) {
    console.warn('[drawRoute] window.MAP_AREAS is not defined!');
  }
  // Log route properties if available
  if (parsed && typeof parsed === 'object') {
    console.debug('[drawRoute] parsed keys:', Object.keys(parsed));
    if (parsed.latlngs) {
      console.debug('[drawRoute] parsed.latlngs length:', parsed.latlngs.length);
    }
  }
  if (opts) {
    console.debug('[drawRoute] opts:', opts);
  }
  let mapAreaInput = document.getElementById('pro-map-area');
  let mapAreaName = mapAreaInput ? mapAreaInput.value.trim() : 'Continental US';
  console.debug('[drawRoute] Using region:', mapAreaName);
  const bounds = window.MAP_AREAS[mapAreaName] || window.MAP_AREAS['Continental US'];
  const clippedLatLngs = [];
  for (let i = 0; i < parsed.latlngs.length - 1; i++) {
    const seg = clipSegment(parsed.latlngs[i], parsed.latlngs[i + 1], bounds);
    if (seg) {
      if (clippedLatLngs.length === 0 ||
        clippedLatLngs[clippedLatLngs.length - 1][0] !== seg[0][0] ||
        clippedLatLngs[clippedLatLngs.length - 1][1] !== seg[0][1]) {
        clippedLatLngs.push(seg[0]);
      }
      clippedLatLngs.push(seg[1]);
    }
  }
  const airspeed = parseFloat(document.getElementById('pro-airspeed')?.value) || 310;
  const hourDist = airspeed;
  let cumDist = 0, last = clippedLatLngs[0], marks = [], nextMark = hourDist;
  for (let i = 1; i < clippedLatLngs.length; i++) {
    const curr = clippedLatLngs[i];
    const segDist = haversineNM(last[0], last[1], curr[0], curr[1]);
    while (cumDist + segDist >= nextMark) {
      const frac = (nextMark - cumDist) / segDist;
      const lat = last[0] + frac * (curr[0] - last[0]);
      const lon = last[1] + frac * (curr[1] - last[1]);
      marks.push([lat, lon]);
      nextMark += hourDist;
    }
    cumDist += segDist;
    last = curr;
  }
  const detail = {
    latlngs: clippedLatLngs,
    color: (opts && opts.color) || '#ff0000',
    width: (opts && opts.width) || 3,
    bounds: bounds,
    triangles: marks
  };
  console.debug('[drawRoute] Dispatching PRO_DRAW_ROUTE event with detail:', detail);
  window.dispatchEvent(new CustomEvent('PRO_DRAW_ROUTE', { detail }));
}

// Expose globally
window.parseRoute = parseRoute;
window.drawRoute = drawRoute;


function drawRouteFromString(routeStr, color, width, mode) {
  console.debug('[drawRouteFromString] called with:', { routeStr, color, width, mode });
  // mode can be 'restore' or undefined
  if (!routeStr || !routeStr.trim()) return;
  // Use the global getIndexes if available, else fallback
  const getIndexes = window.getIndexes || (async () => ({ airports: {}, navaids: {}, fixes: {} }));
  window.parseRoute(routeStr, getIndexes).then(parsed => {
    console.debug('[drawRouteFromString] parseRoute result:', parsed);
    if (parsed && !parsed.error) {
      window.drawRoute(parsed, { color, width });
      if (mode === 'restore') {
        // Optionally log or handle restore-specific logic
        if (typeof window.proDebugLog === 'function') window.proDebugLog('[PRO][route] drawRouteFromString restore:', routeStr);
      }
    } else {
      console.warn('[PRO][route] drawRouteFromString parse error:', parsed.error);
    }
  });
}

window.drawRouteFromString = drawRouteFromString;
