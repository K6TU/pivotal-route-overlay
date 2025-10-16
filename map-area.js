// Map Area Detection
function detectMapArea() {
  let mapArea = '';
  const zoomMenu = document.getElementById('zoom_menu_link');
  if (zoomMenu && zoomMenu.textContent) {
    mapArea = zoomMenu.textContent.trim();
  }
  if (!mapArea) {
    const modelZoomDiv = Array.from(document.querySelectorAll('div[class$="_modelZoom"]')).find(div => div.querySelector('button[aria-label^="Zoom: "]'));
    if (modelZoomDiv) {
      const btn = modelZoomDiv.querySelector('button[aria-label^="Zoom: "]');
      if (btn && btn.getAttribute('aria-label')) {
        const label = btn.getAttribute('aria-label');
        const match = label.match(/Zoom: (.+)$/);
        if (match) mapArea = match[1].trim();
      }
    }
  }
  return mapArea;
}

const MAP_AREAS = {
  'Continental US': { latMax: 59, latMin: 21, lonMin: -129, lonMax: -64.1 },
  'Northwest US': { latMax: 53, latMin: 40, lonMin: -133.11, lonMax: -110.9 },
  'Southwest US': { latMax: 43.25, latMin: 30.38, lonMin: -132.01, lonMax: -110 },
  'Northern Rockies': { latMax: 50, latMin: 39, lonMin: -119.8, lonMax: -110 },
  'Four Corners': { latMax: 42.25, latMin: 31.25, lonMin: -118.4, lonMax: -99.6 },
  'North Central US': { latMax: 51, latMin: 39.81, lonMin: -108.55, lonMax: -89.44 },
  'Central US': { latMax: 43.8, latMin: 32.3, lonMin: -108.64, lonMax: -89 },
  'South Central US': { latMax: 38.25, latMin: 25.75, lonMin: -108, lonMax: -86.6 },
  'Midwest US': { latMax: 47.5, latMin: 36.5, lonMin: -98.8, lonMax: -80 },
  'Ohio Valley': { latMax: 42.5, latMin: 31.5, lonMin: -96.7, lonMax: -77.9 },
  'Southeast US': { latMax: 36, latMin: 24.3, lonMin: -95, lonMax: -75 },
  'Northeast US': { latMax: 47.6, latMin: 37, lonMin: -84.92, lonMax: -66.8 },
  'Mid-Atlantic': { latMax: 43.5, latMin: 31.5, lonMin: -89.5, lonMax: -69 }
};

// Expose globally
window.detectMapArea = detectMapArea;
window.MAP_AREAS = MAP_AREAS;
