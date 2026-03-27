// Patch chrome.tabs.query for iframe context (Arc browser)
// When sidepanel runs in an iframe, it can't find the "active tab"
// This patch intercepts the query and returns the correct tab

(function() {
  const params = new URLSearchParams(window.location.search);
  const tabId = parseInt(params.get("tabId"), 10);

  if (!tabId || !chrome?.tabs?.query) return;

  const originalQuery = chrome.tabs.query.bind(chrome.tabs);

  chrome.tabs.query = function(queryInfo, callback) {
    // If asking for active tab in current window, return the tab we know about
    if (queryInfo && queryInfo.active && (queryInfo.currentWindow || queryInfo.lastFocusedWindow)) {
      const promise = chrome.tabs.get(tabId).then(tab => {
        const result = [tab];
        if (callback) callback(result);
        return result;
      }).catch(() => {
        // Fallback to original query
        return originalQuery(queryInfo).then(result => {
          if (callback) callback(result);
          return result;
        });
      });
      if (!callback) return promise;
      return;
    }
    // For all other queries, use original
    const result = originalQuery(queryInfo);
    if (callback) result.then(callback);
    return result;
  };
})();
