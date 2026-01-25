# Changelog

All notable changes to Anki Card Forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-25

### Added
- Initial release of Anki Card Forge
- AI-powered flashcard generation using Gemini API (Flash and Pro models)
- Topic-specific prompt optimization (General, Math/Science, Vocabulary, Programming)
- Deep thinking mode for complex topics with extended reasoning
- Direct AnkiConnect integration for seamless sync
- Review and edit workflow for quality control
- Multimodal support for image-based card generation
- Secure API key storage using Electron safeStorage
- HTML sanitization with DOMPurify
- Local MathJax bundling for LaTeX rendering
- Cross-platform builds (Windows, macOS, Linux)

### Platform Support
- Windows: NSIS installer (.exe)
- macOS: DMG disk image (unsigned - requires right-click Open on first launch)
- Linux: AppImage (no installation required)

### Documentation
- Comprehensive README with setup and usage instructions
- Release procedures documented in docs/RELEASING.md
- NixOS deployment guide in docs/DEPLOYMENT.md
- Gemini API setup in docs/GEMINI.md
