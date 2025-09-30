// background.js — PRO 5.8.7
// MV3 service worker (module). All helpers inlined (no external exports).

const LOG=(...a)=>console.log('[PRO][bg]',...a);
let port=null;

chrome.runtime.onStartup.addListener(()=>{ console.log('[PRO][bg] startup'); });
chrome.runtime.onInstalled.addListener(()=>{ console.log('[PRO][bg] installed'); });

// Automatic NASR data check/fetch on extension load
async function autoCheckNASR() {
  try {
    const stored = await chrome.storage.local.get(['PRO_META']);
    let cachedCycle = stored.PRO_META && stored.PRO_META.cycleKey;
    let cachedDate = stored.PRO_META && stored.PRO_META.fetchedAt;
    let needsFetch = false;
    let currentCycle = null;
    try {
      const { cycleKey } = await discoverCycle();
      currentCycle = cycleKey;
      if (!cachedCycle || cachedCycle !== currentCycle) {
        needsFetch = true;
      }
    } catch (e) {
      LOG('Failed to discover current cycle:', e);
      // If can't discover, force fetch if no cache
      if (!cachedCycle) needsFetch = true;
    }
    if (needsFetch) {
      LOG('Fetching NASR data: cache missing or outdated');
      await fetchAndPersistCycle();
    } else {
      LOG('NASR cache is up to date:', cachedCycle);
    }
    // Always post status to UI
    const meta = await chrome.storage.local.get(['PRO_META']);
    // Dynamically import version
    let version = 'unknown';
    try {
      const vmod = await import(chrome.runtime.getURL('version.js'));
      version = vmod.PRO_VERSION;
    } catch (e) { LOG('Failed to load version.js:', e); }
    post({ phase: 'nasr_status', version, cycleKey: meta.PRO_META && meta.PRO_META.cycleKey, fetchedAt: meta.PRO_META && meta.PRO_META.fetchedAt });
  } catch (e) {
    LOG('NASR auto-check failed:', e);
    post({ phase: 'error', error: String(e && e.message || e) });
  }
}

chrome.runtime.onStartup.addListener(autoCheckNASR);
chrome.runtime.onInstalled.addListener(autoCheckNASR);


chrome.runtime.onConnect.addListener(p=>{
  if(p.name==='PRO_FAA_DIRECT'){
    port=p; LOG('connected');
    p.onMessage.addListener(async msg=>{
      if(!msg||!msg.cmd) return;
      if(msg.cmd==='FETCH_CURRENT_CYCLE'){
        try{ await fetchAndPersistCycle(); }
        catch(e){ post({phase:'error', error:String(e&&e.message||e)}) }
      }
    });
    p.onDisconnect.addListener(()=>{ port=null; });
  }
});
function post(o){ try{ port&&port.postMessage(o); }catch(_){ } }

async function fetchText(url){ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.text(); }
async function fetchBuf(url){ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); return new Uint8Array(await r.arrayBuffer()); }

async function discoverCycle(){
  const ROOT='https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/';
  post({phase:'start', url:ROOT});
  const html = await fetchText(ROOT);
  // Find the <h2>Current</h2> section and first link inside the following <ul>
  const secRe = /<h2[^>]*>\s*Current\s*<\/h2>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i;
  const secMatch = html.match(secRe);
  let cycleKey = null, url = null;
  if (secMatch) {
    const ul = secMatch[1];
    const linkMatch = ul.match(/NASR_Subscription\/(\d{4}-\d{2}-\d{2})/);
    if (linkMatch) {
      cycleKey = linkMatch[1];
      url = ROOT + cycleKey + '/';
    }
  }
  // Fallback to first occurrence anywhere on the page
  if (!cycleKey) {
    const m = html.match(/NASR_Subscription\/(\d{4}-\d{2}-\d{2})/);
    if (m) {
      cycleKey = m[1];
      url = ROOT + cycleKey + '/';
    }
  }
  if (!cycleKey) throw new Error('Cycle link not found');
  post({phase:'cycle', url, cycleKey});
  return {cycleKey,url};
}
function parseDatasetUrls(html){
  const out={};
  const re=/<a[^>]+href="([^"]+?_(APT|NAV|FIX)_CSV\.zip)"/g;
  let mm; while((mm=re.exec(html))){ const full=mm[1]; const code=mm[2]; out[code]=full.startsWith('http')?full:('https://nfdc.faa.gov'+full); }
  return out;
}

