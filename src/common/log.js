// Debug logging. Enabled via the sidebar Debug checkbox, persisted in chrome.storage.local.

let enabled = false;

export function setDebug(on) {
  enabled = !!on;
}

export function isDebug() {
  return enabled;
}

/** Log only when debug is enabled. Tagged with the calling module for readability. */
export function log(tag, ...args) {
  if (!enabled) return;
  console.log(`[PRO][${tag}]`, ...args);
}

/** Warnings are always shown — they indicate the extension is not working as intended. */
export function warn(tag, ...args) {
  console.warn(`[PRO][${tag}]`, ...args);
}
