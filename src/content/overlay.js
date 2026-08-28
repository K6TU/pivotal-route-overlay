// The route canvas.
//
// The canvas backing store is always the map PNG's natural size (1100x850), so lat/lon projects
// straight into image pixels and the same drawing code serves both UIs. Only *placement* differs:
//
//   'contained' (Beta)    the canvas is a sibling of the map <img>, sized 100% x 100%. The page's
//                         own pan/zoom transform and overflow clip apply to it automatically, so
//                         there is nothing to recompute when the user pans, zooms or resizes.
//
//   'document' (classic)  the canvas is on <body>, positioned from the image's bounding rect.
//                         This needs repositioning on scroll and resize.

import { NATURAL_SIZE } from '../common/regions.js';
import { project } from '../common/geo.js';
import { log } from '../common/log.js';

const CANVAS_ID = 'pro_route_canvas';

const state = {
  canvas: null,
  mount: null,     // {el, mode, img}
  last: null       // {latlngs, marks, bounds, pixelBounds, color, width}
};

function createCanvas() {
  const cv = document.createElement('canvas');
  cv.id = CANVAS_ID;
  cv.width = NATURAL_SIZE.w;
  cv.height = NATURAL_SIZE.h;
  cv.style.pointerEvents = 'none';
  cv.style.position = 'absolute';
  cv.style.zIndex = '1';
  cv.style.display = 'none';
  return cv;
}

/**
 * Ensure a canvas exists and is attached to the right place.
 * Re-attaches when React has replaced the map container out from under us.
 */
function ensureCanvas(mount) {
  const remounting = !state.canvas ||
                     !state.canvas.isConnected ||
                     !state.mount ||
                     state.mount.el !== mount.el ||
                     state.mount.mode !== mount.mode;

  if (remounting) {
    if (state.canvas && state.canvas.isConnected) state.canvas.remove();
    state.canvas = createCanvas();
    mount.el.appendChild(state.canvas);
    log('overlay', 'canvas mounted', mount.mode, mount.el.tagName);
  }
  state.mount = mount;
  position();
  return state.canvas;
}

/** Place the canvas over the map image according to the mount mode. */
function position() {
  const cv = state.canvas;
  const mount = state.mount;
  if (!cv || !mount) return;

  if (mount.mode === 'contained') {
    // The parent box is the image box; matching it is all we need. Pan/zoom is the page's job.
    cv.style.left = '0';
    cv.style.top = '0';
    cv.style.width = '100%';
    cv.style.height = '100%';
    return;
  }

  const r = mount.img.getBoundingClientRect();
  cv.style.left = Math.round(window.scrollX + r.left) + 'px';
  cv.style.top = Math.round(window.scrollY + r.top) + 'px';
  cv.style.width = r.width + 'px';
  cv.style.height = r.height + 'px';
}

/**
 * Draw a route.
 *
 * @param {{el:Element, mode:string, img:HTMLImageElement}} mount
 * @param {{latlngs:Array, marks:Array, bounds:Object, pixelBounds:Object, color:string, width:number}} route
 */
export function draw(mount, route) {
  if (!route || !Array.isArray(route.latlngs) || route.latlngs.length < 2) {
    clear();
    return;
  }

  const cv = ensureCanvas(mount);
  state.last = route;

  const ctx = cv.getContext('2d');
  const { bounds, pixelBounds: px } = route;
  ctx.clearRect(0, 0, cv.width, cv.height);

  ctx.lineWidth = Math.max(1, route.width || 3);
  ctx.strokeStyle = route.color || '#ff0000';
  ctx.setLineDash([]);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  route.latlngs.forEach(([lat, lon], i) => {
    const { x, y } = project(lat, lon, bounds, px);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Hour marks.
  if (Array.isArray(route.marks) && route.marks.length) {
    ctx.fillStyle = route.color || '#ff0000';
    const size = Math.max(8, (route.width || 3) * 3);
    for (const [lat, lon] of route.marks) {
      const { x, y } = project(lat, lon, bounds, px);
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x - size / 2, y + size / 2);
      ctx.lineTo(x + size / 2, y + size / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  cv.style.display = '';
  log('overlay', 'drew', route.latlngs.length, 'points,', (route.marks || []).length, 'hour marks');
}

/** Hide the overlay and forget the last route. */
export function clear() {
  state.last = null;
  if (!state.canvas) return;
  const ctx = state.canvas.getContext('2d');
  ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  state.canvas.style.display = 'none';
}

/** Hide the overlay but keep the route, so a redraw can restore it (used while a map loads). */
export function hide() {
  if (state.canvas) state.canvas.style.display = 'none';
}

/**
 * Keep a 'document'-mode canvas aligned with its image. No-op for 'contained' mode, where the
 * browser handles it. Returns an unsubscribe function.
 */
export function trackPlacement() {
  const onMove = () => { if (state.mount && state.mount.mode === 'document') position(); };
  window.addEventListener('scroll', onMove, { passive: true });
  window.addEventListener('resize', onMove);
  return () => {
    window.removeEventListener('scroll', onMove);
    window.removeEventListener('resize', onMove);
  };
}
