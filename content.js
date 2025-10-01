  // Map area boundaries lookup
  const MAP_AREAS = {
    'Continental US': { latMax: 59, latMin: 21, lonMin: -129, lonMax: -64.1 },
    'Northwest US': { latMax: 53, latMin: 40, lonMin: -133.11, lonMax: -110.9 },
    'Southwest US': { latMax: 43.25, latMin: 30.38, lonMin: -132.01, lonMax: -110 },
    'Northern Rockies': { latMax: 50, latMin: 39, lonMin: -119.8, lonMax: -110 },
    'Four Corners': { latMax: 42.25, latMin: 31.25, lonMin: -118.4, lonMax: -99.6 },
    'North Central US': { latMax: 51, latMin: 39.81, lonMin: -108.55, lonMax: -89.44 },
    'Central US': { latMax: 43.8, latMin: 32.3, lonMin: -108.64, lonMax: -89 },
    'South Central US': { latMax: 38.25, latMin: 25.75, lonMin: -108, lonMax: -86.6 },
    'Midwest US': { latMax: 47.5, latMin: 36.5, lonMin: -98.8, lonMax: -80 },
    'Ohio Valley': { latMax: 42.5, latMin: 31.5, lonMin: -96.7, lonMax: -77.9 },
    'Southeast US': { latMax: 36, latMin: 24.3, lonMin: -95, lonMax: -75 },
    'Northeast US': { latMax: 47.6, latMin: 37, lonMin: -84.92, lonMax: -66.8 },
    'Mid-Atlantic': { latMax: 43.5, latMin: 31.5, lonMin: -89.5, lonMax: -69 }
  };

