// Pivotal Weather map regions, keyed by the slug that appears in the map image filename
// (e.g. .../prateptype_cat-imp.us_sw.png -> "us_sw").
//
// Deriving the region from the image URL rather than from a UI label means the region and the
// pixels on screen can never disagree: they arrive together.
//
// SOURCE OF TRUTH — every number below was read from Pivotal's own classic-UI page state on
// 2026-08-28:
//
//   pw_web_state.domain.bounds_latlon = [[latMin, latMax], [lonMin, lonMax]]
//   pw_web_state.domain.map_offset    = [1, 47]
//   pw_web_state.domain.map_size      = [1098, 770]
//
// harvested by fetching /model.php?...&r=<slug> for each slug. Do not hand-tune these; re-harvest
// from that page state if Pivotal ever changes a region's extent.

/** Every region Pivotal offers in the zoom menu, with its lat/lon extent. */
export const REGIONS = {
  conus: { name: 'Continental US',   bounds: { latMin: 21,                latMax: 59.01,             lonMin: -129,    lonMax: -64 } },
  us_nw: { name: 'Northwest US',     bounds: { latMin: 40,                latMax: 53,                lonMin: -133.13, lonMax: -110.9 } },
  us_sw: { name: 'Southwest US',     bounds: { latMin: 30.367251461988,   latMax: 43.232748538012,   lonMin: -132,    lonMax: -110 } },
  us_nr: { name: 'Northern Rockies', bounds: { latMin: 39,                latMax: 50,                lonMin: -119.81, lonMax: -101 } },
  us_fc: { name: 'Four Corners',     bounds: { latMin: 31.25,             latMax: 42.25,             lonMin: -118.4,  lonMax: -99.6 } },
  us_nc: { name: 'North Central US', bounds: { latMin: 39.8,              latMax: 51,                lonMin: -108.55, lonMax: -89.4 } },
  us_c:  { name: 'Central US',       bounds: { latMin: 32.3,              latMax: 43.8,              lonMin: -108.67, lonMax: -89 } },
  us_sc: { name: 'South Central US', bounds: { latMin: 25.75,             latMax: 38.25,             lonMin: -108,    lonMax: -86.62 } },
  us_mw: { name: 'Midwest US',       bounds: { latMin: 36.5,              latMax: 47.5,              lonMin: -98.81,  lonMax: -80 } },
  us_ov: { name: 'Ohio Valley',      bounds: { latMin: 31.5,              latMax: 42.5,              lonMin: -96.71,  lonMax: -77.91 } },
  us_se: { name: 'Southeast US',     bounds: { latMin: 24.3,              latMax: 36,                lonMin: -95,     lonMax: -75 } },
  us_ne: { name: 'Northeast US',     bounds: { latMin: 37,                latMax: 47.6,              lonMin: -84.93,  lonMax: -66.8 } },
  us_ma: { name: 'Mid-Atlantic',     bounds: { latMin: 31.5,              latMax: 43.5,              lonMin: -89.52,  lonMax: -69 } },
  gom:   { name: 'Gulf of Mexico',   bounds: { latMin: 20.213450292398,   latMax: 32.786549707602,   lonMin: -99.75,  lonMax: -78.25 } },
  ca_w:  { name: 'Western Canada',   bounds: { latMin: 45.8,              latMax: 63.2,              lonMin: -139.4,  lonMax: -109.646 } },
  ca_c:  { name: 'Central Canada',   bounds: { latMin: 46,                latMax: 63,                lonMin: -115,    lonMax: -85.93 } },
  ca_e:  { name: 'Eastern Canada',   bounds: { latMin: 41,                latMax: 61,                lonMin: -86.5,   lonMax: -52.3 } }
};

/**
 * Pixel rect of the map graticule inside the rendered PNG, in natural-image pixels.
 * Equals map_offset .. map_offset + map_size, which is identical for every region.
 *
 * The classic UI also publishes this as <area id="click_map_area" coords="1,47,1099,817">, and
 * the classic adapter reads it live so it stays correct on its own. The Beta UI does not expose
 * it, so this constant is the fallback there.
 */
export const DEFAULT_PIXEL_BOUNDS = { x1: 1, y1: 47, x2: 1099, y2: 817 };

/** Natural size of every Pivotal map PNG. Used as the canvas backing-store size. */
export const NATURAL_SIZE = { w: 1100, h: 850 };

/**
 * Widest extent across all regions above. The NASR importer keeps only records inside this box,
 * so every region has data to draw with.
 */
export const DATA_BOUNDS = { latMin: 20, latMax: 64, lonMin: -140, lonMax: -52 };

/** Human-readable name for a slug, falling back to the slug itself for regions we don't know. */
export function regionName(slug) {
  return (REGIONS[slug] && REGIONS[slug].name) || slug || '';
}

/** Lat/lon bounds for a slug, or null for a region Pivotal has added that we don't know yet. */
export function regionBounds(slug) {
  return (REGIONS[slug] && REGIONS[slug].bounds) || null;
}
