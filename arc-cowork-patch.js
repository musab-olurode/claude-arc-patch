// ──────────────────────────────────────────────────────────────────
// Arc Cowork Experience Patch — force the "classic" sidepanel in Arc
//
// Claude's newer extension can render the sidepanel as the server-gated
// "cowork" experience, which is an embedded iframe:
//     <iframe src="https://claude.ai/cic/new?surface=cic_sidepanel" ...>
// (gate: chrome_ext_cowork_iframe; preference key: preferCoworkExperience).
//
// In Chrome's real side panel the frame's ancestor chain is just
//     [ chrome-extension://<id>/sidepanel.html ]  >  claude.ai
// and claude.ai's `frame-ancestors` CSP allows the extension origin, so it loads.
//
// In Arc there is no chrome.sidePanel, so the sidepanel runs as an iframe that
// floating-panel.js injects into the current web page. The ancestor chain becomes
//     web page (top)  >  chrome-extension://<id>/sidepanel.html  >  claude.ai
// `frame-ancestors` is checked against EVERY ancestor, and the arbitrary top-level
// web page is not on claude.ai's allow-list — so the frame is refused
// ("claude.ai refused to connect") and the whole panel breaks. This flips on its
// own whenever Anthropic enables the server gate for an account, which is why it
// starts failing with no version change and survives a clean reinstall.
//
// The classic sidepanel is a local UI with no claude.ai iframe, so it works in Arc.
// The extension already exposes this exact off-switch: its own "Switch back to
// classic" action runs `chrome.storage.local.set({ preferCoworkExperience: false })`.
// We assert that same preference before the sidepanel app bundle reads it, so the
// panel always starts in the classic experience under Arc. No original extension
// code is modified — the extension's own preference decides everything.
//
// Runs in the sidepanel page (extension origin), injected before the app bundle.
// Harmless on older versions that lack the cowork experience (the key is ignored).
// ──────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;

  var KEY = "preferCoworkExperience";

  try {
    chrome.storage.local.get(KEY, function (v) {
      // Ignore transient read errors; the app also re-reads on storage change.
      if (chrome.runtime && chrome.runtime.lastError) return;
      if (v && v[KEY] === false) return; // already classic → no write, no churn

      chrome.storage.local.set({ preferCoworkExperience: false }, function () {
        if (chrome.runtime && chrome.runtime.lastError) return;
        console.log(
          "[Arc Cowork Patch] forced classic sidepanel (preferCoworkExperience=false) — " +
            "the cowork iframe embeds claude.ai, which Arc's frame-ancestors refuses"
        );
      });
    });
  } catch (e) {}
})();
