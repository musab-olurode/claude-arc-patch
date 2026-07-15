#!/bin/bash
# ──────────────────────────────────────────────────────────────────
# Claude Extension Arc Browser Patcher
# Takes the official Claude Chrome extension and patches it
# to work with Arc browser using a floating panel.
# ──────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLOATING_PANEL_JS="$SCRIPT_DIR/floating-panel.js"
SW_PATCH_JS="$SCRIPT_DIR/sw-patch.js"
ARC_TABS_PATCH_JS="$SCRIPT_DIR/arc-tabs-patch.js"
ARC_TABGROUPS_SHIM_JS="$SCRIPT_DIR/arc-tabgroups-shim.js"

# ── Colors ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# ── Find Claude Extension ───────────────────────────────────────

find_claude_extension() {
  local search_dirs=()

  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - Chrome and Arc extension paths
    search_dirs+=(
      "$HOME/Library/Application Support/Google/Chrome/Default/Extensions"
      "$HOME/Library/Application Support/Google/Chrome/Profile */Extensions"
      "$HOME/Library/Application Support/Arc/User Data/Default/Extensions"
      "$HOME/Library/Application Support/Arc/User Data/Profile */Extensions"
    )
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    search_dirs+=(
      "$HOME/.config/google-chrome/Default/Extensions"
      "$HOME/.config/google-chrome/Profile */Extensions"
    )
  fi

  # Claude extension known IDs
  local claude_ids=("jlgadfahkiakjhceomgpemiabkpgnlho" "cpklelfgbalgamlgfhikjfneldeeilcg" "fcoeoabgfenejglbffodgkkbkcdhcgfn")

  for base_dir_pattern in "${search_dirs[@]}"; do
    for base_dir in $base_dir_pattern; do
      [ -d "$base_dir" ] || continue
      for ext_id in "${claude_ids[@]}"; do
        local ext_path="$base_dir/$ext_id"
        if [ -d "$ext_path" ]; then
          # Get latest version directory
          local latest_ver
          latest_ver=$(ls -1 "$ext_path" | sort -V | tail -1)
          if [ -n "$latest_ver" ] && [ -f "$ext_path/$latest_ver/manifest.json" ]; then
            echo "$ext_path/$latest_ver"
            return 0
          fi
        fi
      done
    done
  done

  return 1
}

# ── Main ─────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Claude Extension - Arc Browser Patcher     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Check required files
[ -f "$FLOATING_PANEL_JS" ] || fail "floating-panel.js not found in $SCRIPT_DIR"
[ -f "$SW_PATCH_JS" ] || fail "sw-patch.js not found in $SCRIPT_DIR"
[ -f "$ARC_TABS_PATCH_JS" ] || fail "arc-tabs-patch.js not found in $SCRIPT_DIR"
[ -f "$ARC_TABGROUPS_SHIM_JS" ] || fail "arc-tabgroups-shim.js not found in $SCRIPT_DIR"

# Find or accept source path
SOURCE_DIR=""

if [ -n "$1" ]; then
  SOURCE_DIR="$1"
  [ -d "$SOURCE_DIR" ] || fail "Provided path does not exist: $SOURCE_DIR"
  [ -f "$SOURCE_DIR/manifest.json" ] || fail "No manifest.json found in: $SOURCE_DIR"
else
  info "Searching for Claude extension..."
  SOURCE_DIR=$(find_claude_extension) || true

  if [ -z "$SOURCE_DIR" ]; then
    echo ""
    warn "Could not auto-detect Claude extension."
    echo ""
    echo "Please provide the path manually. You can find it by:"
    echo "  1. Open chrome://extensions in Chrome"
    echo "  2. Enable Developer Mode"
    echo "  3. Find 'Claude' and note the extension ID"
    echo "  4. The extension is at:"
    echo "     macOS: ~/Library/Application Support/Google/Chrome/Default/Extensions/<ID>/<version>"
    echo ""
    echo "Usage: $0 /path/to/claude/extension"
    exit 1
  fi
fi

ok "Found Claude extension at: $SOURCE_DIR"

# Create output directory
OUTPUT_DIR="$SCRIPT_DIR/claude-arc-patched"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

info "Copying extension files..."
cp -R "$SOURCE_DIR/"* "$OUTPUT_DIR/"
chmod -R u+rw "$OUTPUT_DIR"
ok "Files copied to: $OUTPUT_DIR"

# Copy floating panel
info "Adding floating-panel.js..."
cp "$FLOATING_PANEL_JS" "$OUTPUT_DIR/floating-panel.js"
ok "floating-panel.js added"

# Copy service worker patch
info "Adding sw-patch.js..."
cp "$SW_PATCH_JS" "$OUTPUT_DIR/sw-patch.js"
ok "sw-patch.js added"

# Copy tab groups shim (emulates the Chrome Tab Groups API, which Arc exposes
# but never resolves — see README "How It Works")
info "Adding arc-tabgroups-shim.js..."
cp "$ARC_TABGROUPS_SHIM_JS" "$OUTPUT_DIR/arc-tabgroups-shim.js"
ok "arc-tabgroups-shim.js added"

