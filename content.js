// Ensure getIndexes returns real data for route parsing
if (typeof window.getIndexes !== 'function') {
  window.getIndexes = async function() {
    const st = await chrome.storage.local.get(['PRO_AIRPORT_INDEX', 'PRO_NAV_INDEX', 'PRO_FIX_INDEX']);
    return {
      airports: st.PRO_AIRPORT_INDEX || {},
      navaids: st.PRO_NAV_INDEX || {},
      fixes: st.PRO_FIX_INDEX || {}
    };
  };
}
// Ensure Map Area input is set after DOM and helpers are ready

// Global observer for map image
let imageObserver = null;
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (window.updateSidebarInput && window.detectMapArea) {
      window.updateSidebarInput(window.detectMapArea());
    }
  }, 100);
});




// Main orchestration logic

function redrawIfBothReady() {
  const img = window.getBetaMapImage();
  const mapArea = window.detectMapArea();
  if (!img || !img.complete || !mapArea) {
    console.log('[PRO][redrawIfBothReady] Skipping: img or mapArea not ready', {img, mapArea});
    return;
  }
  window.updateSidebarInput(mapArea);
  // Use last restored/drawn route if available
  const lastRouteObj = window.__PRO_LAST_ROUTE || {};
  const routeInputVal = (document.getElementById('pro-route') || {}).value || '';
  const colorInputVal = (document.getElementById('pro-color') || {}).value || '#ff0000';
  const widthInputVal = parseInt((document.getElementById('pro-width') || {}).value || '3', 10);
  // Only use route if either global or input is non-empty
  let route = '';
  if (lastRouteObj.route && lastRouteObj.route.trim()) {
    route = lastRouteObj.route;
  } else if (routeInputVal && routeInputVal.trim()) {
    route = routeInputVal;
  }
  const color = lastRouteObj.color || colorInputVal;
  const width = lastRouteObj.width || widthInputVal;
  window.__PRO_LAST_DRAWN_ROUTE = window.__PRO_LAST_DRAWN_ROUTE || '';
  window.__PRO_LAST_DRAWN_MAPAREA = window.__PRO_LAST_DRAWN_MAPAREA || '';
  // Get current map area only once
  let currentMapArea = 'Continental US';
  const mapAreaInput = document.getElementById('pro-map-area');
  if (mapAreaInput && mapAreaInput.value) {
    currentMapArea = mapAreaInput.value.trim();
  }
  // Only redraw if route is non-empty and either route or map area changed
  if (!route || !route.trim()) {
    // Prevent redraw if both global and input route are empty
    console.log('[PRO][redrawIfBothReady] No route to draw, skipping redraw and clearing overlay.');
  window.dispatchEvent(new CustomEvent('PRO_CLEAR_ROUTE'));
    return;
  }
  if (route === window.__PRO_LAST_DRAWN_ROUTE && currentMapArea === window.__PRO_LAST_DRAWN_MAPAREA) {
    console.log('[PRO][redrawIfBothReady] Route and map area unchanged, skipping redraw:', route, currentMapArea);
    return;
  }
  // If the map area changed, clear the previous route line immediately
  if (currentMapArea !== window.__PRO_LAST_DRAWN_MAPAREA) {
    console.log('[PRO][redrawIfBothReady] Map area changed, clearing previous route line and scheduling redraw.');
  window.dispatchEvent(new CustomEvent('PRO_CLEAR_ROUTE'));
    window.__PRO_LAST_DRAWN_MAPAREA = currentMapArea;
    window.__PRO_LAST_DRAWN_ROUTE = '';
    setTimeout(() => {
      window.parseRoute(route, getIndexes).then(parsed => {
        if (!parsed.error) {
          console.log('[PRO][redrawIfBothReady] Drawing route for new region (delayed):', parsed, { color, width, mapArea: currentMapArea });
          window.drawRoute(parsed, { color, width });
          window.__PRO_LAST_DRAWN_ROUTE = route;
          window.__PRO_LAST_DRAWN_MAPAREA = currentMapArea;
        } else {
          console.log('[PRO][redrawIfBothReady] Route invalid for new region, still clearing. Parse error:', parsed.error);
          window.dispatchEvent(new CustomEvent('PRO_CLEAR_ROUTE'));
          window.__PRO_LAST_DRAWN_MAPAREA = currentMapArea;
          window.__PRO_LAST_DRAWN_ROUTE = '';
        }
      }).catch((err) => {
        console.log('[PRO][redrawIfBothReady] Exception during parseRoute:', err);
  window.dispatchEvent(new CustomEvent('PRO_CLEAR_ROUTE'));
        window.__PRO_LAST_DRAWN_MAPAREA = currentMapArea;
        window.__PRO_LAST_DRAWN_ROUTE = '';
      });
    }, 50); // 50ms delay to allow DOM/map area update
    return;
  }
  window.parseRoute(route, getIndexes).then(parsed => {
    if (!parsed.error) {
      console.log('[PRO][redrawIfBothReady] Drawing route:', parsed, { color, width, mapArea: currentMapArea });
  window.postMessage({ PRO_OVERLAY_CMD: 'DRAW', detail: Object.assign({}, parsed, { color, width }) }, '*');
      window.__PRO_LAST_DRAWN_ROUTE = route;
      window.__PRO_LAST_DRAWN_MAPAREA = currentMapArea;
    } else {
      console.log('[PRO][redrawIfBothReady] Parse error:', parsed.error);
  window.dispatchEvent(new CustomEvent('PRO_CLEAR_ROUTE'));
    }
  }).catch((err) => {
    console.log('[PRO][redrawIfBothReady] Exception during parseRoute:', err);
  window.dispatchEvent(new CustomEvent('PRO_CLEAR_ROUTE'));
  });
}


