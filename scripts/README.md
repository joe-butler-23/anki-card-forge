# Deployment Scripts

This directory contains automation scripts for deploying Anki Card Forge to your NixOS system.

## Scripts

### `update-system.sh`

Updates your NixOS system with the latest version from GitHub.

**What it does:**
1. Shows current flake version
2. Updates the flake lock for `anki-forge` input
3. Rebuilds NixOS with the new version
4. Verifies the installation
5. Shows helpful error messages if something goes wrong

**Usage:**
```bash
./scripts/update-system.sh
```

**When to use:**
- After pushing changes to GitHub
- When you want to pull the latest version to your system
- When testing deployment without making new changes

---

### `deploy.sh`

Full deployment pipeline: build, commit, push, and update system.

**What it does:**
1. Runs local build to verify everything compiles
2. Checks for uncommitted changes
3. Prompts for commit message (if changes exist)
4. Commits with Claude co-author tag
5. Pushes to GitHub
6. Runs `update-system.sh` to deploy to your system

**Usage:**
```bash
./scripts/deploy.sh
```

**When to use:**
- After making changes you want to deploy
- For quick iteration: develop → deploy → test
- When you want the full pipeline automated

**Interactive:**
- Will prompt for commit message if there are changes
- Press Ctrl+C to abort at any time

---

## Common Workflows

### Quick Development Iteration

```bash
# Make your changes, then:
./scripts/deploy.sh
```

### Pull Latest Without Committing

```bash
# If someone else pushed changes, or you pushed from another machine:
./scripts/update-system.sh
```

### Development Mode (No Deploy)

```bash
# For active development with hot reload:
npm run electron:dev
```

### Local Testing Before Deploy

```bash
# Build and run locally:
npm run build
npm run electron:build
```

## Troubleshooting

### Hash Mismatch Error

If you get a hash mismatch error, the scripts will show you the correct hash. Update it in `/etc/nixos/modules/core/sys-apps.nix` line ~75.

### Permission Denied

Scripts need sudo access to update `/etc/nixos`. Make sure your user has sudo privileges.

### Build Failures

Check the logs in `/tmp/nixos-rebuild.log` for detailed error messages.

### Git Push Failures

Ensure you have:
- Configured git credentials
- Push access to the repository
- Network connection

## Script Output

Both scripts use color-coded output:
- 🔵 Blue: Information and steps
- 🟢 Green: Success messages
- 🟡 Yellow: Warnings and prompts
- 🔴 Red: Errors

## Advanced Usage

### Skip Rebuild (Update Flake Only)

```bash
cd /etc/nixos
sudo nix flake lock --update-input anki-forge
# Don't run nixos-rebuild switch yet
```

### Force Refresh Flake

```bash
cd /etc/nixos
sudo nix flake lock --update-input anki-forge --refresh
sudo nixos-rebuild switch
```

### Check What Will Be Built

```bash
cd /etc/nixos
sudo nixos-rebuild dry-build
```

## Integration

You can integrate these scripts into your workflow:

### Keybind in Hyprland

Add to your Hyprland config:
```bash
bind = $mainMod SHIFT, D, exec, kitty -e bash -c "cd /home/joebutler/development/anki-forge-app && ./scripts/deploy.sh; read"
```

### Git Alias

Add to your `.gitconfig`:
```ini
[alias]
    deploy = !bash scripts/deploy.sh
    update-sys = !bash scripts/update-system.sh
```

Then use:
```bash
git deploy
git update-sys
```

### Zsh Function

Add to your `.zshrc`:
```bash
anki-deploy() {
    cd /home/joebutler/development/anki-forge-app && ./scripts/deploy.sh
}

anki-update() {
    cd /home/joebutler/development/anki-forge-app && ./scripts/update-system.sh
}
```

## See Also

- `../DEPLOYMENT.md` - Comprehensive deployment documentation
- `../README.md` - Project overview
- `/etc/nixos/modules/core/sys-apps.nix` - NixOS package definition
