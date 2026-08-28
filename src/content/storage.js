// Last-route persistence.
//
// Two layers: sessionStorage for an instant, synchronous restore on reload, and
// chrome.storage.session (via the service worker) which survives a sessionStorage clear and is
// keyed per tab. Writes go to both; reads prefer the service worker and fall back.

import { log, warn } from '../common/log.js';

const FALLBACK_KEY = 'PRO_LAST_ROUTE_FALLBACK';

export async function saveLastRoute(route, color, width) {
  const data = { route, color, width, t: Date.now() };
  try {
    sessionStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
  } catch (_) { /* private mode or storage full */ }
  try {
    await chrome.runtime.sendMessage({ cmd: 'PRO_SAVE_LAST_ROUTE', data });
  } catch (e) {
    log('storage', 'save via service worker failed, sessionStorage still holds it', e);
  }
}

export async function loadLastRoute() {
  let fallback = null;
  try {
    const raw = sessionStorage.getItem(FALLBACK_KEY);
    if (raw) fallback = JSON.parse(raw);
  } catch (_) { /* ignore malformed */ }

  try {
    const res = await chrome.runtime.sendMessage({ cmd: 'PRO_LOAD_LAST_ROUTE' });
    return (res && res.data) || fallback;
  } catch (e) {
    log('storage', 'load via service worker failed, using sessionStorage', e);
    return fallback;
  }
}

export async function clearLastRoute() {
  try {
    sessionStorage.removeItem(FALLBACK_KEY);
  } catch (_) { /* ignore */ }
  try {
    await chrome.runtime.sendMessage({ cmd: 'PRO_CLEAR_LAST_ROUTE' });
  } catch (e) {
    warn('storage', 'clear via service worker failed', e);
  }
}
