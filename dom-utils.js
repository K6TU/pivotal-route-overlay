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
