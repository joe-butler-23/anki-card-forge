<div align="center">
<img width="60%"alt="GHBanner" src="assets/anki-card-forge-banner.png" />
</div>


**Anki Card Forge** uses AI to transform rough notes/study materials/random screenshots into high-quality, structured Anki flashcards. If you are not familiar with Anki, it is a spaced repetition tool that helps you remember things (there are lots of good resources on it online - see https://augmentingcognition.com/ltm.html). Anki is a much-used and much-loved app and there are lots of different views regarding the best or most effective way to use it. For me, Anki has always been a tool for _remembering_ things rather than learning them (if you don't understand a topic, then reviewing flashcards on it is unlikely to be helpful). And `Anki Card Forge` is simply a way of turning things you've learned into nicely formatted flashcards with minimal effort. 

To be very clear up front, this app is entirely AI-generated (down to the slightly rubbish name). The initial draft was done with Google AI Studio (which is why it it set up to work with Gemini) and was then refined a bit with Claude Code. I have been using this myself for a couple months now without any real issues. In general, I have found that Google's AI Studio does decent job, especially if you then run the app through a couple of code reviews. But if you hate AI slop, or if you have concerns with AI-generated code etc. then this is obviously not the app for you!

## Features

Anki Card Forge is built to produce high-quality flashcards and then sync them to Anki using the AnkiConnect API. It makes use of lots of custom prompting (which you can edit), which I have refined over the last couple years of trying to get AI to produce decent flashcards. It incorporates lessons learned from lots of very clever people (Michael Nielsen, already linked above, is an excellent resource on spaced repetition, this article https://disputant.medium.com/how-to-make-better-anki-flashcards-principles-for-high-yield-questions-d58cc7244a7c provides a good overview too). Parts of these prompts will be tailored specifically to me (i.e. regarding formatting), but I think some of the included principles are useful for everyone (i.e. make flashcards atomic, avoid yes/no answers) but it is up to you if you want to delete them entirely and do your own thing. 

Where I think this app delivers real value over just asking an AI to generate loads of cards for you is: syncs seamelssly via AnkiConnect, and (even better) it gives you a review pane so you can approve/reject/edit suggested cards and filter out any rubbish suggestions. 

| Feature | Description | Benefit |
| :--- | :--- | :--- |
| **AI-Powered Generation** | Uses the Gemini API to generate structured flashcards from unstructured text notes. | Converts hours of manual card creation into minutes. |
| **Topic Optimization** | Includes specialized (handcrafter) AI prompts for General, Math/Science (with LaTeX support), Vocabulary, and Programming. | Ensures cards are formatted correctly and follow best practices for specific subjects. |
| **Multimodal Support** | Ability to upload images alongside notes for card generation. | Create cards from diagrams, charts, and visual content, or random screenshots from Youtube videos. |
| **Deep Thinking Mode** | An optional mode that engages extended AI reasoning for complex or ambiguous topics. | Improves the quality and accuracy of cards for challenging material (but can take ages). |
| **Direct Anki Sync** | Instantly sends approved cards to your running Anki instance via AnkiConnect. | Eliminates manual export/import steps. |
| **Review & Edit Workflow** | Provides a dedicated interface to review, edit, and approve each generated card before syncing. | Maintains quality control over your study material. |

## Getting Started

### Prerequisites

Before using Anki Card Forge, ensure you have the following:

1.  **Anki** with the **[AnkiConnect](https://ankiweb.net/shared/info/2055492159)** add-on installed and running (AnkiConnect requires Anki to be running)
2.  **Gemini API Key** - Obtain a key from **[Google AI Studio](https://aistudio.google.com/apikey)**.

### Installation

Anki Card Forge is an Electron app, so it will hopefully work across platforms. I have only thoroughly tested on my own LInux machine.

#### Option 1: Pre-built Binaries (Recommended for Users)

The easiest way to get started is by downloading the pre-built application for your platform from the **[Releases](https://github.com/joe-butler-23/anki-card-forge/releases)** page.

| Platform | File Type | Installation Instructions |
| :--- | :--- | :--- |
| **Windows** | `.exe` | Download and run the installer. |
| **macOS** | `.dmg` | Download, open the disk image, and drag the application to your Applications folder. |
| **Linux** | `.AppImage` | Download, make the file executable (`chmod +x Anki-Card-Forge-*.AppImage`), and run it. |

#### Option 2: Build from Source

For users who prefer to build the application themselves:

**1. Clone the Repository**

```bash
git clone https://github.com/joe-butler-23/anki-card-forge.git
cd anki-card-forge
```

**2. Install Dependencies**

Anki Card Forge is built with Node.js, React, and TypeScript.

```bash
npm install
```

**3. Configure Your API Key**

Launch the app and open **Settings** to enter your Gemini API key. The key is stored securely using Electron's `safeStorage`.

For development automation, you can also provide the key via environment variables:

```bash
# Either variable works for the Electron main process
export GEMINI_API_KEY="your_gemini_api_key_here"
# or
export API_KEY="your_gemini_api_key_here"
```

**4. Build and Run**

To create a production-ready build and launch the application:

```bash
# Build the React frontend and Electron main process
npm run build

# Run the application using the local Electron dependency
npm run electron:build
```

#### Option 3: Nix Flakes (For NixOS/Nix Users)

I run Nix, so have been using it via the provided `flake.nix`.

**Development Shell:**
```bash
nix develop
npm install
npm run electron:dev
```

**Build and Install:**
```bash
nix build
# Or add to your NixOS configuration - see docs/DEPLOYMENT.md
```

## Deployment

For NixOS users deploying this as a system package, see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for complete documentation.

**Quick deployment:**
```bash
# After making changes, deploy to your system
./scripts/deploy.sh
```

**Update system with latest from GitHub:**
```bash
# Pull and rebuild without making local changes
./scripts/update-system.sh
```

See [scripts/README.md](scripts/README.md) for detailed script documentation.

### Initial Setup

1.  Launch Anki Card Forge.
2.  Click the **Settings** icon (gear) in the header.
3.  Enter your **Gemini API Key** in the designated field.
4.  Ensure Anki is running with AnkiConnect enabled (the app only connects to localhost).
5.  Click **Save & Connect** to verify that the application can communicate with Anki.

## Usage Workflow

1.  **Select a Topic**: Choose the most relevant topic type (e.g., General, Math/Science) to optimize the AI's output.
2.  **Enter Notes**: Paste or type your study material into the notes area.
3.  **Generate**: Click "Forge Cards" to send your notes to the Gemini AI.
4.  **Review**: A list of generated cards will appear. Review, edit, or reject each card as needed.
5.  **Sync**: Click the sync button to send all approved cards directly to your selected Anki deck.

## Privacy & Security

Bearing in mind the warnings about the API generated content above, the app uses the following approaches to reduce risk (without any guarantees):

- **Secure API Key Storage**: Your Gemini API key is stored using Electron's `safeStorage` API, which leverages your operating system's native credential manager (e.g., macOS Keychain, Windows Credential Manager). The key is encrypted at rest.
- **No API Key in Renderer**: Gemini API calls are executed in the Electron main process to avoid exposing the key to renderer content.
- **HTML Sanitization**: AI-generated content is sanitized with `DOMPurify` before rendering and before syncing to Anki.
- **Local Asset Loading**: MathJax is bundled locally to avoid remote script execution.
- **CSP in Renderer**: A restrictive Content Security Policy limits script, connection, and asset sources.

And of course, you always have the option to go through the code yourself. 

## Contributing

I have got this app to the point where it works for my purposes and I do not really see it as being in active development. I would look at any serious bugs or usability/accessibility concerns, but for big feature requests or similar I would suggest forking and trying to add them yourself. 

## License

Anki Card Forge is released under the **MIT License**. See the [LICENSE](LICENSE) file for details.
