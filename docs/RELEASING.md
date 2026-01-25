# Release Process

This document outlines how to create and publish releases of Anki Card Forge.

## Overview

Releases are automated via GitHub Actions. When you push a version tag, the workflow builds cross-platform binaries (Windows .exe, macOS .dmg, Linux .AppImage) and uploads them to GitHub Releases as a draft.

## Creating a Release

### 1. Prepare the Release

Ensure all changes are committed and the app is in a releasable state:

```bash
# Run a local test build
npm run package

# Test the packaged app from release/ directory
# On Linux: ./release/Anki-Card-Forge-*.AppImage
# On macOS: open release/mac/Anki\ Card\ Forge.app
# On Windows: release/Anki Card Forge Setup *.exe
```

### 2. Update Version

Update the version in `package.json`:

```bash
# Example: updating to version 1.0.1
npm version 1.0.1
```

Or manually edit `package.json` and commit:

```json
{
  "version": "1.0.1"
}
```

### 3. Create and Push Tag

```bash
# Create tag (must start with 'v')
git tag v1.0.1

# Push tag to trigger release workflow
git push origin v1.0.1
```

### 4. Monitor Build

1. Go to your repository on GitHub
2. Click the "Actions" tab
3. Watch the "Release" workflow run
4. The workflow builds on Windows, macOS, and Linux in parallel
5. Takes approximately 10-15 minutes per platform

### 5. Review and Publish Draft

1. Go to the "Releases" page on GitHub
2. Find the new draft release created by the workflow
3. Review the attached binaries:
   - `Anki-Card-Forge-Setup-*.exe` (Windows)
   - `Anki-Card-Forge-*.dmg` (macOS)
   - `Anki-Card-Forge-*.AppImage` (Linux)
4. Edit release notes if needed
5. Click "Publish release"

## Platform-Specific Notes

### macOS Code Signing

**Current State**: Unsigned

macOS builds are currently **not code-signed**, which means users will see a Gatekeeper warning on first launch:

> "Anki Card Forge.app cannot be opened because the developer cannot be verified"

**User Workaround**:
- Right-click the app → "Open"
- Click "Open" in the security dialog
- App will open and be trusted for future launches

**Future Improvement**:
To eliminate this warning, you need:
1. Apple Developer account ($99/year)
2. Developer ID certificate
3. Update workflow to sign with `electron-builder` and `@electron/osx-sign`

See: https://www.electron.build/code-signing#mac

### Windows Code Signing

Windows builds are also unsigned. Users may see SmartScreen warnings. Similar to macOS, code signing requires:
1. Code signing certificate (from DigiCert, Sectigo, etc.)
2. Certificate configured in GitHub secrets
3. Updated workflow

### Linux

AppImage files don't require signing and work universally across distributions.

## Testing Releases Locally

Before pushing a tag, test the full build locally:

```bash
# Clean previous builds
rm -rf release/

# Build for your current platform
npm run package

# The binaries will be in release/
ls -lh release/
```

To build for all platforms (requires Docker or multiple machines):

```bash
# Build for all platforms
electron-builder -mwl
```

## Troubleshooting

### Build Fails on GitHub Actions

- Check the Actions logs for specific errors
- Common issues:
  - Missing dependencies in package.json
  - Files not included in build config
  - Platform-specific build errors

### Binary Doesn't Run

- Ensure all runtime files are included in `package.json` → `build.files`
- Test locally with `npm run package` first
- Check that `dist/`, `electron/`, and `src/prompts/` are properly included

### Wrong Version Number

If you pushed the wrong tag:

```bash
# Delete local tag
git tag -d v1.0.1

# Delete remote tag
git push origin :refs/tags/v1.0.1

# Delete the draft release on GitHub
# Then create the correct tag
```

## Release Checklist

- [ ] All changes committed and pushed
- [ ] Version updated in package.json
- [ ] Local build tested (`npm run package`)
- [ ] Tag created and pushed (`git tag v* && git push origin v*`)
- [ ] GitHub Actions workflow completed successfully
- [ ] Draft release reviewed on GitHub
- [ ] Release notes added/edited
- [ ] All platform binaries present and tested
- [ ] Release published

## Versioning

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (1.1.0): New features, backwards compatible
- **PATCH** (1.0.1): Bug fixes, backwards compatible