function hideAndClear() {
  window.postMessage({ PRO_OVERLAY_CMD: 'CLEAR' }, '*');
}


// Unified attachObservers function (merged logic)
function attachObservers() {
  const img = window.getBetaMapImage();
  window.observeImage(img, redrawIfBothReady, hideAndClear);
  // Robust polling for subregion button
  let lastBtn = null;
  setInterval(() => {
    const btn = Array.from(document.querySelectorAll('div[class$="_modelZoom"] button[aria-label^="Zoom: "]'))[0];
    if (btn !== lastBtn) {
      lastBtn = btn;
      if (btn) {
        window.proDebugLog('[PRO][content] Attaching subregion observer to button with aria-label:', btn.getAttribute('aria-label'));
        // Wait for window.observeSubregionBtn to be defined
        const tryAttach = (tries = 0) => {
          if (typeof window.observeSubregionBtn === 'function') {
            console.log('[PRO][content.js] Calling observeSubregionBtn with:', btn, 'aria-label:', btn.getAttribute('aria-label'));
            window.observeSubregionBtn(btn, redrawIfBothReady, hideAndClear);
            // Immediately trigger redraw since the region may have changed
            if (typeof redrawIfBothReady === 'function') {
              setTimeout(() => { redrawIfBothReady(); }, 0);
            }
          } else if (tries < 20) {
            setTimeout(() => tryAttach(tries + 1), 100);
          } else {
            window.proDebugLog('[PRO][content] ERROR: observeSubregionBtn not available after waiting. Global keys:', Object.keys(window));
          }
        };
        tryAttach();
      }
    }
  }, 500);
  // Attach observer to parent of subregion button
  // const zoomDiv = lastBtn ? lastBtn.closest('div[class$="_modelZoom"]') : document.querySelector('div[class$="_modelZoom"]');
  const zoomDiv = lastBtn.closest('div[class$="_toolbarSectionInner"]');
  console.log(zoomDiv);
  if (zoomDiv) {
    if (window.zoomParentObserver) window.zoomParentObserver.disconnect();
    window.zoomParentObserver = new MutationObserver(() => {
      console.log('[PRO][content] Replacement callback fired');
      // Button may have been replaced, re-attach attribute observer
      const newBtn = zoomDiv.querySelector('button[aria-label^="Zoom: "]');
      if (newBtn) {
        window.proDebugLog('[PRO][content] Attaching subregion observer to button with aria-label:', newBtn.getAttribute('aria-label'));
        console.log('[PRO][content.js] Calling observeSubregionBtn with:', newBtn, 'aria-label:', newBtn.getAttribute('aria-label'));
        window.observeSubregionBtn(newBtn, redrawIfBothReady, hideAndClear);
      }
    });
    window.zoomParentObserver.observe(zoomDiv, { childList: true, subtree: true });
  }
}

