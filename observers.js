console.log('[PRO][observers.js] TOP: observers.js script loaded');
// Helper: Wait for both map image and subregion label to match before redraw
function waitForMapAndSubregion(targetLabel, callback, tries = 0) {
  const img = window.getBetaMapImage ? window.getBetaMapImage() : null;
  const mapArea = window.detectMapArea ? window.detectMapArea() : null;
  if (img && img.complete && mapArea === targetLabel) {
    callback();
  } else if (tries < 30) {
    setTimeout(() => waitForMapAndSubregion(targetLabel, callback, tries + 1), 100);
  }
}
// Observer logic for image and subregion button
function observeImage(img, redrawIfBothReady, hideAndClear) {
  let lastImgSrc = img ? img.src : null;
  let imageObserver = null;
  if (!img) return;
  if (imageObserver) imageObserver.disconnect();
  lastImgSrc = img.src;
  redrawIfBothReady();
  imageObserver = new MutationObserver(() => {
    console.log('[PRO][observers.js] Image change fired');
    if (img.src !== lastImgSrc) {
      lastImgSrc = img.src;
      hideAndClear();
      img.addEventListener('load', redrawIfBothReady, { once: true });
    }
  });
  imageObserver.observe(img, { attributes: true, attributeFilter: ['src'] });
  if (!img.complete) {
    hideAndClear();
    img.addEventListener('load', redrawIfBothReady, { once: true });
  }
}

function observeSubregionBtn(btn, redrawIfBothReady, hideAndClear) {
  if (!btn) return;
  // Disconnect any previous observer on this button
  if (btn._proObserver && typeof btn._proObserver.disconnect === 'function') {
    console.log('[PRO][observers.js] Button Observer disconnected:');
    btn._proObserver.disconnect();
  }
  let lastLabel = btn.getAttribute('aria-label');
  proDebugLog('[PRO][content] Attaching MutationObserver to subregion button:', lastLabel);
  const buttonObserver = new MutationObserver(() => {
    console.log('[PRO][observers.js] MutationObserver callback fired');
    const newLabel = btn.getAttribute('aria-label');
    if (newLabel !== lastLabel) {
      lastLabel = newLabel;
      if (typeof proDebugLog === 'function') proDebugLog('[PRO][content] Subregion changed:', newLabel);
      console.log('[PRO][observers.js] Subregion changed:', newLabel);
      if (window.detectMapArea) {
        const mapArea = window.detectMapArea();
        if (typeof proDebugLog === 'function') proDebugLog('[PRO][observers.js] detectMapArea() returned:', mapArea);
        console.log('[PRO][observers.js] detectMapArea() returned:', mapArea);
        if (window.updateSidebarInput) {
          if (typeof proDebugLog === 'function') proDebugLog('[PRO][observers.js] Calling updateSidebarInput with:', mapArea);
          console.log('[PRO][observers.js] Calling updateSidebarInput with:', mapArea);
          window.updateSidebarInput(mapArea);
        } else {
          if (typeof proDebugLog === 'function') proDebugLog('[PRO][observers.js] updateSidebarInput is missing!');
          console.log('[PRO][observers.js] updateSidebarInput is missing!');
        }
      } else {
        if (typeof proDebugLog === 'function') proDebugLog('[PRO][observers.js] detectMapArea is missing!');
        console.log('[PRO][observers.js] detectMapArea is missing!');
      }
      // Wait for both map image and subregion, then redraw
      waitForMapAndSubregion(window.detectMapArea ? window.detectMapArea() : undefined, redrawIfBothReady);
    }
  });
  buttonObserver.observe(btn, {
    attributes: true,
    attributeFilter: ['aria-label'],
    childList: true,
    subtree: true,
    characterData: true
  });
  btn._proObserver = buttonObserver;
  console.log('[PRO][observers.js] Observer attached to button:', 'Initial aria-label:', btn.getAttribute('aria-label'));

  // Immediately update Map Area input in case button is replaced with correct label
  if (window.detectMapArea) {
    const mapArea = window.detectMapArea();
    if (window.updateSidebarInput) {
      console.log('[PRO][observers.js] Immediate updateSidebarInput with:', mapArea);
      window.updateSidebarInput(mapArea);
    } else {
      console.log('[PRO][observers.js] Immediate updateSidebarInput is missing!');
    }
    // Always trigger redraw after region change to ensure correct line is drawn
    if (typeof redrawIfBothReady === 'function') {
      setTimeout(() => { redrawIfBothReady(); }, 0);
    }
  } else {
    console.log('[PRO][observers.js] Immediate detectMapArea is missing!');
  }
}