// ---- Minimal ZIP reader (supports stored and deflate entries via DecompressionStream) ----
async function unzip(buf){
  const dv=new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos=0; const out={};
  function readStr(off,len){ return new TextDecoder('utf-8').decode(buf.subarray(off, off+len)); }
  while(true){
    // find local file header signature 0x04034b50
    let found=false;
    while(pos+4<=buf.length){
      if(dv.getUint32(pos,true)===0x04034b50){ found=true; break; }
      pos++;
    }
    if(!found) break;
    const compMethod=dv.getUint16(pos+8,true);
    const csize=dv.getUint32(pos+18,true);
    const usize=dv.getUint32(pos+22,true);
    const nlen=dv.getUint16(pos+26,true);
    const elen=dv.getUint16(pos+28,true);
    const name=readStr(pos+30, nlen);
    const dataStart=pos+30+nlen+elen;
    const data=buf.subarray(dataStart, dataStart+csize);
    pos=dataStart+csize;
    let content;
    if(compMethod===0){ // stored
      content=new Uint8Array(data);
    } else {
      if(!('DecompressionStream' in globalThis)) throw new Error('Zip requires deflate decode but no DecompressionStream');
      const ds=new DecompressionStream('deflate-raw');
      const dec=await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
      content=new Uint8Array(dec);
    }
    out[name]=content;
  }
  return out;
}