# ── Extract inline script from sidepanel.html ────────────────────

info "Extracting inline script from sidepanel.html..."

# Create theme-init.js from the inline script
cat > "$OUTPUT_DIR/theme-init.js" << 'THEMEJS'
(function () {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-mode", isDark ? "dark" : "light");
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      document.documentElement.setAttribute(
        "data-mode",
        e.matches ? "dark" : "light"
      );
    });
})();
THEMEJS

# Replace inline script tag with external script reference
OUTPUT_DIR="$OUTPUT_DIR" python3 -c "
import re, os
path = os.path.join(os.environ['OUTPUT_DIR'], 'sidepanel.html')
with open(path, 'r') as f:
    html = f.read()
html = re.sub(
    r'<script>\s*//\s*Set initial theme.*?</script>',
    '<script src=\"/theme-init.js\"></script>',
    html,
    flags=re.DOTALL
)
with open(path, 'w') as f:
    f.write(html)
print('OK')
"
ok "Inline script extracted to theme-init.js"

# ── Add arc-tabs-patch.js to sidepanel.html ──────────────────────

info "Adding arc-tabs-patch.js..."
cp "$ARC_TABS_PATCH_JS" "$OUTPUT_DIR/arc-tabs-patch.js"

# Insert arc-tabs-patch.js before the main sidepanel script
OUTPUT_DIR="$OUTPUT_DIR" python3 -c "
import os
path = os.path.join(os.environ['OUTPUT_DIR'], 'sidepanel.html')
with open(path, 'r') as f:
    html = f.read()
if 'arc-tabs-patch.js' not in html:
    html = html.replace(
        '<script src=\"/theme-init.js\"></script>',
        '<script src=\"/theme-init.js\"></script>\n    <script src=\"/arc-tabs-patch.js\"></script>'
    )
    with open(path, 'w') as f:
        f.write(html)
print('OK')
"
ok "arc-tabs-patch.js added to sidepanel.html"

# ── Patch manifest.json ─────────────────────────────────────────

info "Patching manifest.json..."

# Use Python for reliable JSON manipulation
OUTPUT_DIR="$OUTPUT_DIR" python3 << 'PYEOF'
import json
import sys
import os

manifest_path = os.path.join(os.environ["OUTPUT_DIR"], "manifest.json")

with open(manifest_path, "r") as f:
    manifest = json.load(f)

# Add floating-panel.js as content script
content_scripts = manifest.get("content_scripts", [])

# Check if already patched
already_patched = any(
    "floating-panel.js" in cs.get("js", [])
    for cs in content_scripts
)

if not already_patched:
    content_scripts.append({
        "matches": ["<all_urls>"],
        "exclude_matches": [
            "https://claude.ai/*",
            "https://*.claude.ai/*"
        ],
        "js": ["floating-panel.js"],
        "run_at": "document_idle",
        "all_frames": False
    })
    manifest["content_scripts"] = content_scripts

# Ensure sidepanel.html is web_accessible
war = manifest.get("web_accessible_resources", [])
sidepanel_accessible = any(
    "sidepanel.html" in r.get("resources", [])
    for r in war if isinstance(r, dict)
)
if not sidepanel_accessible:
    war.append({
        "resources": ["sidepanel.html"],
        "matches": ["<all_urls>"]
    })
    manifest["web_accessible_resources"] = war

# Patch service worker background to also load sw-patch.js
bg = manifest.get("background", {})
if bg.get("service_worker"):
    # Replace single service worker with a loader that imports both
    original_sw = bg["service_worker"]
    bg["service_worker"] = "sw-loader.js"
    bg["type"] = "module"
    manifest["background"] = bg

    # Write the loader
    loader_path = os.path.join(os.environ["OUTPUT_DIR"], "sw-loader.js")
    with open(loader_path, "w") as f:
        f.write(f'// Patch sidePanel API BEFORE loading original service worker\n')
        f.write(f'import "./sw-patch.js";\n')
        f.write(f'// Emulate the Chrome Tab Groups API (Arc exposes it but it hangs)\n')
        f.write(f'import "./arc-tabgroups-shim.js";\n')
        f.write(f'import "./{original_sw}";\n')

# Remove side_panel key if present (not supported in Arc)
if "side_panel" in manifest:
    del manifest["side_panel"]


with open(manifest_path, "w") as f:
    json.dump(manifest, f, indent=2)

print("OK")
PYEOF

ok "manifest.json patched"

# ── Summary ──────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Patch Complete!                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "Patched extension is at:"
echo -e "  ${CYAN}$OUTPUT_DIR${NC}"
echo ""
echo "To install in Arc:"
echo "  1. Open arc://extensions"
echo "  2. Enable 'Developer mode' (top right)"
echo "  3. Click 'Load unpacked'"
echo "  4. Select: $OUTPUT_DIR"
echo "  5. Press Cmd+E (Mac) or Ctrl+E to toggle Claude panel"
echo ""
echo -e "${YELLOW}Note: Disable the original Claude extension to avoid conflicts.${NC}"
echo ""
