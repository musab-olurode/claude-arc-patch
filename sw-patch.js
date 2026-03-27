// Service Worker Patch for Arc Browser
// Intercepts sidePanel API calls and redirects to floating panel

// Detect if sidePanel API is unavailable (Arc browser)
const _isSidePanelSupported =
  typeof chrome !== "undefined" &&
  typeof chrome.sidePanel !== "undefined" &&
  typeof chrome.sidePanel.open === "function";

if (!_isSidePanelSupported) {
  console.log("[Claude Arc Patch] sidePanel API not available, using floating panel");

  // Monkey-patch chrome.sidePanel if it doesn't exist
  if (!chrome.sidePanel) {
    chrome.sidePanel = {};
  }

  // Override sidePanel.open to send message to content script
  chrome.sidePanel.open = async function (options) {
    const tabId = options?.tabId;
    if (tabId) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "TOGGLE_FLOATING_PANEL" });
      } catch (e) {
        console.warn("[Claude Arc Patch] Could not send to tab:", e.message);
      }
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FLOATING_PANEL" });
        } catch (e) {
          console.warn("[Claude Arc Patch] Could not send to tab:", e.message);
        }
      }
    }
  };

  // Override sidePanel.setOptions (no-op for Arc)
  chrome.sidePanel.setOptions = async function () {};
  chrome.sidePanel.setPanelBehavior = async function () {};
  chrome.sidePanel.getOptions = async function () {
    return { enabled: true };
  };
  chrome.sidePanel.getPanelBehavior = async function () {
    return { openPanelOnActionClick: true };
  };
}

// Handle extension icon click
// Handle tab ID requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TAB_ID") {
    sendResponse({ tabId: sender.tab?.id || 0 });
    return true;
  }
});

// Toggle floating panel via icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FLOATING_PANEL" });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["floating-panel.js"]
      });
      await new Promise(r => setTimeout(r, 100));
      await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FLOATING_PANEL" });
    } catch (e2) {}
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-side-panel") {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FLOATING_PANEL" });
    } catch (e) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["floating-panel.js"]
        });
        await new Promise(r => setTimeout(r, 100));
        await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FLOATING_PANEL" });
      } catch (e2) {}
    }
  }
});
