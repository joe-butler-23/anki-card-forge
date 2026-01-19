#!/usr/bin/env bash
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
NIXOS_CONFIG_DIR="/etc/nixos"
FLAKE_INPUT="anki-forge"
SYS_APPS_FILE="$NIXOS_CONFIG_DIR/modules/core/sys-apps.nix"
FAKE_HASH="sha256-0000000000000000000000000000000000000000000="

update_npm_hash() {
    local new_hash="$1"
    if [[ ! -f "$SYS_APPS_FILE" ]]; then
        echo -e "${RED}✗ Error: Could not find $SYS_APPS_FILE${NC}"
        return 1
    fi
    sudo sed -i -E "s|npmDepsHash = \".*\";|npmDepsHash = \"$new_hash\";|" "$SYS_APPS_FILE"
}

rebuild_system() {
    sudo nixos-rebuild switch 2>&1 | tee /tmp/nixos-rebuild.log
}

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  Anki Card Forge - System Update${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || ! grep -q "anki-card-forge" package.json; then
    echo -e "${RED}✗ Error: Must be run from anki-forge-app directory${NC}"
    exit 1
fi

# Step 1: Show current flake info
echo -e "${BLUE}→ Current flake version:${NC}"
cd "$NIXOS_CONFIG_DIR"
nix flake metadata 2>/dev/null | grep -A2 "$FLAKE_INPUT" || echo "  (unable to fetch metadata)"
echo ""

# Step 2: Update flake lock
echo -e "${BLUE}→ Updating flake lock for $FLAKE_INPUT...${NC}"
if sudo nix flake lock --update-input "$FLAKE_INPUT" 2>&1 | tee /tmp/flake-update.log; then
    echo -e "${GREEN}✓ Flake lock updated${NC}"
else
    echo -e "${RED}✗ Failed to update flake lock${NC}"
    cat /tmp/flake-update.log
    exit 1
fi
echo ""

# Step 3: Show new flake info
echo -e "${BLUE}→ New flake version:${NC}"
nix flake metadata 2>/dev/null | grep -A2 "$FLAKE_INPUT" || echo "  (unable to fetch metadata)"
echo ""

# Step 4: Rebuild NixOS
echo -e "${BLUE}→ Rebuilding NixOS...${NC}"
echo -e "${YELLOW}  This may take a few minutes...${NC}"
if rebuild_system; then
    echo -e "${GREEN}✓ NixOS rebuilt successfully${NC}"
else
    echo -e "${RED}✗ Failed to rebuild NixOS${NC}"
    echo ""
    echo -e "${YELLOW}Common issues:${NC}"
    echo "  • Hash mismatch: Update npmDepsHash in modules/core/sys-apps.nix"
    echo "  • Build failure: Check /tmp/nixos-rebuild.log for details"
    echo ""

    # Check for hash mismatch
    if grep -q "npmDepsHash is out of date\|hash mismatch" /tmp/nixos-rebuild.log; then
        echo -e "${YELLOW}Detected npmDepsHash mismatch. Attempting auto-fix...${NC}"
        got_hash=$(grep -o "sha256-[A-Za-z0-9+/=]*" /tmp/nixos-rebuild.log | tail -1 || true)

        if [[ -z "$got_hash" ]]; then
            echo -e "${YELLOW}No hash found in logs. Forcing a fake hash to compute the correct value...${NC}"
            update_npm_hash "$FAKE_HASH"
            rebuild_system || true
            got_hash=$(grep -o "sha256-[A-Za-z0-9+/=]*" /tmp/nixos-rebuild.log | tail -1 || true)
        fi

        if [[ -n "$got_hash" ]]; then
            echo -e "${BLUE}→ Updating npmDepsHash to: ${got_hash}${NC}"
            update_npm_hash "$got_hash"
            echo -e "${BLUE}→ Retrying rebuild...${NC}"
            if rebuild_system; then
                echo -e "${GREEN}✓ NixOS rebuilt successfully${NC}"
            else
                echo -e "${RED}✗ Rebuild failed after updating npmDepsHash${NC}"
                exit 1
            fi
        else
            echo -e "${RED}✗ Could not determine npmDepsHash from logs${NC}"
            exit 1
        fi
    else
        exit 1
    fi

fi
echo ""

# Step 5: Verify installation
echo -e "${BLUE}→ Verifying installation...${NC}"
NEW_PATH=$(readlink -f /run/current-system/sw/bin/anki-card-forge)
echo -e "  Installed at: ${GREEN}$NEW_PATH${NC}"
echo ""

# Step 6: Done
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Update Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "Run: ${BLUE}anki-card-forge${NC} to launch the updated app"
echo ""
