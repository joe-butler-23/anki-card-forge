<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Anki Card Forge

AI-powered flashcard generation application for Anki.

## Run Locally (Standard)

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app: `npm run dev`

## Nix Development

### Quick Start

```bash
# Enter dev shell (has node, electron, etc.)
nix develop

# Install npm deps (first time only)
npm install

# Run in development mode
npm run build && electron .

# Or with dev tools open
npm run build && NODE_ENV=development electron .
```

### Building the Package

```bash
# Build the Nix package
nix build

# Test the built package
./result/bin/anki-card-forge
```

### Updating NixOS System Install

If you have anki-card-forge in your NixOS system configuration as a flake input:

```bash
# 1. Commit and push your changes
git add -A && git commit -m "Your changes"
git push

# 2. Update the flake lock in your NixOS config
sudo nix flake update anki-forge --flake /etc/nixos

# 3. Rebuild
sudo nixos-rebuild switch
```

#### Testing local changes without pushing

```bash
# Override the flake input temporarily
sudo nix flake lock --override-input anki-forge path:/path/to/anki-forge-app --flake /etc/nixos
sudo nixos-rebuild switch
```

### Troubleshooting

**`nix develop` is slow / building from source:**

The flake uses `nixos-24.11` stable for good binary cache coverage. If builds are slow:

```bash
# Update flake inputs to get cached versions
nix flake update
```

**Electron binary errors (missing .so files):**

Don't use `npx electron` directly on NixOS. Always run electron via the dev shell:

```bash
nix develop -c electron .
```

**Preload script errors ("Cannot use import statement"):**

The preload script (`electron/preload.js`) must use CommonJS syntax (`require`) not ES modules (`import`).
