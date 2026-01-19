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
if sudo nixos-rebuild switch 2>&1 | tee /tmp/nixos-rebuild.log; then
    echo -e "${GREEN}✓ NixOS rebuilt successfully${NC}"
else
    echo -e "${RED}✗ Failed to rebuild NixOS${NC}"
    echo ""
    echo -e "${YELLOW}Common issues:${NC}"
    echo "  • Hash mismatch: Update npmDepsHash in modules/core/sys-apps.nix"
    echo "  • Build failure: Check /tmp/nixos-rebuild.log for details"
    echo ""

    # Check for hash mismatch
    if grep -q "hash mismatch" /tmp/nixos-rebuild.log; then
        echo -e "${YELLOW}Detected hash mismatch. The correct hash is:${NC}"
        grep "got:" /tmp/nixos-rebuild.log | tail -1
        echo ""
        echo "Update it in: $NIXOS_CONFIG_DIR/modules/core/sys-apps.nix (line ~75)"
    fi

    exit 1
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
