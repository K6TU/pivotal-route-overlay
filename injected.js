
// --- Image readiness signal ---
(function(){
  // Listen for debug state changes from content.js
  window.addEventListener('PRO_DEBUG_CHANGED', function(ev) {
    window.PRO_DEBUG = !!(ev && ev.detail && ev.detail.enabled);
  });
  try{
    const emit = () => {
      const img = document.getElementById('display_image');
      const area = document.getElementById('click_map_area');
      if(img || area){
        let rect = null;
        try{
          if(area && area.coords){
            const [x1,y1,x2,y2] = area.coords.split(',').map(n=>parseInt(n,10));
            rect = {x:Math.min(x1,x2), y:Math.min(y1,y2), w:Math.abs(x2-x1), h:Math.abs(y2-y1)};
          }
        }catch(_){}
        window.dispatchEvent(new CustomEvent('PRO_IMAGE_READY', { detail: { rect } }));
        return true;
      }
      return false;
    };
    if(!emit()){
      const mo = new MutationObserver(()=>{ if(emit()){ try{ mo.disconnect(); }catch(_){}} });
      mo.observe(document.documentElement||document.body, {childList:true, subtree:true});
      setTimeout(()=>{ try{ mo.disconnect(); }catch(_){ } emit(); }, 10000);
    }
  }catch(e){ console.warn('[PRO][inj] image-ready init failed', e); }
})();
// --- end image readiness ---
// injected.js — PRO 5.8.7 (solid line + scroll/resize pinning)
(function(){
  const log=(...a)=>{ if(window.PRO_DEBUG) console.log('[PRO][inj]',...a); };
  log('loaded v5.8.7');

  const BOUNDS={latMax:59, latMin:21, lonMin:-129, lonMax:-64};
  const state={overlay:null, ctx:null, rect:null, last:null};

  function getRect(){
    const area=document.getElementById('click_map_area');
    const img=document.getElementById('display_image');
    if(area&&area.coords&&img){
      const parts=String(area.coords).split(',').map(v=>parseInt(v,10));
      if(parts.length===4){
        const [x1,y1,x2,y2]=parts; // coords are relative to the image
        const r=img.getBoundingClientRect();
        const baseX=Math.round(window.scrollX+r.left);
        const baseY=Math.round(window.scrollY+r.top);
        return {x:baseX+x1,y:baseY+y1,w:(x2-x1),h:(y2-y1)};
      }
    }
    if(img){
      const r=img.getBoundingClientRect();
      const x=Math.round(window.scrollX+r.left), y=Math.round(window.scrollY+r.top);
      return {x,y,w:Math.round(r.width),h:Math.round(r.height)};
    }
    return null;
  }
  function ensureOverlay(){
    if(state.overlay && document.body.contains(state.overlay)) return state.overlay;
    const cv=document.createElement('canvas');
    cv.id='pro_route_canvas';
  cv.style.position='absolute';
  cv.style.pointerEvents='none';
  cv.style.zIndex=1;
    document.body.appendChild(cv);
    state.overlay=cv; state.ctx=cv.getContext('2d');
    return cv;
  }
  function redraw(){
    if(!state.last) return;
    const r=state.rect=getRect(); if(!r) return;
    const cv=ensureOverlay(); cv.width=Math.max(1,r.w); cv.height=Math.max(1,r.h);
    cv.style.left=r.x+'px'; cv.style.top=r.y+'px';
    const ctx=state.ctx; ctx.clearRect(0,0,cv.width,cv.height);
    ctx.lineWidth=Math.max(1,state.last.width||3);
    ctx.strokeStyle=state.last.color||'#ff0000';
    ctx.setLineDash([]); // SOLID
    ctx.lineJoin='round'; ctx.lineCap='round'; ctx.beginPath();
    const ll=state.last.latlngs;
    // Use bounds from event detail if present
    const bounds = state.last.bounds && typeof state.last.bounds === 'object' ? state.last.bounds : BOUNDS;
    if(window.PRO_DEBUG){
      console.log('[PRO][draw] Received bounds:', state.last.bounds);
      console.log(`[PRO][draw] Map bounds: latMax=${bounds.latMax}, latMin=${bounds.latMin}, lonMin=${bounds.lonMin}, lonMax=${bounds.lonMax}`);
      if (r) {
        console.log(`[PRO][draw] Canvas rect: x=${r.x}, y=${r.y}, w=${r.w}, h=${r.h}`);
      }
    }
    for(let i=0;i<ll.length;i++){
      const lat=ll[i][0], lon=ll[i][1];
      const x=((lon-bounds.lonMin)/(bounds.lonMax-bounds.lonMin))*r.w;
      const y=((bounds.latMax-lat)/(bounds.latMax-bounds.latMin))*r.h;
      if(window.PRO_DEBUG){
        console.log(`[PRO][draw] Point ${i}: lat=${lat}, lon=${lon}, px=(${x},${y})`);
      }
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();

    // Draw triangles at hour marks
    if (Array.isArray(state.last.triangles) && state.last.triangles.length > 0) {
      ctx.fillStyle = state.last.color || '#ff0000';
      const size = Math.max(8, state.last.width * 3); // triangle size in px
      for (let i = 0; i < state.last.triangles.length; i++) {
        const [lat, lon] = state.last.triangles[i];
        const x = ((lon-bounds.lonMin)/(bounds.lonMax-bounds.lonMin))*r.w;
        const y = ((bounds.latMax-lat)/(bounds.latMax-bounds.latMin))*r.h;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, y-size/2);
        ctx.lineTo(x-size/2, y+size/2);
        ctx.lineTo(x+size/2, y+size/2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
  function handleDraw(detail){
    if(!detail||!Array.isArray(detail.latlngs)||detail.latlngs.length<2) return;
  state.last={latlngs:detail.latlngs, color:detail.color, width:detail.width, bounds: detail.bounds, triangles: detail.triangles};
    redraw();
  }
  window.addEventListener('PRO_DRAW_ROUTE', ev=>{ try{ handleDraw(ev.detail||{});}catch(e){console.warn(e);} });
  window.addEventListener('PRO_CLEAR_ROUTE', ()=>{ state.last=null; if(state.overlay){ state.ctx.clearRect(0,0,state.overlay.width,state.overlay.height);} });
  window.addEventListener('scroll', ()=>redraw(), {passive:true});
  window.addEventListener('resize', ()=>redraw());
})();

// === readiness signal ===
try {
  window.__PRO_OVERLAY_READY = true;
  window.dispatchEvent(new CustomEvent('PRO_INJECTED_READY'));
} catch(_) {}
