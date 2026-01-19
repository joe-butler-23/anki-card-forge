# Deployment Guide

## Overview

Anki Card Forge is deployed as a **NixOS system package** that's built from the GitHub repository. When you run `anki-card-forge` from anywhere on your system, you're running a version that was built and installed via NixOS configuration.

## Architecture

```
GitHub Repository (joe-butler-23/anki-card-forge)
    ↓
NixOS Flake Input (/etc/nixos/flake.nix)
    ↓
Package Definition (/etc/nixos/modules/core/sys-apps.nix)
    ↓
Nix Store (/nix/store/.../anki-card-forge-1.0.0/)
    ↓
System PATH (/run/current-system/sw/bin/anki-card-forge)
```

## Installation Locations

- **Development**: `/home/joebutler/development/anki-forge-app/`
- **GitHub Source**: `github:joe-butler-23/anki-card-forge`
- **NixOS Config**: `/etc/nixos/`
  - Flake input: `flake.nix` line 10
  - Package build: `modules/core/sys-apps.nix` lines 58-97
  - Launcher: `modules/core/sys-apps.nix` lines 46-55
- **System Install**: `/run/current-system/sw/bin/anki-card-forge`

## Launch Methods

Two commands are available system-wide:

1. **`anki-card-forge`** - Direct launch
2. **`anki-forge-launcher`** - Launch with auto-start of Anki in scratchpad

## Deployment Workflow

### Step 1: Develop & Test Locally

```bash
cd /home/joebutler/development/anki-forge-app

# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for production
npm run build
```

### Step 2: Push to GitHub

```bash
git add .
git commit -m "Your commit message

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin main
```

### Step 3: Update NixOS System

```bash
# Update the flake to pull latest from GitHub
cd /etc/nixos
sudo nix flake lock --update-input anki-forge

# Rebuild the system with the new version
sudo nixos-rebuild switch
```

### Step 4: Verify

```bash
# Check that the symlink points to the new build
ls -la /run/current-system/sw/bin/anki-card-forge

# Launch the app
anki-card-forge
```

## Automated Update Scripts

### Quick Update (from this directory)

```bash
./scripts/update-system.sh
```

This will:
1. Update the flake lock in /etc/nixos
2. Rebuild NixOS with the new version
3. Show you the new version location

### Development → Production Pipeline

```bash
./scripts/deploy.sh
```

This will:
1. Run local build to verify
2. Commit changes (if any)
3. Push to GitHub
4. Update NixOS flake
5. Rebuild system

## Troubleshooting

### Hash Mismatch Error

If you get an error like:
```
error: hash mismatch in fixed-output derivation
  specified: sha256-PDTgyIdSCOVACAuO7uB6z8lXgXV8H8oW4o/wL90uXGA=
     got:    sha256-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX=
```

This means the npm dependencies have changed. Update the hash in `/etc/nixos/modules/core/sys-apps.nix`:

1. Copy the "got:" hash from the error
2. Edit `/etc/nixos/modules/core/sys-apps.nix` line 75
3. Replace `npmDepsHash` with the new hash
4. Commit the change to your NixOS config
5. Run `sudo nixos-rebuild switch` again

### App Not Updating

Check that the flake input is up to date:
```bash
cd /etc/nixos
nix flake metadata | grep anki-forge
```

Force update:
```bash
cd /etc/nixos
sudo nix flake lock --update-input anki-forge --refresh
sudo nixos-rebuild switch
```

### API Key Not Persisting

The API key is stored in Electron's secure storage:
- Location: `~/.config/anki-card-forge/credentials.enc` (encrypted)
- Fallback: `localStorage` in the Electron app

If secure storage fails, check:
```bash
# Check if the credentials file exists
ls -la ~/.config/anki-card-forge/

# Check electron logs
journalctl --user -u electron-anki-card-forge (if running as service)
```

## Package Definition

The app is built in `/etc/nixos/modules/core/sys-apps.nix` with:

- **Source**: GitHub flake input `anki-forge`
- **Build**: `npm run build` (runs `tsc && vite build`)
- **Runtime**: Electron with library path set for Wayland/X11 support
- **Installed files**:
  - `package.json` - Electron needs this to find the main script
  - `electron/` - Main process code
  - `dist/` - Built frontend assets
  - `prompts/` - Default AI prompts

## Development Tips

### Skip System Rebuild During Development

When actively developing, don't rebuild NixOS for every change. Instead:

```bash
# Run in dev mode (hot reload)
npm run electron:dev

# Or run the built version locally
npm run build
npm run electron:build
```

Only rebuild NixOS when you want to deploy changes system-wide.

### Check What Version Is Installed

```bash
# Show the flake revision
cd /etc/nixos
nix flake metadata | grep -A2 anki-forge

# Show the actual installed path
readlink -f /run/current-system/sw/bin/anki-card-forge
```

### Roll Back to Previous Version

NixOS keeps previous generations:

```bash
# List generations
sudo nix-env --list-generations --profile /nix/var/nix/profiles/system

# Roll back to previous generation
sudo nixos-rebuild switch --rollback

# Or switch to specific generation
sudo nix-env --switch-generation 123 --profile /nix/var/nix/profiles/system
```

## Release Checklist

When releasing a new version:

- [ ] Test locally with `npm run electron:dev`
- [ ] Build and test with `npm run build && npm run electron:build`
- [ ] Update version in `package.json` if needed
- [ ] Commit changes with descriptive message
- [ ] Push to GitHub
- [ ] Run `./scripts/update-system.sh` to deploy
- [ ] Test the system installation with `anki-card-forge`
- [ ] Verify API key persistence works
- [ ] Verify Anki connection works

## Related Files

- `flake.nix` - Local development environment definition
- `package.json` - Node.js dependencies and scripts
- `/etc/nixos/flake.nix` - System flake with GitHub input
- `/etc/nixos/modules/core/sys-apps.nix` - Package build definition