async function waitFor(test, timeout=8000, step=50){const t0=Date.now();while(Date.now()-t0<timeout){try{if(await test())return true;}catch(e){}await new Promise(r=>setTimeout(r,step));}throw new Error('timeout');}
async function drawRouteFromString(routeStr, color, width, phase='manual'){
  try{
    console.log('[PRO][content] drawRouteFromString start(UI)',{phase,routeStr,color,width});
    if(typeof setStatus==='function') setStatus('Parsing route…');
    // Put values into sidebar inputs
    const routeEl = document.getElementById('pro-route');
    const colorEl = document.getElementById('pro-color');
    const widthEl = document.getElementById('pro-width');
    if(routeEl) routeEl.value = routeStr || (routeEl.value||'');
    if(colorEl && color) colorEl.value = color;
    if(widthEl && width) widthEl.value = String(width);
    // Click the existing button handler which is already known-good
    const btn = document.getElementById('pro-draw');
    if(!btn) throw new Error('draw button not ready');
    if(typeof setStatus==='function') setStatus(phase==='restore'?'Restoring route…':'Drawing…');
    btn.click();
    if(typeof setStatus==='function') setStatus(phase==='restore'?'Route restored.':'Route drawn.');
  }catch(e){
    console.warn('[PRO][content] drawRouteFromString(UI) failed', e);
    if(typeof setStatus==='function') setStatus((phase==='restore'?'Route restore failed: ':'Error: ') + (e.message||e));
    throw e;
  }
}
// [PRO] route persistence helpers (global) - 5.8.7
async function waitFor(test, timeout=5000, step=50){ const t0=Date.now(); while(Date.now()-t0<timeout){ try{ if(await test()) return true; }catch(_){} await new Promise(r=>setTimeout(r,step)); } throw new Error('timeout'); }
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
  const log=(...a)=>console.log('[PRO][content]',...a);
  // Dynamically import version after dialog creation
  const logVersionToStatus = async () => {
    let proVersion = 'unknown';
    try {
      const vmod = await import(chrome.runtime.getURL('version.js'));
      proVersion = vmod.PRO_VERSION;
    } catch (e) { log('Failed to load version.js:', e); }
    // Update toolbar title with version
    const titleEl = document.getElementById('pro-overlay-title');
    if (titleEl) titleEl.textContent = `PRO Overlay v${proVersion}`;
  };

  const s=document.createElement('script'); s.src=chrome.runtime.getURL('injected.js'); (document.head||document.documentElement).appendChild(s); s.onload=()=>s.remove();

  const box=document.createElement('div');
  box.id='pro-overlay-ui';
  box.style.cssText='position:fixed;top:10px;right:10px;z-index:2147483000;background:#0b0b0c;color:#e6e6e6;padding:12px;border-radius:10px;box-shadow:0 8px 22px rgba(0,0,0,.45);width:330px;font:13px/1.45 system-ui,Segoe UI,Roboto,Arial;user-select:none;';
  // Extract map area text from #zoom_menu_link
  let mapArea = '';
  const zoomMenu = document.getElementById('zoom_menu_link');
  if (zoomMenu && zoomMenu.textContent) {
    mapArea = zoomMenu.textContent.trim();
  }

  box.innerHTML=''
  +'<div id="pro-overlay-header" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;cursor:move;-webkit-app-region:drag;">'
  +  '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#000;border:1px solid #bbb"></span>'
  +  '<b id="pro-overlay-title" style="font-size:14px">PRO Overlay</b>'
  +  '<label style="margin-left:auto;display:flex;align-items:center;gap:4px;font-size:12px;user-select:none;">'
  +    '<input type="checkbox" id="pro-debug" style="margin:0;"> Debug'
  +  '</label>'
  +'</div>'
   +'<div style="margin-bottom:10px;">'
   +  '<label style="display:block;margin-bottom:4px">Map Area</label>'
   +  `<input id="pro-map-area" value="${mapArea}" readonly style="width:100%;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#222;color:#fff;font-weight:600">`
   +'</div>'
   +'<div style="margin-bottom:10px;">'
   +  '<label style="display:block;margin-bottom:4px">Airspeed (knots)</label>'
   +  '<input id="pro-airspeed" type="number" min="1" max="999" value="310" style="width:100%;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#222;color:#fff;font-weight:600">'
   +'</div>'
   +'<div style="display:grid;gap:10px">'
   +  '<div><label style="display:block;margin-bottom:4px">Route</label><input id="pro-route" placeholder="KHWD KDVT" style="width:100%;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#111;color:#fff"></div>'
   +  '<div style="display:flex;gap:10px;"><div style="flex:1"><label style="display:block;margin-bottom:4px">Width</label><input id="pro-width" type="number" min="1" max="12" value="3" style="width:100%;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#111;color:#fff"></div>'
   +  '<div style="flex:1"><label style="display:block;margin-bottom:4px">Color</label><input id="pro-color" type="color" value="#ff0000" style="width:100%;height:36px;padding:0;border-radius:7px;border:1px solid #333;background:#111;color:#fff"></div></div>'
  +  '<div style="display:flex;gap:10px;"><button id="pro-draw" disabled style="flex:1;padding:9px 12px;background:#2ecc71;border:0;color:#000;font-weight:700;border-radius:7px;cursor:pointer;opacity:0.6">Parse & Draw</button>'
   +  '<button id="pro-clear" style="flex:1;padding:9px 12px;background:#444;border:0;color:#fff;border-radius:7px;cursor:pointer">Clear</button></div>'
   +  '<pre id="pro-log" style="white-space:pre-wrap;background:#0a0a0a;padding:8px;border-radius:7px;border:1px solid #222;max-height:220px;overflow:auto;margin:0"></pre>'
   +'</div>';
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
  logVersionToStatus();

  const logEl=box.querySelector('#pro-log');
  // Debug checkbox logic
  const debugCheckbox = box.querySelector('#pro-debug');
  let debugEnabled = false;
  // Load debug state from storage
  chrome.storage.local.get(['PRO_DEBUG'], (res) => {
    debugEnabled = !!res.PRO_DEBUG;
    debugCheckbox.checked = debugEnabled;
  });
  debugCheckbox.addEventListener('change', () => {
    debugEnabled = debugCheckbox.checked;
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
        const dateStr = m.fetchedAt ? (new Date(m.fetchedAt)).toLocaleDateString() : 'unknown';
        setStatus(`PRO v${m.version} | NASR cycle: ${m.cycleKey || 'unknown'} | Data date: ${dateStr}`);
        // Enable draw button if NASR is ready (cycleKey and fetchedAt present)
        if (m.cycleKey && m.fetchedAt && drawBtn) { drawBtn.disabled = false; drawBtn.style.opacity = ''; }
      } else if(m && m.phase) {
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
      await drawRouteFromString(cached.route, cached.color||'#ff0000', cached.width||3, 'restore');
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


  async function getIndexes(){
    const o=await chrome.storage.local.get(['PRO_AIRPORT_INDEX','PRO_NAV_INDEX','PRO_FIX_INDEX']);
    return {airports:o.PRO_AIRPORT_INDEX||{}, navaids:o.PRO_NAV_INDEX||{}, fixes:o.PRO_FIX_INDEX||{}};
  }
  const BOUNDS={ latMax:59, latMin:21, lonMin:-129, lonMax:-64 };
  function interp(A,B,n){ const out=[]; for(let i=0;i<n;i++){ const t=i/(n-1); out.push([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]); } return out; }

  async function parseRoute(str){
    if(!str||!str.trim()) throw new Error('Enter a route first');
    const toks=str.trim().toUpperCase().split(/\s+/);
    const {airports,navaids,fixes}=await getIndexes();
    function findAirport(tok){
      if(/^[A-Z]{4}$/.test(tok)){
        const a=airports[tok]; if(a) return [a.lat,a.lon,tok];
      }
      const a=airports['A/'+tok]; if(a) return [a.lat,a.lon,tok];
      throw new Error('Unknown airport '+tok);
    }
    function findFix(tok){ const f=fixes[tok]; if(f) return [f.lat,f.lon,tok]; return null; }
    function findVOR(tok){ const v=navaids[tok]; if(v) return [v.lat,v.lon,tok]; return null; }

    const points=[];
    for(const tok of toks){
      let p=null;
      if(/^[A-Z]{4}$/.test(tok) || /^A\/[A-Z0-9]{3,4}$/.test(tok)){ try{ p=findAirport(tok); }catch(e){ p=null; } }
      if(!p && /^[A-Z]{5}$/.test(tok)) p=findFix(tok);
      if(!p && /^[A-Z]{3}$/.test(tok)) p=findVOR(tok);
      if(!p && /^[A-Z0-9]{3,4}$/.test(tok)) { const a=airports['A/'+tok]; if(a) p=[a.lat,a.lon,tok]; }
      if(p) points.push(p);
    }
    if(points.length<2) throw new Error('Could not resolve enough waypoints.');
    const latlngs=[];
    for(let i=0;i<points.length-1;i++){
      latlngs.push(...interp([points[i][0],points[i][1]],[points[i+1][0],points[i+1][1]], 25));
    }
    const wps=points.map(p=>({id:p[2], lat:p[0], lon:p[1]}));
    return { waypoints:wps, latlngs };
  }

  // Cohen–Sutherland clipping codes
  function getClipCode(lat, lon, bounds) {
    let code = 0;
    if (lat > bounds.latMax) code |= 1; // above
    if (lat < bounds.latMin) code |= 2; // below
    if (lon < bounds.lonMin) code |= 4; // left
    if (lon > bounds.lonMax) code |= 8; // right
    return code;
  }

  // Clip a line segment to bounds, returns [p1, p2] or null if not visible
  function clipSegment(p1, p2, bounds) {
    let [lat1, lon1] = p1;
    let [lat2, lon2] = p2;
    let code1 = getClipCode(lat1, lon1, bounds);
    let code2 = getClipCode(lat2, lon2, bounds);
    while (true) {
      if (!(code1 | code2)) {
        return [[lat1, lon1], [lat2, lon2]]; // both inside
      } else if (code1 & code2) {
        return null; // both outside, same region
      } else {
        let codeOut = code1 ? code1 : code2;
        let lat, lon;
        if (codeOut & 1) { // above
          lat = bounds.latMax;
          lon = lon1 + (lon2 - lon1) * (bounds.latMax - lat1) / (lat2 - lat1);
        } else if (codeOut & 2) { // below
          lat = bounds.latMin;
          lon = lon1 + (lon2 - lon1) * (bounds.latMin - lat1) / (lat2 - lat1);
        } else if (codeOut & 4) { // left
          lon = bounds.lonMin;
          lat = lat1 + (lat2 - lat1) * (bounds.lonMin - lon1) / (lon2 - lon1);
        } else if (codeOut & 8) { // right
          lon = bounds.lonMax;
          lat = lat1 + (lat2 - lat1) * (bounds.lonMax - lon1) / (lon2 - lon1);
        }
        if (codeOut === code1) {
          lat1 = lat; lon1 = lon; code1 = getClipCode(lat1, lon1, bounds);
        } else {
          lat2 = lat; lon2 = lon; code2 = getClipCode(lat2, lon2, bounds);
        }
      }
    }
  }

  // Helper: Haversine distance in NM
  function haversineNM(lat1, lon1, lat2, lon2) {
    const toRad = x => x * Math.PI / 180;
    const R = 3440.065; // nautical miles
    const dLat = toRad(lat2-lat1);
    const dLon = toRad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function drawRoute(parsed,opts){
    let mapAreaName = (document.getElementById('pro-map-area')||{}).value || 'Continental US';
    mapAreaName = mapAreaName.trim();
    console.log('[PRO][route] MAP_AREAS keys:', Object.keys(MAP_AREAS));
    if (!MAP_AREAS[mapAreaName]) {
      console.warn('[PRO][route] Map area name not found in MAP_AREAS:', mapAreaName, 'Using CONUS bounds.');
    } else {
      console.log('[PRO][route] Using map area:', mapAreaName);
    }
    const bounds = MAP_AREAS[mapAreaName] || MAP_AREAS['Continental US'];
    // Log map name and boundaries before clipping
    console.log(`[PRO][route] drawRoute: mapAreaName="${mapAreaName}", bounds= latMax=${bounds.latMax}, latMin=${bounds.latMin}, lonMin=${bounds.lonMin}, lonMax=${bounds.lonMax}`);
    // Clip each segment to bounds
    const clippedLatLngs = [];
    for (let i = 0; i < parsed.latlngs.length - 1; i++) {
      const seg = clipSegment(parsed.latlngs[i], parsed.latlngs[i+1], bounds);
      if (seg) {
        if (clippedLatLngs.length === 0 ||
            clippedLatLngs[clippedLatLngs.length-1][0] !== seg[0][0] ||
            clippedLatLngs[clippedLatLngs.length-1][1] !== seg[0][1]) {
          clippedLatLngs.push(seg[0]);
        }
        clippedLatLngs.push(seg[1]);
      }
    }

    // Calculate hour marks for triangles
    const airspeed = parseFloat(document.getElementById('pro-airspeed')?.value) || 310;
    const hourDist = airspeed; // nautical miles in one hour
    // Compute cumulative distances along the route
    let cumDist = 0, last = clippedLatLngs[0], marks = [], nextMark = hourDist;
    for (let i = 1; i < clippedLatLngs.length; i++) {
      const curr = clippedLatLngs[i];
      const segDist = haversineNM(last[0], last[1], curr[0], curr[1]);
      while (cumDist + segDist >= nextMark) {
        const frac = (nextMark - cumDist) / segDist;
        const lat = last[0] + frac * (curr[0] - last[0]);
        const lon = last[1] + frac * (curr[1] - last[1]);
        marks.push([lat, lon]);
        nextMark += hourDist;
      }
      cumDist += segDist;
      last = curr;
    }
    // Only draw triangles if at least one hour mark exists
    const detail={
      latlngs:clippedLatLngs,
      color:(opts&&opts.color)||'#ff0000',
      width:(opts&&opts.width)||3,
      bounds: bounds,
      triangles: marks
    };
    window.dispatchEvent(new CustomEvent('PRO_DRAW_ROUTE',{detail}));
  }
  function clear(){ window.dispatchEvent(new CustomEvent('PRO_CLEAR_ROUTE')); }

  box.querySelector('#pro-clear').onclick=()=>clear();
  box.querySelector('#pro-draw').onclick=async()=>{
    try{
      setStatus('Parsing route…');
      const routeStr=box.querySelector('#pro-route').value;
      const color=box.querySelector('#pro-color').value||'#ff0000';
      const width=parseInt(box.querySelector('#pro-width').value||'3',10);
      const parsed=await parseRoute(routeStr);
      const names=parsed.waypoints.map(w=>w.id).join(' → ');
      setStatus('Resolved: '+names);
      drawRoute(parsed,{color,width});
      setStatus('Sent draw ('+parsed.latlngs.length+' pts)');
      setStatus('Route drawn.');
      console.log('[PRO][content] calling saveLastRoute after draw');
      try{ const _route=(document.getElementById('pro-route')||{}).value||''; const _color=(document.getElementById('pro-color')||{}).value||'#ff0000'; const _width=parseInt((document.getElementById('pro-width')||{}).value||'3',10); window.__PRO_LAST_ROUTE = {route: routeStr, color: color||'#ff0000', width: width||3, t: Date.now()};
    saveLastRoute(_route,_color,_width); console.log('[PRO][content] saveLastRoute OK (post-draw)'); }catch(e){ console.warn('[PRO][content] saveLastRoute failed', e); }
    }catch(e){ setStatus('Error: '+(e.message||e)); }
  };

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
try{
  window.addEventListener('PRO_INJECTED_READY', async ()=>{
    try{
      const last = await loadLastRoute();
      if (last && last.route) {
        await drawRouteFromString(last.route, last.color, last.width, 'restore');
      }
    }catch(e){ console.warn('[PRO][content] restore-on-ready failed', e); }
  });
}catch(_){}
