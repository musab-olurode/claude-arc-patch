# Claude Arc Patch

Make the official [Claude Chrome Extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) work in [Arc Browser](https://arc.net).

## The Problem

Claude's Chrome extension uses the `chrome.sidePanel` API to display a sidebar panel. Arc Browser doesn't support this API, so the extension fails to load its UI.

## The Solution

This patcher copies the official Claude extension and applies minimal patches to make it work in Arc:

- **Floating sidebar panel** injected into web pages via a content script (replaces the unsupported sidePanel API)
- **Service worker patch** that monkey-patches `chrome.sidePanel` calls and routes icon clicks to the floating panel
- **Tab context patch** that fixes `chrome.tabs.query` so Claude can identify the active tab from within the iframe
- **Inline script extraction** to comply with Manifest V3 CSP requirements

No original Claude extension code is modified. Only additional files are injected.

## Installation

### Prerequisites

- [Arc Browser](https://arc.net) installed
- [Claude Chrome Extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) installed in Chrome (needed as source files)

### Steps

1. **Clone this repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/claude-arc-patch.git
   cd claude-arc-patch
   ```

2. **Run the patcher**
   ```bash
   ./patch.sh
   ```
   The script auto-detects the Claude extension installed in Chrome. If it can't find it, provide the path manually:
   ```bash
   ./patch.sh /path/to/claude/extension/directory
   ```

3. **Load in Arc**
   - Go to `arc://extensions`
   - Enable **Developer mode** (top right toggle)
   - Click **Load unpacked**
   - Select the `claude-arc-patched` folder
   - Disable the original Claude extension in Chrome to avoid conflicts

4. **If macOS blocks the script**
   ```bash
   xattr -cr /path/to/claude-arc-patch
   bash patch.sh
   ```

### Usage

- **Click the extension icon** in Arc's toolbar to toggle the Claude sidebar
- **Cmd+E** (Mac) / **Ctrl+E** (Windows) to toggle the sidebar
- Click the **X** button on the sidebar header to close it

## How It Works

| File | Purpose |
|------|---------|
| `patch.sh` | Copies the official extension and applies all patches |
| `floating-panel.js` | Content script that creates a sidebar panel on web pages |
| `sw-patch.js` | Service worker patch: monkey-patches sidePanel API, handles icon clicks and keyboard shortcuts |
| `arc-tabs-patch.js` | Patches `chrome.tabs.query` so the sidepanel can find the active tab from an iframe context |
| `theme-init.js` | Extracted inline script for dark/light mode (CSP compliance) |

### Architecture

```
                  Arc Browser
                  +--------------------------+
                  |  Web Page                |
                  |  +--------------------+  |
  Icon click /    |  | floating-panel.js  |  |
  Cmd+E           |  | (content script)   |  |
       |          |  |                    |  |
  sw-patch.js --->|  |  +-------------+  |  |
  (service worker)|  |  | sidepanel   |  |  |
                  |  |  | .html       |  |  |
                  |  |  | (iframe)    |  |  |
                  |  |  +-------------+  |  |
                  |  +--------------------+  |
                  +--------------------------+
```

## Troubleshooting

**Panel not showing:**
- Make sure the extension is enabled at `arc://extensions`
- Refresh the page (Cmd+R)
- Check console for errors (Cmd+Option+I)

**Login issues:**
- Make sure you're logged into Claude in Chrome first
- The patched extension shares the same authentication

**Shortcut not working:**
- Cmd+E only works after the page has loaded
- Check `arc://extensions/shortcuts` for conflicts with other extensions

**"Operation not permitted" when running patch.sh:**
```bash
xattr -cr /path/to/claude-arc-patch
```

## Security

- No original Claude extension code is modified
- Only additional patch files are injected
- All code is open source and auditable
- The extension ID is preserved, so authentication continues to work
- No data is collected or sent externally

## Updating

When Claude releases a new extension version:

1. Update the Claude extension in Chrome
2. Re-run `./patch.sh`
3. Reload the extension in Arc (`arc://extensions` > reload icon)

## Contributing

Pull requests welcome. Please keep patches minimal and focused on Arc compatibility.

## License

MIT - see [LICENSE](LICENSE)

## Disclaimer

This project is not affiliated with Anthropic. Claude is a trademark of Anthropic, PBC.
