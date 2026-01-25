# App Icon Requirements

For professional cross-platform distribution, the app needs platform-specific icon formats.

## Required Icon Files

### macOS (.icns)
- **File**: `icon.icns`
- **Location**: `build-assets/`
- **Requirements**: Multi-resolution icon set (16x16 to 1024x1024)
- **Tool**: Use `iconutil` on macOS or online converters

### Windows (.ico)
- **File**: `icon.ico`
- **Location**: `build-assets/`
- **Requirements**: Multi-resolution (16x16, 32x32, 48x48, 256x256)
- **Tool**: GIMP, ImageMagick, or online converters

### Linux (.png)
- **File**: `icon.png`
- **Location**: `build-assets/`
- **Requirements**: 512x512 or 256x256 PNG with transparency
- **Format**: Standard PNG

## Creating Icons from Existing Assets

The project has `assets/anki-card-forge-banner.png` which could serve as a base. However:

1. Banners are typically wide/rectangular - icons should be square
2. You may need to crop or redesign for a square aspect ratio
3. Icons should be simple and recognizable at small sizes (16x16)

## Temporary Solution

Until proper icons are created, electron-builder will use default Electron icons. This is fine for testing but should be updated before public release.

## Adding Icons to Build

Once icons are created, update `package.json` build config:

```json
"build": {
  "appId": "com.joebutler.ankicardforge",
  "productName": "Anki Card Forge",
  "icon": "build-assets/icon.png",
  "mac": {
    "icon": "build-assets/icon.icns"
  },
  "win": {
    "icon": "build-assets/icon.ico"
  }
}
```

## Recommended Tools

- **Online**: [CloudConvert](https://cloudconvert.com/), [ICO Convert](https://icoconvert.com/)
- **CLI**: ImageMagick, `iconutil` (macOS)
- **Design**: Figma, GIMP, Photoshop