// Observer for React top level container mutation
function observeReactContainer() {
  const stableParent = document.querySelector('.Body-module-scss-module__IYjbWG__inner');
  if (!stableParent) return requestAnimationFrame(observeReactContainer);

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue; // Only process elements

        //
        // === Detect .modelZoom blocks ===
        //
        const zoomBlocks = node.matches('.ParameterToolbar-module-scss-module__pLte5G__modelZoom')
          ? [node]
          : node.querySelectorAll?.('.ParameterToolbar-module-scss-module__pLte5G__modelZoom');

        if (zoomBlocks && zoomBlocks.length) {
          const targetBlock = zoomBlocks[1] || zoomBlocks[0];
          const secondButton = targetBlock?.querySelectorAll('button')[1];
          const label = secondButton?.getAttribute('aria-label');

          if (label?.startsWith('Zoom:')) {
            console.log('[PRO] Second Zoom button label:', label);
            const subregion = label.replace(/^Zoom:\s*/, '');
            console.log('[PRO] Subregion:', subregion);
            // === UI actions for subregion change ===
            // 1. Update Map Area control in extension sub-panel
            if (window.updateSidebarInput && typeof window.detectMapArea === 'function') {
              window.updateSidebarInput(subregion);
              console.log('[PRO][observers.js] Map Area control updated to:', subregion);
            }
            // 2. Force current route line to be cleared
            window.dispatchEvent(new CustomEvent('PRO_CLEAR_ROUTE'));
            console.log('[PRO][observers.js] Route line cleared due to subregion change.');
          }
        }

        //
        // === Detect .mapContainer elements ===
        //
        const mapNodes = node.matches('.MapBox-module-scss-module__mQ8v2G__mapContainer')
          ? [node]
          : node.querySelectorAll?.('.MapBox-module-scss-module__mQ8v2G__mapContainer');

        if (mapNodes && mapNodes.length) {
          for (const mapNode of mapNodes) {
            console.log('[PRO] Map container detected:', mapNode);
            // Find images inside this map container
            const imgs = mapNode.querySelectorAll('img');
            if (imgs.length === 0) {
              console.log('[PRO] No <img> found in map container.');
            } else {
              for (const img of imgs) {
                if (img.complete) {
                  console.log('[PRO] Map image loaded:');
                  // === UI action: draw the appropriate route line for the new subregion ===
                  if (typeof window.redrawIfBothReady === 'function') {
                    setTimeout(() => { window.redrawIfBothReady(); }, 0);
                    console.log('[PRO][observers.js] redrawIfBothReady called after map image load.');
                  }
                } else {
                  console.log('[PRO] Map image not yet complete:');
                  // Listen for load/error for completeness
                  img.addEventListener('load', () => {
                    console.log('[PRO] Map image finished loading:');
                    if (typeof window.redrawIfBothReady === 'function') {
                      setTimeout(() => { window.redrawIfBothReady(); }, 0);
                      console.log('[PRO][observers.js] redrawIfBothReady called after map image finished loading.');
                    }
                  });
                  img.addEventListener('error', () => {
                    console.warn('[PRO] Map image failed to load:');
                  });
                }
              }
            }
          }
        }
      }
    }
  });

  observer.observe(stableParent, { childList: true, subtree: true });
  console.log('[PRO] Observing for .modelZoom and .mapContainer');
}

// Expose globally
window.observeImage = observeImage;
window.observeSubregionBtn = observeSubregionBtn;
window.observeReactContainer = observeReactContainer;
console.log('[PRO][observers.js] END: observeSubregionBtn attached:', typeof window.observeSubregionBtn);
if (window.proDebugLog) window.proDebugLog('[PRO][observers.js] observers.js loaded, observeSubregionBtn attached:', typeof window.observeSubregionBtn);
// observers.js
// MutationObserver and event-driven logic for map and subregion changes

// ...existing code...
