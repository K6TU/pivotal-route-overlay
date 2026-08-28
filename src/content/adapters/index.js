// Site adapters isolate everything that depends on Pivotal Weather's markup.
//
// When Pivotal changes their UI, this directory is the only place that should need editing.
//
// Adapter interface:
//   id                  'classic' | 'beta'
//   matches()           does this adapter apply to the current page?
//   getMapImage()       -> HTMLImageElement | null
//   getPixelBounds(img) -> {x1,y1,x2,y2} graticule rect in natural-image pixels
//   getMount(img)       -> {el, mode}  where mode is 'contained' or 'document'
//   getRegionName(slug) -> display name, when the site knows a better one than our slug table

import { classicAdapter } from './classic.js';
import { betaAdapter } from './beta.js';

// Order matters: both adapters match on a classic page (its map image is also a /maps/models/
// URL), so the more specific classic adapter is tried first. Selection is by capability rather
// than by hostname, so if Pivotal ever promotes the React UI to www the beta adapter takes over
// on its own.
const ADAPTERS = [classicAdapter, betaAdapter];

/**
 * The adapter for the current page, or null if no map is present yet.
 *
 * Both adapters require a map element, so this returns null on a Pivotal page that has no map
 * and on the Beta UI before React has rendered. Callers should re-try rather than give up.
 */
export function pickAdapter() {
  return ADAPTERS.find(a => a.matches()) || null;
}

/**
 * Region slug from a map image URL.
 *
 * Pivotal names every render "<product>.<region>.png" (e.g. prateptype_cat-imp.us_sw.png),
 * so the image itself tells us which region it depicts. This is the only region signal that
 * cannot disagree with the pixels on screen.
 */
export function regionSlugFromSrc(src) {
  if (!src) return '';
  const file = String(src).split('?')[0].split('/').pop() || '';
  const parts = file.split('.');
  return parts.length >= 3 ? parts[parts.length - 2] : '';
}