// Delay initial observer attachment and redraw until overlay is ready
window.addEventListener('PRO_INJECTED_READY', () => {
  attachObservers();
  // Optionally trigger initial redraw after overlay is ready
  setTimeout(() => { redrawIfBothReady(); }, 0);
});

  // === DOM Observation & Event Handling ===

// === DOM Observation Helpers ===
// Use global observeImage from observers.js via window.observeImage
  // Helper: update sidebar input for map area
  function updateSidebarInput(mapArea) {
    const mapAreaInput = document.getElementById('pro-map-area');
    if (mapAreaInput) mapAreaInput.value = mapArea;
  }

(async ()=>{
  // define once
  if(!window.PRO_saveLastRoute){
    window.PRO_saveLastRoute = async function(route, color, width){ try{ sessionStorage.setItem('PRO_LAST_ROUTE_FALLBACK', JSON.stringify({route,color,width,t:Date.now()})); }catch(_){}
      try{ await chrome.runtime.sendMessage({cmd:'PRO_SAVE_LAST_ROUTE', data:{route, color, width, t: Date.now()}}); }catch(_){}
    };
    window.PRO_loadLastRoute = async function(){ let fb=null; try{ const r=sessionStorage.getItem('PRO_LAST_ROUTE_FALLBACK'); if(r) fb=JSON.parse(r);}catch(_){}
      try{ const r = await chrome.runtime.sendMessage({cmd:'PRO_LOAD_LAST_ROUTE'}); const data=(r&&r.data)||fb||null; console.log('[PRO][content] loadLastRoute ->', data); return data; }catch(e){ console.warn('[PRO][content] loadLastRoute err', e); return fb; }
    };
    window.PRO_clearLastRoute = async function(){ try{ await chrome.runtime.sendMessage({cmd:'PRO_CLEAR_LAST_ROUTE'}); }catch(e){ console.warn('[PRO][content] clearLastRoute err', e);} try{ sessionStorage.removeItem('PRO_LAST_ROUTE_FALLBACK'); }catch(_){}};
  }
  // back-compat shims for older call sites
  if(typeof window.loadLastRoute!=='function'){ window.loadLastRoute = window.PRO_loadLastRoute; }
  if(typeof window.saveLastRoute!=='function'){ window.saveLastRoute = window.PRO_saveLastRoute; }
  if(typeof window.clearLastRoute!=='function'){ window.clearLastRoute = window.PRO_clearLastRoute; }

  // Listen for injected ACKs and persist on success (belt & suspenders)
  window.addEventListener('message', async (ev)=>{
    try{
      const d = ev && ev.data;
      if(!d || d.type!=='PRO_DRAW_ACK') return;
      console.log('[PRO][content] ACK (message)', d);
      if(d.ok){
        const pRoute = (document.getElementById('pro-route')||{}).value||'';
        const pColor = (document.getElementById('pro-color')||{}).value||'#ff0000';
        const pWidth = parseInt((document.getElementById('pro-width')||{}).value||'3',10);
        try{ const _route=(document.getElementById('pro-route')||{}).value||''; const _color=(document.getElementById('pro-color')||{}).value||'#ff0000'; const _width=parseInt((document.getElementById('pro-width')||{}).value||'3',10); window.__PRO_LAST_ROUTE = {route: routeStr, color: color||'#ff0000', width: width||3, t: Date.now()};
    saveLastRoute(_route,_color,_width); console.log('[PRO][content] saveLastRoute OK (ACK)'); }catch(e){ console.warn('[PRO][content] save (ACK) err', e); }
      }
    }catch(e){ /* noop */ }
  }, false);
})();

