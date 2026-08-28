// Orchestration: watch the map, keep the overlay in sync with it.
//
// The whole redraw pipeline hangs off one signal — the map <img> and its src. Region, geometry
// and pixels all derive from that single source, so they cannot disagree. This replaces the
// previous arrangement of five overlapping observers, a 500ms poll and a retry loop that existed
// only to reconcile a region label with an image that had not loaded yet.

import { PRO_VERSION } from '../../version.js';
import { log, warn } from '../common/log.js';
import { regionName, regionBounds } from '../common/regions.js';
import { pickAdapter, regionSlugFromSrc } from './adapters/index.js';
import { createPanel } from './panel.js';
import { parseRoute, getIndexes, buildRouteGeometry } from './route.js';
import * as overlay from './overlay.js';
import { saveLastRoute, loadLastRoute, clearLastRoute } from './storage.js';

let adapter = null;
let panel = null;

/** Resolves once the sidebar exists and has been hydrated. Created on first sight of a map. */
let uiReady = null;

/** Cached parse, so stepping a forecast loop doesn't re-decode the route on every frame. */
let parseCache = { route: null, parsed: null };

/** Signature of the last completed draw, used to skip redundant work. */
let lastSignature = null;

/** Slug we last warned about, so the unsupported-region notice isn't repeated. */
let noticedSlug = null;

let redrawQueued = false;

// --- redraw pipeline ---

function scheduleRedraw() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(() => {
    redrawQueued = false;
    redraw().catch(e => warn('main', 'redraw failed', e));
  });
}

async function redraw() {
  // Both adapters key off the map element, which on the Beta UI does not exist until React has
  // rendered — and can be swapped for the other adapter's if Pivotal moves the React UI. So the
  // adapter is resolved here, on every pass, rather than once at startup.
  adapter = pickAdapter();

  const img = adapter && adapter.getMapImage();
  if (!img) {
    // No map on this page (or the SPA navigated away from one). Keep the panel out of the way.
    overlay.hide();
    if (panel) panel.setVisible(false);
    lastSignature = null;
    return;
  }

  await ensureUI();
  panel.setVisible(true);

  // A region change swaps the image src; hide the stale line until the new map is on screen.
  if (!img.complete || !img.naturalWidth) {
    overlay.hide();
    lastSignature = null;
    img.addEventListener('load', scheduleRedraw, { once: true });
    return;
  }

  const slug = regionSlugFromSrc(img.src);
  const name = regionName(slug) || adapter.getRegionName() || slug;
  panel.setMapArea(name);

  const routeStr = panel.route.trim();
  if (!routeStr) {
    overlay.clear();
    lastSignature = null;
    return;
  }

  const bounds = regionBounds(slug);
  if (!bounds) {
    overlay.clear();
    lastSignature = null;
    if (noticedSlug !== slug) {
      noticedSlug = slug;
      panel.status(`Region "${name}" is not supported — no map bounds defined.`);
    }
    return;
  }
  noticedSlug = null;

  const signature = [img.src, routeStr, panel.color, panel.width, panel.airspeed].join('|');
  if (signature === lastSignature) return;

  if (parseCache.route !== routeStr) {
    const parsed = await parseRoute(routeStr, await getIndexes());
    if (parsed.error) {
      overlay.clear();
      lastSignature = null;
      parseCache = { route: null, parsed: null };
      panel.status('Route error: ' + parsed.error);
      return;
    }
    parseCache = { route: routeStr, parsed };
  }

  const geom = buildRouteGeometry(parseCache.parsed, bounds, panel.airspeed);
  if (geom.latlngs.length < 2) {
    overlay.clear();
    lastSignature = signature;
    panel.status(`Route is outside ${name}.`);
    return;
  }

  overlay.draw(adapter.getMount(img), {
    latlngs: geom.latlngs,
    marks: geom.marks,
    bounds,
    pixelBounds: adapter.getPixelBounds(img),
    color: panel.color,
    width: panel.width
  });
  lastSignature = signature;
}

// --- change detection ---

/** True if a mutation only touched our own UI, and so must not trigger a redraw. */
function isOurs(node) {
  return node && node.nodeType === 1 &&
         (node.id === 'pro-overlay-ui' || node.id === 'pro_route_canvas' ||
          node.closest?.('#pro-overlay-ui'));
}

function watchMap() {
  let watchedImg = null;
  let srcObserver = null;

  /** Re-point the src observer whenever React swaps in a new <img> element. */
  const rebind = () => {
    const a = pickAdapter();
    const img = a && a.getMapImage();
    if (img === watchedImg) return;
    watchedImg = img;
    if (srcObserver) srcObserver.disconnect();
    if (!img) return;
    srcObserver = new MutationObserver(scheduleRedraw);
    srcObserver.observe(img, { attributes: true, attributeFilter: ['src'] });
    log('main', 'watching map image', img.src);
  };

  // The Beta UI re-renders the whole map subtree on navigation, so we watch the document and
  // re-resolve the image rather than trying to hold on to a container element.
  const domObserver = new MutationObserver(records => {
    for (const r of records) {
      if (isOurs(r.target)) continue;
      const added = [...r.addedNodes, ...r.removedNodes];
      if (added.length && added.every(isOurs)) continue;
      rebind();
      scheduleRedraw();
      return;
    }
  });
  domObserver.observe(document.documentElement, { childList: true, subtree: true });

  rebind();
  overlay.trackPlacement();

  // Draw once up front: on the classic UI the map is already present at document_end, and on the
  // Beta UI the script can land after React has finished rendering. In neither case would a
  // mutation arrive to kick us off.
  scheduleRedraw();
}

