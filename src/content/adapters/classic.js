// Classic UI: https://www.pivotalweather.com/model.php
//
// A plain server-rendered page. The map is a single <img id="display_image">, and the page
// helpfully publishes the graticule rect as the coords of an image map <area>.

import { DEFAULT_PIXEL_BOUNDS } from '../../common/regions.js';

export const classicAdapter = {
  id: 'classic',

  matches() {
    return /(^|\.)pivotalweather\.com$/.test(location.hostname) &&
           !!document.getElementById('display_image');
  },

  getMapImage() {
    return document.getElementById('display_image');
  },

  /**
   * Read the graticule rect live from the page's own image map. This is self-correcting: if
   * Pivotal ever changes the render geometry, the classic UI picks it up for free.
   */
  getPixelBounds() {
    const area = document.getElementById('click_map_area');
    const parts = String((area && area.coords) || '').split(',').map(v => parseInt(v, 10));
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      const [x1, y1, x2, y2] = parts;
      return { x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2) };
    }
    return DEFAULT_PIXEL_BOUNDS;
  },

  /**
   * The classic map image has no positioned ancestor we can safely draw inside, so the canvas
   * lives on <body> and is repositioned from the image's rect.
   */
  getMount(img) {
    return { el: document.body, mode: 'document', img };
  },

  getRegionName() {
    const zoom = document.getElementById('zoom_menu_link');
    return (zoom && zoom.textContent.trim()) || '';
  }
};
