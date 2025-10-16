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
    console.log('[PRO][observers.js] Observer disconnected:', btn);
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
  console.log('[PRO][observers.js] Observer attached to button:', btn, 'Initial aria-label:', btn.getAttribute('aria-label'));

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

// Expose globally
window.observeImage = observeImage;
window.observeSubregionBtn = observeSubregionBtn;
console.log('[PRO][observers.js] END: observeSubregionBtn attached:', typeof window.observeSubregionBtn);
if (window.proDebugLog) window.proDebugLog('[PRO][observers.js] observers.js loaded, observeSubregionBtn attached:', typeof window.observeSubregionBtn);
// observers.js
// MutationObserver and event-driven logic for map and subregion changes

// ...existing code...