// content.js — PRO v5.8.3
(function(){
  // Debug log function
  function debugLog(...args) { if (debugEnabled) console.log(...args); }
  const log=(...a)=>debugLog('[PRO][content]',...a);
  // Dynamically import version after dialog creation
  const logVersionToStatus = async () => {
    let proVersion = 'unknown';
    try {
      const vmod = await import(chrome.runtime.getURL('version.js'));
      proVersion = vmod.PRO_VERSION;
    } catch (e) { debugLog('Failed to load version.js:', e); }
    // Update toolbar title with version
    const titleEl = document.getElementById('pro-overlay-title');
    if (titleEl) titleEl.textContent = `PRO v${proVersion}`;
  };

  const s=document.createElement('script'); 
  s.src=chrome.runtime.getURL('injected.js'); 
  (document.head||document.documentElement).appendChild(s); s.onload=()=>s.remove();

  const box=document.createElement('div');
  box.id='pro-overlay-ui';
  box.style.cssText='position:fixed;top:10px;right:10px;z-index:2147483000;background:#0b0b0c;color:#e6e6e6;padding:12px;border-radius:10px;box-shadow:0 8px 22px rgba(0,0,0,.45);width:330px;font:13px/1.45 system-ui,Segoe UI,Roboto,Arial;user-select:none;';
  // Restore sidebar location from sessionStorage if present
  try {
    const pos = sessionStorage.getItem('PRO_SIDEBAR_POS');
    if (pos) {
      const {left, top} = JSON.parse(pos);
      box.style.left = left + 'px';
      box.style.top = top + 'px';
      box.style.right = '';
    }
  } catch(_){}
  // Detect map area/subregion name for both classic and beta UI
  let mapArea = '';
  // Classic UI
  const zoomMenu = document.getElementById('zoom_menu_link');
  if (zoomMenu && zoomMenu.textContent) {
    mapArea = zoomMenu.textContent.trim();
  }
  // Beta UI: look for button with aria-label starting with "Zoom: " inside a div with class ending _modelZoom
  if (!mapArea) {
    const modelZoomDiv = Array.from(document.querySelectorAll('div[class$="_modelZoom"]')).find(div => div.querySelector('button[aria-label^="Zoom: "]'));
    if (modelZoomDiv) {
      const btn = modelZoomDiv.querySelector('button[aria-label^="Zoom: "]');
      if (btn && btn.getAttribute('aria-label')) {
        // aria-label is like "Zoom: Southwest US"
        const label = btn.getAttribute('aria-label');
        const match = label.match(/Zoom: (.+)$/);
        if (match) mapArea = match[1].trim();
      }
    }
  }

  box.innerHTML=''
  +'<div id="pro-overlay-header" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:move;-webkit-app-region:drag;">'
  +  '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#000;border:1px solid #bbb"></span>'
  +  '<a href="https://tbm-ppp.org" target="_blank" rel="noopener" style="font-size:14px;text-decoration:underline;color:#6ec6ff;font-weight:bold;margin-right:6px;">TBM-PPP</a>'
  +  '<b id="pro-overlay-title" style="font-size:14px">PRO Overlay</b>'
  +  '<label style="margin-left:auto;display:flex;align-items:center;gap:4px;font-size:12px;user-select:none;">'
  +    '<input type="checkbox" id="pro-debug" style="margin:0;"> Debug'
  +  '</label>'
  +'</div>'
  +'<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;gap:10px;margin-bottom:10px;padding:0 8px;">'
  +  '<div style="min-width:0;grid-column:1;grid-row:1">'
  +    '<label style="display:block;margin-bottom:4px">Map Area</label>'
  +    `<input id="pro-map-area" value="${mapArea}" readonly style="width:100%;box-sizing:border-box;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#222;color:#fff;font-weight:600">`
  +  '</div>'
  +  '<div style="min-width:0;grid-column:2;grid-row:1">'
  +    '<label style="display:block;margin-bottom:4px">FAA Cycle</label>'
  +    `<input id="pro-cycle" value="unknown" readonly style="width:100%;box-sizing:border-box;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#222;color:#6ec672;font-weight:600">`
  +  '</div>'
  +  '<div style="min-width:0;grid-column:1;grid-row:2">'
  +    '<label style="display:block;margin-bottom:4px">Airspeed (knots)</label>'
  +    '<input id="pro-airspeed" type="number" min="1" max="999" value="310" style="width:100%;box-sizing:border-box;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#222;color:#fff;font-weight:600">'
  +  '</div>'
  +  '<div style="min-width:0;grid-column:2;grid-row:2">'
  +    '<div style="display:flex;gap:10px">'
  +      '<div style="flex:1;min-width:0">'
  +        '<label style="display:block;margin-bottom:4px">Width</label>'
  +        '<input id="pro-width" type="number" min="1" max="12" value="3" style="width:100%;box-sizing:border-box;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#111;color:#fff">'
  +      '</div>'
  +      '<div style="flex:1;min-width:0">'
  +        '<label style="display:block;margin-bottom:4px">Color</label>'
  +        '<input id="pro-color" type="color" value="#ff0000" style="width:100%;height:36px;box-sizing:border-box;padding:0;border-radius:7px;border:1px solid #333;background:#111;color:#fff">'
  +      '</div>'
  +    '</div>'
  +  '</div>'
  +'</div>'
  +'<div style="display:grid;gap:10px">'
  +  '<div style="padding:0 8px;"><label style="display:block;margin-bottom:4px">Route</label><input id="pro-route" placeholder="KHWD KDVT" style="width:100%;box-sizing:border-box;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#111;color:#fff"></div>'
  +  '<div style="display:flex;gap:10px;margin-bottom:10px;padding:0 8px;">'
  +    '<button id="pro-draw" disabled style="flex:1;padding:9px 12px;background:#2ecc71;border:0;color:#000;font-weight:700;border-radius:7px;cursor:pointer;opacity:0.6">Parse & Draw</button>'
  +    '<button id="pro-clear" style="flex:1;padding:9px 12px;background:#444;border:0;color:#fff;border-radius:7px;cursor:pointer">Clear</button>'
  +  '</div>'
  +  '<pre id="pro-log" style="white-space:pre-wrap;background:#0a0a0a;padding:8px;border-radius:7px;border:1px solid #222;max-height:220px;overflow:auto;margin:0"></pre>'
  +'</div>';
  document.body.appendChild(box);
  // Set Map Area input value after UI is rendered, with polling for late-available map area
  if (window.updateSidebarInput && window.detectMapArea) {
    let tries = 0;
    const maxTries = 20;
    const pollMapArea = () => {
      const area = window.detectMapArea();
      if (area && area.trim()) {
        window.updateSidebarInput(area);
      } else if (++tries < maxTries) {
        setTimeout(pollMapArea, 150);
      }
    };
    pollMapArea();
  }
  // Restore airspeed from sessionStorage if present
  try {
    const savedAirspeed = sessionStorage.getItem('PRO_AIRSPEED');
    if (savedAirspeed) {
      const airspeedInput = document.getElementById('pro-airspeed');
      if (airspeedInput) airspeedInput.value = savedAirspeed;
    }
  } catch(_){}
  // Persist airspeed on change
  const airspeedInput = document.getElementById('pro-airspeed');
  if (airspeedInput) {
    airspeedInput.addEventListener('input', function() {
      sessionStorage.setItem('PRO_AIRSPEED', airspeedInput.value);
    });
  }
  // On load, set FAA Cycle control from PRO_META if available
  chrome.storage.local.get(['PRO_META'], (res) => {
    const cycleInput = document.getElementById('pro-cycle');
    if (cycleInput && res.PRO_META && res.PRO_META.cycleDate) {
      const cycleDateStr = res.PRO_META.cycleDate;
      if (res.PRO_META.cycleKey) {
        cycleInput.value = `✅ ${cycleDateStr}`;
      } else {
        cycleInput.value = cycleDateStr;
      }
    }
  });
  document.body.appendChild(box);
  // Drag logic for panel (must be after box.innerHTML)
  (function(){
    const header = box.querySelector('#pro-overlay-header');
    let isDragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    header.addEventListener('mousedown', function(e){
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = box.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', function(e){
      if(!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      box.style.left = (startLeft + dx) + 'px';
      box.style.top = (startTop + dy) + 'px';
      box.style.right = '';
      // Persist position in sessionStorage
      sessionStorage.setItem('PRO_SIDEBAR_POS', JSON.stringify({left: startLeft + dx, top: startTop + dy}));
    });
    window.addEventListener('mouseup', function(){
      if(isDragging){
        isDragging = false;
        document.body.style.userSelect = '';
      }
    });
  })();

  // Now log the version to the status area

  // Reference to draw button
  const drawBtn = box.querySelector('#pro-draw');
  // Disable draw button if not on model.php page
  if (!/^https?:\/\/www\.pivotalweather\.com\/model\.php/.test(window.location.href)) {
    drawBtn.disabled = true;
    drawBtn.style.opacity = '0.6';
  }
  // Attach click handler to Parse & Draw button
  if (drawBtn) {
    drawBtn.addEventListener('click', () => {
      const routeStr = (document.getElementById('pro-route') || {}).value || '';
      const color = (document.getElementById('pro-color') || {}).value || '#ff0000';
      const width = parseInt((document.getElementById('pro-width') || {}).value || '3', 10);
      // Parse and send to overlay
      window.drawRouteFromString(routeStr, color, width);
      // Persist route immediately after drawing
      if (typeof window.saveLastRoute === 'function') {
        window.saveLastRoute(routeStr, color, width);
        if (typeof debugLog === 'function') debugLog('Parse & Draw: Route persisted to sessionStorage');
      } else {
        if (typeof debugLog === 'function') debugLog('Parse & Draw: saveLastRoute not available');
      }
    });
  }
  logVersionToStatus();

  // Attach click handler to Clear button
const clearBtn = box.querySelector('#pro-clear');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('PRO_CLEAR_ROUTE'));
  });
}

  const logEl=box.querySelector('#pro-log');
  // Debug checkbox logic
  const debugCheckbox = box.querySelector('#pro-debug');
  let debugEnabled = false;
  // Load debug state from storage
  chrome.storage.local.get(['PRO_DEBUG'], (res) => {
  debugEnabled = !!res.PRO_DEBUG;
  debugCheckbox.checked = debugEnabled;
  window.PRO_DEBUG = debugEnabled;
  window.dispatchEvent(new CustomEvent('PRO_DEBUG_CHANGED', { detail: { enabled: debugEnabled } }));
  });
  debugCheckbox.addEventListener('change', () => {
  debugEnabled = debugCheckbox.checked;
  window.PRO_DEBUG = debugEnabled;
  // Dispatch event on window for injected.js
  window.dispatchEvent(new CustomEvent('PRO_DEBUG_CHANGED', { detail: { enabled: debugEnabled } }));
  chrome.storage.local.set({ PRO_DEBUG: debugEnabled });
  });
  // Only log if debug is enabled
  const setStatus = t => {
    if (debugEnabled) {
      logEl.textContent += t + '\n';
      logEl.scrollTop = logEl.scrollHeight;
    }
  };

  const port=chrome.runtime.connect({name:'PRO_FAA_DIRECT'});
    port.onMessage.addListener(m=>{
      if(m && m.phase === 'nasr_status') {
        // Display extension version and NASR data date
        const cycleDateStr = m.cycleKey ? m.cycleKey : '';
        window.PRO_NASR_DATE = cycleDateStr;
        const cycleInput = document.getElementById('pro-cycle');
        if (cycleInput) {
          if (m.cycleKey && m.fetchedAt) {
            cycleInput.value = `✅ ${cycleDateStr}`;
          } else if (m.cycleKey) {
            cycleInput.value = cycleDateStr;
          } else {
            cycleInput.value = 'Updating...';
          }
        }
        setStatus(`PRO v${m.version} | NASR cycle: ${m.cycleKey || 'unknown'} | Data date: ${cycleDateStr || 'Updating...'}`);
        // Enable draw button if NASR is ready (cycleKey and fetchedAt present)
        if (m.cycleKey && m.fetchedAt && drawBtn) { drawBtn.disabled = false; drawBtn.style.opacity = ''; }
      } else if(m && m.phase) {
        // If phase indicates start of update, show 'Updating...' in cycle control
        const cycleInput = document.getElementById('pro-cycle');
        if (m.phase === 'start' || m.phase === 'apt_start' || m.phase === 'nav_start' || m.phase === 'fix_start') {
          if (cycleInput) cycleInput.value = 'Updating...';
        }
        // If phase is 'done', update cycle control with latest date
        if (m.phase === 'done') {
          chrome.storage.local.get(['PRO_META'], (res) => {
            if (cycleInput && res.PRO_META && res.PRO_META.cycleDate) {
              const cycleDateStr = res.PRO_META.cycleDate;
              if (res.PRO_META.cycleKey) {
                cycleInput.value = `✅ ${cycleDateStr}`;
              } else {
                cycleInput.value = cycleDateStr;
              }
            }
          });
        }
        // If phase is 'error', show red X and !Failed! in cycle control
        if (m.phase === 'error') {
          if (cycleInput) cycleInput.value = '❌ !Failed!';
        }
        setStatus(m.phase);
      }
    });
  log('Connected to background');

  // Cold-start hydration: show cache status and avoid unnecessary fetches
  (async () => {
    try {
      const {PRO_META, PRO_AIRPORT_INDEX, PRO_NAV_INDEX, PRO_FIX_INDEX} = await chrome.storage.local.get(['PRO_META','PRO_AIRPORT_INDEX','PRO_NAV_INDEX','PRO_FIX_INDEX']);
      if (PRO_META && PRO_AIRPORT_INDEX && Object.keys(PRO_AIRPORT_INDEX).length) {
        setStatus(`Cache: cycle ${PRO_META.cycleKey} | APT ${Object.keys(PRO_AIRPORT_INDEX).length} | NAV ${Object.keys(PRO_NAV_INDEX||{}).length} | FIX ${Object.keys(PRO_FIX_INDEX||{}).length}`);
        if(drawBtn) { drawBtn.disabled = false; drawBtn.style.opacity = ''; }
      } else {
        setStatus('Cache: empty. Fetching NASR datasets...');
        if(drawBtn) { drawBtn.disabled = true; drawBtn.style.opacity = '0.6'; }
        try {
          port.postMessage({cmd:'FETCH_CURRENT_CYCLE'});
        } catch(e) {
          setStatus('Error requesting NASR fetch: ' + (e.message||e));
        }
      }
    } catch (e) {
      setStatus('Cache check failed: ' + (e.message||e));
      if(drawBtn) { drawBtn.disabled = true; drawBtn.style.opacity = '0.6'; }
    }
  
  // Auto-redraw persisted route on reload (after DOM & indices ready)
  (async () => {
      if (/^https?:\/\/www\.pivotalweather\.com\/model\.php/.test(window.location.href)) {
        const cached = await loadLastRoute(); console.log('[PRO][content] auto-redraw cached =', cached);
    if(!cached) return;
    const setInput = (id,val) => { const el = document.getElementById(id); if(el) el.value = val; };
    setInput('pro-route', cached.route);
    setInput('pro-color', cached.color || '#ff0000');
    setInput('pro-width', String(cached.width || 3));
    try {
      // Wait for indices and map image to be present
      const waitFor = async (fn, tries=40, delay=125) => { for(let i=0;i<tries;i++){ const v=await fn(); if(v) return v; await new Promise(r=>setTimeout(r,delay)); } return null; };
      console.log('[PRO][content] waiting indices/map for restore…');
      const okIdx = await waitFor(async()=>{
        try {
          const st = await chrome.storage.local.get(['PRO_AIRPORT_INDEX','PRO_NAV_INDEX','PRO_FIX_INDEX']);
          return st && st.PRO_AIRPORT_INDEX && Object.keys(st.PRO_AIRPORT_INDEX).length>0;
        } catch(_) { return false; }
      });
      const okImg = await waitFor(async()=> document.getElementById('display_image'));
      if(!okIdx || !okImg){ setStatus('Ready, but route redraw waiting for map/indices…'); return; }
      setStatus('Parsing route…'); 
      console.log('[PRO][content] restoring route now ->', cached);
      // Use latest mapAreaValue for redraw
      const mapAreaInput = document.getElementById('pro-map-area');
      let mapAreaValue = mapAreaInput ? mapAreaInput.value : '';
      const parsed = await window.parseRoute(cached.route);
      if (!parsed.error) {
  window.drawRoute(parsed, { color: cached.color||'#ff0000', width: cached.width||3, mapAreaValue });
      }
    } catch(e){ console.warn('[PRO][content] restore failed', e); if (typeof setStatus==='function') setStatus('Route restore failed: '+(e.message||e)); }
        }
  
  // Listen for injected ACKs and persist on success (belt & suspenders)
  window.addEventListener('message', async (ev)=>{
    try{
      const d = ev && ev.data;
      if(!d || d.type!=='PRO_DRAW_ACK') return;
      console.log('[PRO][content] ACK (message)', d);
      if(d.ok){
        const pRoute = (document.getElementById('pro-route')||{}).value||'';
        const pColor = (document.getElementById('pro-color')||{}).value||'#ff0000';
        const pWidth = parseInt((document.getElementById('pro-width')||{}).value||'3',10);
        try{ const _route=(document.getElementById('pro-route')||{}).value||''; const _color=(document.getElementById('pro-color')||{}).value||'#ff0000'; const _width=parseInt((document.getElementById('pro-width')||{}).value||'3',10); window.__PRO_LAST_ROUTE = {route: routeStr, color: color||'#ff0000', width: width||3, t: Date.now()};
    saveLastRoute(_route,_color,_width); console.log('[PRO][content] saveLastRoute OK (ACK)'); }catch(e){ console.warn('[PRO][content] save (ACK) err', e); }
      }
    }catch(e){ /* noop */ }
  }, false);
})();


  // Listen for injected ACKs and persist on success (belt & suspenders)
  window.addEventListener('message', async (ev)=>{
    try{
      const d = ev && ev.data;
      if(!d || d.type!=='PRO_DRAW_ACK') return;
      console.log('[PRO][content] ACK (message)', d);
      if(d.ok){
        const pRoute = (document.getElementById('pro-route')||{}).value||'';
        const pColor = (document.getElementById('pro-color')||{}).value||'#ff0000';
        const pWidth = parseInt((document.getElementById('pro-width')||{}).value||'3',10);
        try{ const _route=(document.getElementById('pro-route')||{}).value||''; const _color=(document.getElementById('pro-color')||{}).value||'#ff0000'; const _width=parseInt((document.getElementById('pro-width')||{}).value||'3',10); window.__PRO_LAST_ROUTE = {route: routeStr, color: color||'#ff0000', width: width||3, t: Date.now()};
    saveLastRoute(_route,_color,_width); console.log('[PRO][content] saveLastRoute OK (ACK)'); }catch(e){ console.warn('[PRO][content] save (ACK) err', e); }
      }
    }catch(e){ /* noop */ }
  }, false);
})();