// --- user actions ---

async function onDraw() {
  const routeStr = panel.route.trim();
  if (!routeStr) {
    panel.status('Enter a route first.');
    return;
  }
  const parsed = await parseRoute(routeStr, await getIndexes());
  if (parsed.error) {
    overlay.clear();
    panel.status('Route error: ' + parsed.error);
    return;
  }
  parseCache = { route: routeStr, parsed };
  lastSignature = null;
  await saveLastRoute(routeStr, panel.color, panel.width);
  panel.status(`Route: ${parsed.waypoints.map(w => w.id).join(' → ')}`);
  scheduleRedraw();
}

async function onClear() {
  panel.setRoute('');
  parseCache = { route: null, parsed: null };
  lastSignature = null;
  overlay.clear();
  await clearLastRoute();
  panel.status('Cleared.');
}

function onSettingsChange() {
  lastSignature = null;
  scheduleRedraw();
  const routeStr = panel.route.trim();
  if (routeStr) saveLastRoute(routeStr, panel.color, panel.width);
}

// --- background wiring ---

function connectBackground() {
  const port = chrome.runtime.connect({ name: 'PRO_FAA_DIRECT' });

  port.onMessage.addListener(m => {
    if (!m || !m.phase) return;

    if (m.phase === 'nasr_status') {
      const ready = !!(m.cycleKey && m.fetchedAt);
      panel.setCycle(ready ? `✅ ${m.cycleKey}` : (m.cycleKey || 'Updating...'));
      panel.setDrawEnabled(ready);
      panel.status(`PRO v${m.version || PRO_VERSION} | NASR cycle: ${m.cycleKey || 'unknown'}`);
      return;
    }

    if (/^(start|apt_start|nav_start|fix_start)$/.test(m.phase)) {
      panel.setCycle('Updating...');
    } else if (m.phase === 'done') {
      chrome.storage.local.get(['PRO_META']).then(({ PRO_META }) => {
        if (PRO_META && PRO_META.cycleKey) {
          panel.setCycle(`✅ ${PRO_META.cycleKey}`);
          panel.setDrawEnabled(true);
        }
      });
    } else if (m.phase === 'error') {
      panel.setCycle('❌ !Failed!');
    }
    panel.status(m.phase + (m.error ? ': ' + m.error : ''));
  });

  return port;
}

/** Report what's cached and kick off a fetch if we have nothing to draw with. */
async function hydrate(port) {
  const st = await chrome.storage.local.get(
    ['PRO_META', 'PRO_AIRPORT_INDEX', 'PRO_NAV_INDEX', 'PRO_FIX_INDEX']);

  const haveData = st.PRO_META && st.PRO_AIRPORT_INDEX && Object.keys(st.PRO_AIRPORT_INDEX).length;
  if (haveData) {
    panel.setCycle(`✅ ${st.PRO_META.cycleKey}`);
    panel.setDrawEnabled(true);
    panel.status(`Cache: cycle ${st.PRO_META.cycleKey} | APT ${Object.keys(st.PRO_AIRPORT_INDEX).length}` +
                 ` | NAV ${Object.keys(st.PRO_NAV_INDEX || {}).length}` +
                 ` | FIX ${Object.keys(st.PRO_FIX_INDEX || {}).length}`);
    return;
  }

  panel.setDrawEnabled(false);
  panel.status('Cache empty. Fetching NASR datasets...');
  try {
    port.postMessage({ cmd: 'FETCH_CURRENT_CYCLE' });
  } catch (e) {
    panel.status('Error requesting NASR fetch: ' + ((e && e.message) || e));
  }
}

/** Restore the route from the previous page load, if there was one. */
async function restore() {
  const last = await loadLastRoute();
  if (!last || !last.route) return;
  panel.setRoute(last.route);
  panel.setColor(last.color);
  panel.setWidth(last.width);
  panel.status(`Restored route: ${last.route}`);
  scheduleRedraw();
}

// --- entry point ---

/**
 * Build the sidebar and load its state. Deferred until a map is actually on screen: the Beta UI
 * is a single-page app, so the content script often runs before the map exists, and the user can
 * navigate to and from map pages without a document load.
 */
function ensureUI() {
  if (uiReady) return uiReady;
  uiReady = (async () => {
    panel = createPanel({ onDraw, onClear, onSettingsChange });
    panel.status(`PRO v${PRO_VERSION} — ${adapter.id} UI`);
    await hydrate(connectBackground());
    await restore();
  })();
  return uiReady;
}

export async function start() {
  if (window.__PRO_STARTED) return;   // survives a double injection
  window.__PRO_STARTED = true;

  log('main', 'starting on', location.hostname);
  watchMap();
}
