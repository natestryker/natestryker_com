// Keep bookmarks to index.html on the same page, with a clean address bar.
(() => {
  if (!/^https?:$/.test(location.protocol)) return;
  const path = location.pathname.replace(/\/index\.html$/i, '/');
  if (path !== location.pathname) {
    history.replaceState(history.state, '', path + location.search + location.hash);
  }
})();