// Auto-restore listener to avoid timeouts
window.addEventListener('PRO_INJECTED_READY', async ()=>{
  try{
    const last = await loadLastRoute();
    if (last && last.route) {
      // Ensure sidebar input is set to detected map area before drawing
      const mapAreaInput = document.getElementById('pro-map-area');
      const detectedArea = detectMapArea();
      if (mapAreaInput && mapAreaInput.value !== detectedArea) {
        mapAreaInput.value = detectedArea;
        mapAreaInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // Set route/color/width inputs to restored values
      const routeInput = document.getElementById('pro-route');
      const colorInput = document.getElementById('pro-color');
      const widthInput = document.getElementById('pro-width');
      if (routeInput) routeInput.value = last.route || '';
      if (colorInput) colorInput.value = last.color || '#ff0000';
      if (widthInput) widthInput.value = String(last.width || 3);
      // Now draw the route
      window.drawRouteFromString(last.route, last.color, last.width, 'restore');
      // Persist the restored route so it is not lost on next reload
      if (typeof saveLastRoute === 'function') {
        saveLastRoute(last.route, last.color, last.width);
      }
      // Immediately trigger a redraw to ensure observers use the correct route
      if (typeof redrawIfBothReady === 'function') {
        setTimeout(() => { redrawIfBothReady(); }, 0);
      }
    }
  }catch(e){ console.warn('[PRO][content] restore-on-ready failed', e); }
});
})();
// Close the async IIFE


