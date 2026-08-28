// Great-circle distance, viewport clipping, and lat/lon -> pixel projection.
//
// The clipping and interpolation here is carried over unchanged from the original
// route-drawing.js; it works and there is no reason to re-derive it.

const NM_PER_RADIAN = 3440.065;

/** Great-circle distance between two lat/lon points, in nautical miles. */
export function haversineNM(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return NM_PER_RADIAN * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Cohen-Sutherland clipping against a lat/lon rectangle ---

const OUT_N = 1, OUT_S = 2, OUT_W = 4, OUT_E = 8;

function outCode(lat, lon, bounds) {
  let code = 0;
  if (lat > bounds.latMax) code |= OUT_N;
  if (lat < bounds.latMin) code |= OUT_S;
  if (lon < bounds.lonMin) code |= OUT_W;
  if (lon > bounds.lonMax) code |= OUT_E;
  return code;
}

/**
 * Clip one segment to the map bounds.
 * Returns the trimmed [[lat,lon],[lat,lon]], or null if the segment is entirely outside.
 */
export function clipSegment(p1, p2, bounds) {
  let [lat1, lon1] = p1;
  let [lat2, lon2] = p2;
  let code1 = outCode(lat1, lon1, bounds);
  let code2 = outCode(lat2, lon2, bounds);

  for (;;) {
    if (!(code1 | code2)) return [[lat1, lon1], [lat2, lon2]];  // both inside
    if (code1 & code2) return null;                             // both outside the same edge

    const codeOut = code1 || code2;
    let lat, lon;
    if (codeOut & OUT_N) {
      lat = bounds.latMax;
      lon = lon1 + (lon2 - lon1) * (bounds.latMax - lat1) / (lat2 - lat1);
    } else if (codeOut & OUT_S) {
      lat = bounds.latMin;
      lon = lon1 + (lon2 - lon1) * (bounds.latMin - lat1) / (lat2 - lat1);
    } else if (codeOut & OUT_W) {
      lon = bounds.lonMin;
      lat = lat1 + (lat2 - lat1) * (bounds.lonMin - lon1) / (lon2 - lon1);
    } else {
      lon = bounds.lonMax;
      lat = lat1 + (lat2 - lat1) * (bounds.lonMax - lon1) / (lon2 - lon1);
    }

    if (codeOut === code1) {
      lat1 = lat; lon1 = lon; code1 = outCode(lat1, lon1, bounds);
    } else {
      lat2 = lat; lon2 = lon; code2 = outCode(lat2, lon2, bounds);
    }
  }
}

/**
 * Clip a whole polyline, returning the visible points in order.
 * Segments that leave and re-enter the map produce a break; callers that care about breaks
 * should use clipSegment directly. Route lines are short enough that this is not an issue.
 */
export function clipPath(latlngs, bounds) {
  const out = [];
  for (let i = 0; i < latlngs.length - 1; i++) {
    const seg = clipSegment(latlngs[i], latlngs[i + 1], bounds);
    if (!seg) continue;
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== seg[0][0] || prev[1] !== seg[0][1]) out.push(seg[0]);
    out.push(seg[1]);
  }
  return out;
}

/** Linearly interpolate n points from A to B inclusive. */
export function interp(A, B, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
  }
  return out;
}

/**
 * Project lat/lon to a pixel position inside the rendered map PNG.
 *
 * `bounds` is the region's lat/lon extent; `px` is the graticule rect in natural-image pixels
 * ({x1,y1,x2,y2}). Pivotal's maps are equirectangular within a region, so this is a plain
 * linear map on both axes.
 */
export function project(lat, lon, bounds, px) {
  const fx = (lon - bounds.lonMin) / (bounds.lonMax - bounds.lonMin);
  const fy = (bounds.latMax - lat) / (bounds.latMax - bounds.latMin);
  return {
    x: px.x1 + fx * (px.x2 - px.x1),
    y: px.y1 + fy * (px.y2 - px.y1)
  };
}

/**
 * Points along `latlngs` at every `intervalNM`, used for the hour marks.
 * Returns [[lat,lon], ...] with the along-track distance already accumulated.
 */
export function marksAlongPath(latlngs, intervalNM) {
  const marks = [];
  if (!Array.isArray(latlngs) || latlngs.length < 2 || !(intervalNM > 0)) return marks;

  let cumDist = 0;
  let nextMark = intervalNM;
  let last = latlngs[0];

  for (let i = 1; i < latlngs.length; i++) {
    const curr = latlngs[i];
    const segDist = haversineNM(last[0], last[1], curr[0], curr[1]);
    while (segDist > 0 && cumDist + segDist >= nextMark) {
      const frac = (nextMark - cumDist) / segDist;
      marks.push([
        last[0] + frac * (curr[0] - last[0]),
        last[1] + frac * (curr[1] - last[1])
      ]);
      nextMark += intervalNM;
    }
    cumDist += segDist;
    last = curr;
  }
  return marks;
}
