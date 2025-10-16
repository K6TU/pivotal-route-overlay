// Sidebar input and debug controls
// Sidebar input and debug controls
function updateSidebarInput(mapArea) {
  const mapAreaInput = document.getElementById('pro-map-area');
  if (mapAreaInput) mapAreaInput.value = mapArea;
}
// Expose globally
window.updateSidebarInput = updateSidebarInput;
