// MV3 service worker entry point.

import { PRO_VERSION } from '../../version.js';
import { discoverCycle, fetchAndPersistCycle } from './nasr.js';
import { handleSessionMessage } from './session.js';

let port = null;

/** Send a progress/status update to the sidebar, if one is connected. */
function post(o) {
  try { if (port) port.postMessage(o); } catch (_) { /* sidebar went away */ }
}

/** Download NASR data if the cached cycle is missing or stale, then report status. */
async function autoCheckNASR() {
  try {
    const stored = await chrome.storage.local.get(['PRO_META']);
    const cachedCycle = stored.PRO_META && stored.PRO_META.cycleKey;

    let needsFetch = false;
    try {
      const { cycleKey } = await discoverCycle(post);
      needsFetch = !cachedCycle || cachedCycle !== cycleKey;
    } catch (e) {
      console.warn('[PRO][bg] cycle discovery failed:', e);
      needsFetch = !cachedCycle;  // no cache and no network: nothing we can do but try
    }

    if (needsFetch) {
      console.log('[PRO][bg] fetching NASR: cache missing or outdated');
      await fetchAndPersistCycle(post);
    } else {
      console.log('[PRO][bg] NASR cache up to date:', cachedCycle);
    }

    const { PRO_META } = await chrome.storage.local.get(['PRO_META']);
    post({
      phase: 'nasr_status',
      version: PRO_VERSION,
      cycleKey: PRO_META && PRO_META.cycleKey,
      fetchedAt: PRO_META && PRO_META.fetchedAt
    });
  } catch (e) {
    console.warn('[PRO][bg] NASR auto-check failed:', e);
    post({ phase: 'error', error: String((e && e.message) || e) });
  }
}

chrome.runtime.onStartup.addListener(autoCheckNASR);
chrome.runtime.onInstalled.addListener(autoCheckNASR);

chrome.runtime.onConnect.addListener(p => {
  if (p.name !== 'PRO_FAA_DIRECT') return;
  port = p;

  // A sidebar just connected: tell it what we have, so it can enable Draw without waiting
  // for a cycle check it may have missed.
  chrome.storage.local.get(['PRO_META']).then(({ PRO_META }) => {
    post({
      phase: 'nasr_status',
      version: PRO_VERSION,
      cycleKey: PRO_META && PRO_META.cycleKey,
      fetchedAt: PRO_META && PRO_META.fetchedAt
    });
  });

  p.onMessage.addListener(async msg => {
    if (msg && msg.cmd === 'FETCH_CURRENT_CYCLE') {
      try {
        await fetchAndPersistCycle(post);
      } catch (e) {
        post({ phase: 'error', error: String((e && e.message) || e) });
      }
    }
  });

  p.onDisconnect.addListener(() => { port = null; });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleSessionMessage(msg, sender)
    .then(res => { if (res) sendResponse(res); })
    .catch(e => sendResponse({ ok: false, error: String((e && e.message) || e) }));
  return true;  // keep the channel open for the async response
});
