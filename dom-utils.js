// Debug Logging Helper
function proDebugLog(...args) {
  const debugCheckbox = document.getElementById('pro-debug');
  if (debugCheckbox && debugCheckbox.checked) {
    console.log(...args);
  }
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
