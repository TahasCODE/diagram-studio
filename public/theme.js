// Restore before first paint, even while React downloads. External for script-src 'self'.
(() => {
  let theme = 'light';
  try {
    if (localStorage.getItem('diagram-studio-v1-theme') === 'dark') theme = 'dark';
  } catch { /* Preserve the light default when storage is unavailable. */ }
  document.documentElement.dataset.theme = theme;
})();
