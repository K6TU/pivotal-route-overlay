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
    log(`Sidebar injected (v${proVersion})`);
    const logEl = document.getElementById('pro-log');
    if (logEl) {
      logEl.textContent += `PRO version: v${proVersion}\n`;
      logEl.scrollTop = logEl.scrollHeight;
    }
  };

  const s=document.createElement('script'); s.src=chrome.runtime.getURL('injected.js'); (document.head||document.documentElement).appendChild(s); s.onload=()=>s.remove();

  const box=document.createElement('div');
  box.id='pro-overlay-ui';
  box.style.cssText='position:fixed;top:10px;right:10px;z-index:2147483000;background:#0b0b0c;color:#e6e6e6;padding:12px;border-radius:10px;box-shadow:0 8px 22px rgba(0,0,0,.45);width:330px;font:13px/1.45 system-ui,Segoe UI,Roboto,Arial';
  box.innerHTML=''
   +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
   +  '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#000;border:1px solid #bbb"></span>'
   +  '<b style="font-size:14px">PRO Overlay</b>'
   +'</div>'
   +'<div style="display:grid;gap:10px">'
   +  '<div><label style="display:block;margin-bottom:4px">Route</label><input id="pro-route" placeholder="KHWD KDVT" style="width:100%;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#111;color:#fff"></div>'
   +  '<div style="display:flex;gap:10px;"><div style="flex:1"><label style="display:block;margin-bottom:4px">Width</label><input id="pro-width" type="number" min="1" max="12" value="3" style="width:100%;padding:7px 8px;border-radius:7px;border:1px solid #333;background:#111;color:#fff"></div>'
   +  '<div style="flex:1"><label style="display:block;margin-bottom:4px">Color</label><input id="pro-color" type="color" value="#ff0000" style="width:100%;height:36px;padding:0;border-radius:7px;border:1px solid #333;background:#111;color:#fff"></div></div>'
   +  '<div style="display:flex;gap:10px;"><button id="pro-draw" style="flex:1;padding:9px 12px;background:#2ecc71;border:0;color:#000;font-weight:700;border-radius:7px;cursor:pointer">Parse & Draw</button>'
   +  '<button id="pro-clear" style="flex:1;padding:9px 12px;background:#444;border:0;color:#fff;border-radius:7px;cursor:pointer">Clear</button></div>'
   +  '<pre id="pro-log" style="white-space:pre-wrap;background:#0a0a0a;padding:8px;border-radius:7px;border:1px solid #222;max-height:220px;overflow:auto;margin:0"></pre>'
   +'</div>';
  document.body.appendChild(box);

  // Now log the version to the status area
  logVersionToStatus();

  const logEl=box.querySelector('#pro-log');
  const setStatus=t=>{ logEl.textContent+=t+'\n'; logEl.scrollTop=logEl.scrollHeight; };

  const port=chrome.runtime.connect({name:'PRO_FAA_DIRECT'});
    port.onMessage.addListener(m=>{
      if(m && m.phase === 'nasr_status') {
        // Display extension version and NASR data date
        const dateStr = m.fetchedAt ? (new Date(m.fetchedAt)).toLocaleDateString() : 'unknown';
        setStatus(`PRO v${m.version} | NASR cycle: ${m.cycleKey || 'unknown'} | Data date: ${dateStr}`);
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
      } else {
        setStatus('Cache: empty. Fetching NASR datasets...');
        try {
          port.postMessage({cmd:'FETCH_CURRENT_CYCLE'});
        } catch(e) {
          setStatus('Error requesting NASR fetch: ' + (e.message||e));
        }
      }
    } catch (e) {
      setStatus('Cache check failed: ' + (e.message||e));
    }
  
  // Auto-redraw persisted route on reload (after DOM & indices ready)
  (async () => {
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

  function drawRoute(parsed,opts){
    const detail={ latlngs:parsed.latlngs, color:(opts&&opts.color)||'#ff0000', width:(opts&&opts.width)||3 };
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
