// Content scripts cannot use static ES imports, so this shim dynamically imports the real
// entry point. Everything downstream is a normal module with normal imports and no globals.
import(chrome.runtime.getURL('src/content/main.js'))
  .then(m => m.start())
  .catch(e => console.warn('[PRO] failed to start:', e));
