// The floating PRO sidebar: route entry, appearance controls, FAA cycle status and debug log.

import { PRO_VERSION } from '../../version.js';
import { setDebug } from '../common/log.js';

const POS_KEY = 'PRO_SIDEBAR_POS';
const AIRSPEED_KEY = 'PRO_AIRSPEED';

const INPUT_CSS = 'width:100%;box-sizing:border-box;padding:7px 8px;border-radius:7px;' +
                  'border:1px solid #333;background:#111;color:#fff';
const READONLY_CSS = 'width:100%;box-sizing:border-box;padding:7px 8px;border-radius:7px;' +
                     'border:1px solid #333;background:#222;color:#fff;font-weight:600';

function html() {
  return `
  <div id="pro-overlay-header" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:move">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#000;border:1px solid #bbb"></span>
    <a href="https://tbm-ppp.org" target="_blank" rel="noopener" style="font-size:14px;text-decoration:underline;color:#6ec6ff;font-weight:bold;margin-right:6px">TBM-PPP</a>
    <b id="pro-overlay-title" style="font-size:14px">PRO v${PRO_VERSION}</b>
    <label style="margin-left:auto;display:flex;align-items:center;gap:4px;font-size:12px">
      <input type="checkbox" id="pro-debug" style="margin:0"> Debug
    </label>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;padding:0 8px">
    <div style="min-width:0">
      <label style="display:block;margin-bottom:4px">Map Area</label>
      <input id="pro-map-area" value="" readonly style="${READONLY_CSS}">
    </div>
    <div style="min-width:0">
      <label style="display:block;margin-bottom:4px">FAA Cycle</label>
      <input id="pro-cycle" value="unknown" readonly style="${READONLY_CSS};color:#6ec672">
    </div>
    <div style="min-width:0">
      <label style="display:block;margin-bottom:4px">Airspeed (knots)</label>
      <input id="pro-airspeed" type="number" min="1" max="999" value="310" style="${READONLY_CSS}">
    </div>
    <div style="min-width:0;display:flex;gap:10px">
      <div style="flex:1;min-width:0">
        <label style="display:block;margin-bottom:4px">Width</label>
        <input id="pro-width" type="number" min="1" max="12" value="3" style="${INPUT_CSS}">
      </div>
      <div style="flex:1;min-width:0">
        <label style="display:block;margin-bottom:4px">Color</label>
        <input id="pro-color" type="color" value="#ff0000" style="${INPUT_CSS};height:36px;padding:0">
      </div>
    </div>
  </div>
  <div style="display:grid;gap:10px">
    <div style="padding:0 8px">
      <label style="display:block;margin-bottom:4px">Route</label>
      <input id="pro-route" placeholder="KHWD KDVT" style="${INPUT_CSS}">
    </div>
    <div style="display:flex;gap:10px;margin-bottom:10px;padding:0 8px">
      <button id="pro-draw" disabled style="flex:1;padding:9px 12px;background:#2ecc71;border:0;color:#000;font-weight:700;border-radius:7px;cursor:pointer;opacity:0.6">Parse &amp; Draw</button>
      <button id="pro-clear" style="flex:1;padding:9px 12px;background:#444;border:0;color:#fff;border-radius:7px;cursor:pointer">Clear</button>
    </div>
    <pre id="pro-log" style="white-space:pre-wrap;background:#0a0a0a;padding:8px;border-radius:7px;border:1px solid #222;max-height:220px;overflow:auto;margin:0"></pre>
  </div>`;
}

/** Make the panel draggable by its header, remembering the position for the tab session. */
function makeDraggable(box) {
  const header = box.querySelector('#pro-overlay-header');
  let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

  header.addEventListener('mousedown', e => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const r = box.getBoundingClientRect();
    startLeft = r.left;
    startTop = r.top;
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const left = startLeft + (e.clientX - startX);
    const top = startTop + (e.clientY - startY);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.right = '';
    try { sessionStorage.setItem(POS_KEY, JSON.stringify({ left, top })); } catch (_) {}
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
  });
}

/**
 * Build and attach the sidebar.
 *
 * @param {{onDraw:Function, onClear:Function, onSettingsChange:Function}} handlers
 * @returns the panel API used by main.js
 */
export function createPanel(handlers) {
  const box = document.createElement('div');
  box.id = 'pro-overlay-ui';
  box.style.cssText =
    'position:fixed;top:10px;right:10px;z-index:2147483000;background:#0b0b0c;color:#e6e6e6;' +
    'padding:12px;border-radius:10px;box-shadow:0 8px 22px rgba(0,0,0,.45);width:330px;' +
    'font:13px/1.45 system-ui,Segoe UI,Roboto,Arial;user-select:none';
  box.innerHTML = html();

  try {
    const pos = JSON.parse(sessionStorage.getItem(POS_KEY) || 'null');
    if (pos) { box.style.left = pos.left + 'px'; box.style.top = pos.top + 'px'; box.style.right = ''; }
  } catch (_) {}

  document.body.appendChild(box);
  makeDraggable(box);

  const $ = id => box.querySelector('#' + id);
  const logEl = $('pro-log');
  const drawBtn = $('pro-draw');

  const api = {
    get route()    { return $('pro-route').value || ''; },
    get color()    { return $('pro-color').value || '#ff0000'; },
    get width()    { return parseInt($('pro-width').value, 10) || 3; },
    get airspeed() { return parseFloat($('pro-airspeed').value) || 310; },

    setRoute(v)    { $('pro-route').value = v || ''; },
    setColor(v)    { $('pro-color').value = v || '#ff0000'; },
    setWidth(v)    { $('pro-width').value = String(v || 3); },
    setMapArea(v)  { $('pro-map-area').value = v || ''; },
    setCycle(v)    { $('pro-cycle').value = v; },

    setVisible(on) { box.style.display = on ? '' : 'none'; },

    setDrawEnabled(on) {
      drawBtn.disabled = !on;
      drawBtn.style.opacity = on ? '' : '0.6';
    },

    status(text) {
      logEl.textContent += text + '\n';
      logEl.scrollTop = logEl.scrollHeight;
    }
  };

  // Airspeed persists for the tab session and re-triggers a draw so hour marks update live.
  const airspeed = $('pro-airspeed');
  try {
    const saved = sessionStorage.getItem(AIRSPEED_KEY);
    if (saved) airspeed.value = saved;
  } catch (_) {}
  airspeed.addEventListener('input', () => {
    try { sessionStorage.setItem(AIRSPEED_KEY, airspeed.value); } catch (_) {}
    handlers.onSettingsChange();
  });

  $('pro-color').addEventListener('input', handlers.onSettingsChange);
  $('pro-width').addEventListener('input', handlers.onSettingsChange);
  drawBtn.addEventListener('click', handlers.onDraw);
  $('pro-clear').addEventListener('click', handlers.onClear);
  $('pro-route').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !drawBtn.disabled) handlers.onDraw();
  });

  const debugBox = $('pro-debug');
  chrome.storage.local.get(['PRO_DEBUG']).then(res => {
    debugBox.checked = !!res.PRO_DEBUG;
    setDebug(debugBox.checked);
  });
  debugBox.addEventListener('change', () => {
    setDebug(debugBox.checked);
    chrome.storage.local.set({ PRO_DEBUG: debugBox.checked });
  });

  return api;
}
