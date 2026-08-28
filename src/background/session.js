// Per-tab route persistence. Uses chrome.storage.session so a route survives page reloads and
// animation loops but does not leak between tabs or outlive the browser session.

const keyFor = tabId => 'PRO_LAST_ROUTE_' + tabId;

/**
 * Handle a route-persistence message from a content script.
 * Returns the response object, or null if the message isn't ours.
 */
export async function handleSessionMessage(msg, sender) {
  if (!msg || !msg.cmd || !sender || !sender.tab) return null;
  const key = keyFor(sender.tab.id);

  switch (msg.cmd) {
    case 'PRO_SAVE_LAST_ROUTE':
      await chrome.storage.session.set({ [key]: msg.data || null });
      return { ok: true };

    case 'PRO_LOAD_LAST_ROUTE': {
      const all = await chrome.storage.session.get(key);
      return { ok: true, data: all[key] || null };
    }

    case 'PRO_CLEAR_LAST_ROUTE':
      await chrome.storage.session.remove(key);
      return { ok: true };

    default:
      return null;
  }
}
