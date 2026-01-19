#!/usr/bin/env bash
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  Anki Card Forge - Full Deployment${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Check if we're in the right directory
cd "$PROJECT_DIR"
if [[ ! -f "package.json" ]] || ! grep -q "anki-card-forge" package.json; then
    echo -e "${RED}✗ Error: package.json not found or invalid${NC}"
    exit 1
fi

# Step 1: Run local build to verify
echo -e "${BLUE}→ Step 1: Building locally to verify...${NC}"
if npm run build 2>&1 | tail -5; then
    echo -e "${GREEN}✓ Local build successful${NC}"
else
    echo -e "${RED}✗ Local build failed. Fix errors before deploying.${NC}"
    exit 1
fi
echo ""

# Step 2: Check git status
echo -e "${BLUE}→ Step 2: Checking git status...${NC}"
if [[ -z $(git status --porcelain) ]]; then
    echo -e "${YELLOW}  No changes to commit${NC}"
    SKIP_COMMIT=true
else
    echo -e "${YELLOW}  Changes detected:${NC}"
    git status --short
    SKIP_COMMIT=false
fi
echo ""

# Step 3: Commit changes (if any)
if [[ "$SKIP_COMMIT" == false ]]; then
    echo -e "${BLUE}→ Step 3: Committing changes...${NC}"
    echo -e "${YELLOW}Enter commit message (or press Ctrl+C to abort):${NC}"
    read -r COMMIT_MSG

    if [[ -z "$COMMIT_MSG" ]]; then
        echo -e "${RED}✗ Empty commit message. Aborting.${NC}"
        exit 1
    fi

    git add -A
    git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
    echo -e "${GREEN}✓ Changes committed${NC}"
    echo ""
else
    echo -e "${BLUE}→ Step 3: Skipping commit (no changes)${NC}"
    echo ""
fi

# Step 4: Push to GitHub
echo -e "${BLUE}→ Step 4: Pushing to GitHub...${NC}"
CURRENT_BRANCH=$(git branch --show-current)
if git push origin "$CURRENT_BRANCH"; then
    echo -e "${GREEN}✓ Pushed to origin/$CURRENT_BRANCH${NC}"
else
    echo -e "${RED}✗ Failed to push to GitHub${NC}"
    exit 1
fi
echo ""

# Step 5: Update NixOS system
echo -e "${BLUE}→ Step 5: Updating NixOS system...${NC}"
echo -e "${YELLOW}  This will update the flake and rebuild NixOS...${NC}"
echo ""

# Run the update-system script
if bash "$SCRIPT_DIR/update-system.sh"; then
    echo -e "${GREEN}✓ System updated successfully${NC}"
else
    echo -e "${RED}✗ System update failed${NC}"
    exit 1
fi

# Step 6: Done
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Deployment Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "Summary:"
echo -e "  • Local build: ${GREEN}✓${NC}"
echo -e "  • GitHub push: ${GREEN}✓${NC}"
echo -e "  • System update: ${GREEN}✓${NC}"
echo ""
echo -e "Run: ${BLUE}anki-card-forge${NC} to launch the updated app"
echo ""
