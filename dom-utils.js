// Debug Logging Helper with clean file:line output
function proDebugLog(...args) {
  const debugCheckbox = document.getElementById('pro-debug');
  if (!debugCheckbox || !debugCheckbox.checked) return;

  // Capture caller’s file and line
  const e = new Error();
  const stack = e.stack?.split('\n');
  let location = 'unknown:0';
  if (stack && stack.length > 2) {
    // Extract file and line; strip URL or directory prefix
    const match = stack[2].match(/(?:at\s+.*\()?([^():]+):(\d+):(\d+)\)?$/);
    if (match) {
      // Pull just the filename (no path or protocol)
      const file = match[1].split('/').pop(); // keeps 'observers.js'
      location = `${file}:${match[2]}`;
    }
  }

  console.log(`[PRO][${location}]`, ...args);
}

// DOM Query Helpers
function getBetaMapImage() {
  const mapContainers = Array.from(document.querySelectorAll('div[class$="_mapContainer"]'));
  for (const div of mapContainers) {
    const imgEl = div.querySelector('img[src*="pivotalweather.com/maps/models/"]');
    if (imgEl) return imgEl;
  }
  return null;
}
// Expose globally
window.proDebugLog = proDebugLog;
window.getBetaMapImage = getBetaMapImage;

// dom-utils.js
// Utility functions for DOM queries and manipulation


function getElement(selector) {
  return document.querySelector(selector);
}

function getElements(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function showElement(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = '';
}

function hideElement(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// Expose helpers globally
window.getElement = getElement;
window.getElements = getElements;
window.setValue = setValue;
window.showElement = showElement;
window.hideElement = hideElement;