// ---- CSV parser ----
function parseCSV(text){
  const rows=[]; let i=0, cell='', inQ=false, row=[];
  while(i<text.length){
    const c=text[i++];
    if(inQ){
      if(c==='\"'){
        if(text[i]==='\"'){ cell+='\"'; i++; } else { inQ=false; }
      } else cell+=c;
    } else {
      if(c==='\"') inQ=true;
      else if(c===','){ row.push(cell); cell=''; }
      else if(c==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
      else if(c==='\r'){ /* ignore */ }
      else cell+=c;
    }
  }
  if(cell.length||row.length){ row.push(cell); rows.push(row); }
  const head=(rows.shift()||[]).map(s=>s.trim());
  return rows.map(r=>{ const o={}; for(let j=0;j<head.length;j++) o[head[j]]=r[j]||''; return o; });
}

function toNum(s){ const n=parseFloat(String(s||'').trim()); return Number.isFinite(n)?n:NaN; }
function inBounds(lat,lon){ return lat<=59 && lat>=21 && lon>=-129 && lon<=-64; }

async function fetchAndPersistCycle(){
  const {cycleKey,url}=await discoverCycle();
  const page=await fetchText(url);
  const urls=parseDatasetUrls(page);

  let airports={}, navaids={}, fixes={};

  // APT
  if(urls.APT){
    post({phase:'apt_start', url:urls.APT});
    const buf=await fetchBuf(urls.APT);
    const files=await unzip(buf);
    post({phase:'apt_unzipped', fileCount:Object.keys(files).length});
    const baseName=Object.keys(files).find(n=>/\/?APT_BASE\.csv$/i.test(n)) || 'APT_BASE.csv';
    const csv = new TextDecoder('utf-8').decode(files[baseName]||new Uint8Array());
    const rows=parseCSV(csv);
    for(const r of rows){
      const lat=toNum(r['LAT_DECIMAL']); const lon=toNum(r['LONG_DECIMAL']);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)) continue;
      const icao=(r['ICAO_ID']||'').trim().toUpperCase();
      const faa=(r['ARPT_ID']||'').trim().toUpperCase();
      const name=(r['ARPT_NAME']||'').trim();
      const key = icao ? icao : (faa?('A/'+faa):null); if(!key) continue;
      airports[key]={ faaLocId:faa||'', icaoId:icao||undefined, lat, lon, name };
    }
    post({phase:'apt_parsed', count:Object.keys(airports).length});
  }

  // NAV
  if(urls.NAV){
    post({phase:'nav_start', url:urls.NAV});
    const buf=await fetchBuf(urls.NAV);
    const files=await unzip(buf);
    post({phase:'nav_unzipped', fileCount:Object.keys(files).length});
    const baseName=Object.keys(files).find(n=>/\/?NAV_BASE\.csv$/i.test(n)) || 'NAV_BASE.csv';
    const csv = new TextDecoder('utf-8').decode(files[baseName]||new Uint8Array());
    const rows=parseCSV(csv);
    for(const r of rows){
      const t=(r['NAV_TYPE']||'').trim().toUpperCase();
      if(t.includes('NDB')) continue;
      const id=(r['NAV_ID']||'').trim().toUpperCase();
      if(!id||id.length!==3) continue;
      const lat=toNum(r['LAT_DECIMAL']); const lon=toNum(r['LONG_DECIMAL']);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)) continue;
      if(!inBounds(lat,lon)) continue;
      const freqMHz=toNum(r['FREQ']);
      navaids[id]={ id, lat, lon, freqMHz: Number.isFinite(freqMHz)?freqMHz:undefined };
    }
    post({phase:'nav_parsed', count:Object.keys(navaids).length});
  }

  // FIX
  if(urls.FIX){
    post({phase:'fix_start', url:urls.FIX});
    const buf=await fetchBuf(urls.FIX);
    const files=await unzip(buf);
    post({phase:'fix_unzipped', fileCount:Object.keys(files).length});
    const baseName=Object.keys(files).find(n=>/\/?FIX_BASE\.csv$/i.test(n)) || 'FIX_BASE.csv';
    const csv = new TextDecoder('utf-8').decode(files[baseName]||new Uint8Array());
    const rows=parseCSV(csv);
    for(const r of rows){
      const id=(r['FIX_ID']||'').trim().toUpperCase();
      if(!id||id.length!==5) continue;
      const lat=toNum(r['LAT_DECIMAL']); const lon=toNum(r['LONG_DECIMAL']);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)) continue;
      if(!inBounds(lat,lon)) continue;
      fixes[id]={ id, lat, lon };
    }
    post({phase:'fix_parsed', count:Object.keys(fixes).length});
  }

  await chrome.storage.local.set({
    PRO_AIRPORT_INDEX: airports,
    PRO_NAV_INDEX: navaids,
    PRO_FIX_INDEX: fixes,
    PRO_META: { counts:{airports:Object.keys(airports).length, navaids:Object.keys(navaids).length, fixes:Object.keys(fixes).length}, cycleKey, fetchedAt: Date.now() }
  });
  post({phase:'done', meta:{cycleKey}});
}


// === PRO session persistence (per-tab) ===
chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  (async ()=>{
    try{
      if(!sender || !sender.tab){ return; }
      const tabId = sender.tab.id;
      if(msg && msg.cmd==='PRO_SAVE_LAST_ROUTE'){ console.log('[PRO][bg] saveLastRoute for tab', sender && sender.tab && sender.tab.id, msg && msg.data);
        const key = 'PRO_LAST_ROUTE_'+tabId;
        await chrome.storage.session.set({ [key]: msg.data || null });
        sendResponse({ok:true});
        return;
      }
      if(msg && msg.cmd==='PRO_LOAD_LAST_ROUTE'){ console.log('[PRO][bg] loadLastRoute for tab', sender && sender.tab && sender.tab.id);
        const key = 'PRO_LAST_ROUTE_'+tabId;
        const all = await chrome.storage.session.get(key);
        sendResponse({ok:true, data: all[key] || null});
        return;
      }
      if(msg && msg.cmd==='PRO_CLEAR_LAST_ROUTE'){ console.log('[PRO][bg] clearLastRoute for tab', sender && sender.tab && sender.tab.id);
        const key = 'PRO_LAST_ROUTE_'+tabId;
        await chrome.storage.session.remove(key);
        sendResponse({ok:true});
        return;
      }
    }catch(e){
      try{ sendResponse({ok:false, error: String(e&&e.message||e)}); }catch(_){}
    }
  })();
  // Return true to keep the message channel open for async sendResponse
  return true;
});
