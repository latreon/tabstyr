// Mirror the dashboard's chosen theme BEFORE paint (no flash). The dashboard caches
// its setting in localStorage under this key; absent/"system" falls back to the OS
// preference, matched by the page's CSS media queries. Loaded as an external file
// (not inline) so it satisfies the extension's strict CSP: script-src 'self'.
try {
  var t = localStorage.getItem('tabstyr:theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) {
  /* storage unavailable — CSS media-query fallback applies */
}
