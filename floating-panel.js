// Claude Arc Browser Floating Panel
// Uses plain DOM - injects sidepanel.html in an iframe with tabId

(function () {
  "use strict";

  if (window.__claudeFloatingPanelLoaded) return;
  window.__claudeFloatingPanelLoaded = true;

  const url = window.location.href;
  if (
    url.startsWith("chrome") ||
    url.startsWith("arc://") ||
    url.startsWith("about:") ||
    url.startsWith("chrome-extension://") ||
    url.includes("claude.ai/") ||
    url.includes("/oauth") ||
    url.includes("oauth_callback")
  ) {
    return;
  }

  if (typeof chrome === "undefined" || !chrome?.runtime?.id) return;

  const EXTENSION_ID = chrome.runtime.id;
  const HEADER_HEIGHT = 36;

  let panelVisible = false;

  // ── Build Panel DOM ─────────────────────────────────────────────

  const wrapper = document.createElement("div");
  wrapper.id = "claude-arc-floating-panel";
  wrapper.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    display: none;
    top: 0;
    right: 0;
    width: 420px;
    height: 100vh;
    box-shadow: -2px 0 12px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `;

  wrapper.innerHTML = `
    <div style="display:flex;flex-direction:column;width:100%;height:100%;background:#1a1a1a;border-left:1px solid rgba(255,255,255,0.08);">
      <div id="claude-arc-header" style="display:flex;align-items:center;justify-content:space-between;height:${HEADER_HEIGHT}px;padding:0 8px 0 12px;background:#2a2a2a;cursor:default;user-select:none;-webkit-user-select:none;border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex;align-items:center;gap:6px;color:#e0e0e0;font-size:12px;font-weight:500;">
          <div style="width:16px;height:16px;border-radius:3px;background:#D97757;display:flex;align-items:center;justify-content:center;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.709 15.955l4.397-10.985c.2-.5.349-.873.549-1.312.164-.36.506-.658.908-.658.401 0 .744.298.908.658.2.439.349.812.549 1.312l4.397 10.985c.175.437.262.656.262.83 0 .575-.466 1.041-1.041 1.041-.437 0-.72-.262-1.006-.83l-1.18-2.95H6.694l-1.18 2.95c-.286.568-.569.83-1.006.83A1.041 1.041 0 013.467 16.786c0-.175.088-.393.262-.83h.98zm2.643-3.808h4.45L9.577 6.375l-2.225 5.772z"/>
            </svg>
          </div>
          Claude
        </div>
        <button id="claude-arc-close" style="width:24px;height:24px;border:none;background:transparent;color:#999;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;padding:0;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </button>
      </div>
      <div id="claude-arc-content" style="flex:1;overflow:hidden;background:#fff;"></div>
    </div>
  `;

  document.documentElement.appendChild(wrapper);

  const closeBtn = wrapper.querySelector("#claude-arc-close");
  const contentEl = wrapper.querySelector("#claude-arc-content");

  // ── Get tab ID from service worker ──────────────────────────────

  async function getTabInfo() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "GET_TAB_ID" }, (response) => {
          if (response?.diag) {
            try { wrapper.dataset.arcDiag = JSON.stringify(response.diag); } catch (e) {}
          }
          resolve({ tabId: response?.tabId || 0, iframeAllowed: response?.iframeAllowed !== false });
        });
      } catch (e) {
        resolve({ tabId: 0, iframeAllowed: true });
      }
    });
  }

  // ── Panel Methods ──────────────────────────────────────────────

  async function showPanel() {
    let iframe = contentEl.querySelector("iframe");
    if (!iframe) {
      const { tabId, iframeAllowed } = await getTabInfo();
      if (!iframeAllowed) {
        // Popup-window mode (default), or the manifest Arc parsed does not
        // expose sidepanel.html to web pages so an iframe would be blocked.
        // Ask the service worker for the window and keep the shell hidden.
        try {
          chrome.runtime.sendMessage({ type: "ARC_OPEN_PANEL_WINDOW", tabId }, () => void chrome.runtime.lastError);
        } catch (e) {}
        return;
      }
      iframe = document.createElement("iframe");
      iframe.src = `chrome-extension://${EXTENSION_ID}/sidepanel.html?tabId=${tabId}`;
      iframe.allow = "clipboard-read; clipboard-write";
      iframe.style.cssText = "width:100%;height:100%;border:none;background:#fff;";
      contentEl.appendChild(iframe);
    }
    wrapper.style.display = "block";
    panelVisible = true;
  }

  function hidePanel() {
    wrapper.style.display = "none";
    panelVisible = false;
  }

  function togglePanel() {
    panelVisible ? hidePanel() : showPanel();
  }

  // ── Events ─────────────────────────────────────────────────────

  closeBtn.addEventListener("click", hidePanel);

  // ── Message Listener ──────────────────────────────────────────

  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "TOGGLE_FLOATING_PANEL") togglePanel();
      if (message.type === "SHOW_FLOATING_PANEL") showPanel();
      if (message.type === "HIDE_FLOATING_PANEL") hidePanel();
      sendResponse({ success: true });
      return true;
    });
  } catch (e) {}

  // ── Keyboard Shortcut ─────────────────────────────────────────

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "e") {
      e.preventDefault();
      togglePanel();
    }
  });
})();
