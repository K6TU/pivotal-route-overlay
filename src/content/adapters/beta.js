// Beta (React) UI: https://beta.pivotalweather.com/models/...
//
// As of 2026-08 Pivotal rebuilt this UI on Tailwind utility classes and react-zoom-pan-pinch.
// All the hashed CSS-module class names the extension used to key off are gone, so this adapter
// deliberately anchors on two things that are far more stable than styling:
//
//   1. the map image URL, which must contain /maps/models/ for the app to work at all
//   2. the image's own parent element, whatever it happens to be called
//
// The map lives inside .react-transform-component, which carries a CSS transform for pan/zoom,
// and .react-transform-wrapper, which clips it. Mounting the canvas as a sibling of the image
// means the browser applies that same transform and clip to our route for free — no scroll,
// resize, pan or zoom handling required on our side.

import { DEFAULT_PIXEL_BOUNDS } from '../../common/regions.js';

/**
 * Host-agnostic: matches both the beta CDN (cdn.pivotalweather.com/m4o/maps/models/...) and
 * the classic origin (m5o.pivotalweather.com/maps/models/...).
 */
const MAP_IMG_SELECTOR = 'img[src*="/maps/models/"]';

export const betaAdapter = {
  id: 'beta',

  matches() {
    return /(^|\.)pivotalweather\.com$/.test(location.hostname) &&
           !!document.querySelector(MAP_IMG_SELECTOR);
  },

  getMapImage() {
    // The React tree renders a low-res base64 placeholder alongside the real map; the selector
    // picks the real one because only it has a /maps/models/ URL.
    return document.querySelector(MAP_IMG_SELECTOR);
  },

  /** The beta UI does not expose the graticule rect, so we use the surveyed constant. */
  getPixelBounds() {
    return DEFAULT_PIXEL_BOUNDS;
  },

  getMount(img) {
    return { el: img.parentElement, mode: 'contained', img };
  },

  getRegionName() {
    const btn = document.querySelector('button[aria-label^="Zoom: "]');
    const label = btn && btn.getAttribute('aria-label');
    return label ? label.replace(/^Zoom:\s*/, '').trim() : '';
  }
};
