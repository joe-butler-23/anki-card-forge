# Gemini Agent Instructions for Anki Card Forge

This document provides instructions for interacting with the Anki Card Forge codebase.

## Project Overview

Anki Card Forge is an Electron application built with React and TypeScript. It uses the Google Gemini API to generate Anki flashcards from user notes and sends them to a running Anki instance via the AnkiConnect addon. The project is managed using Nix flakes for dependency management and building.

## Tech Stack

-   **Frontend**: React, TypeScript, Vite
-   **Desktop Framework**: Electron
-   **Styling**: Tailwind CSS
-   **Environment & Build**: Nix (Flakes), Node.js, npm

## Key Directories

-   `App.tsx`: The main React component and UI layout.
-   `components/`: React components for the UI.
-   `electron/`: Main process code for Electron.
-   `services/`: Contains the core application logic.
    -   `geminiService.ts`: Handles all interaction with the Google Gemini API.
    -   `ankiConnectService.ts`: Handles all interaction with the AnkiConnect API.
-   `models/`: Defines the JSON schemas for AI responses.
-   `prompts/`: System prompts for the AI.
-   `types/`: Shared TypeScript types and enums (e.g., `CardType`).
-   `flake.nix`: The heart of the project's dependency and build management.

## Development Workflow

The primary development workflow uses a Nix development shell.

1.  **Enter the Development Shell**:
    This command sets up an environment with all necessary tools (Node.js, Electron, etc.).
    ```bash
    nix develop
    ```

2.  **Install Dependencies**:
    Inside the Nix shell, install the Node.js packages.
    ```bash
    npm install
    ```

3.  **Run the App in Dev Mode**:
    This command starts the Vite dev server and launches Electron in a hot-reloading environment.
    ```bash
    npm run electron:dev
    ```

## Building the Application

To create a production-ready, standalone build of the application:

1.  **Build with Nix**:
    ```bash
    nix build
    ```
    This command compiles the application and places the output in a `result` symlink.

2.  **Run the Built App**:
    ```bash
    ./result/bin/anki-card-forge
    ```

**Note on API Keys**: The build process defined in `flake.nix` will attempt to embed an API key from a `.env.local` file into the final executable. For the build to be fully functional, ensure this file exists before running `nix build`.

## Core Logic for Card Generation

The main logic for generating and processing card types is spread across a few key files:

1.  **`types.ts`**: The `CardType` enum defines the valid, known card types for the entire application.
2.  **`models/schemas.ts`**: The `cardSchema` defines the structure the AI is expected to return, including the allowed `cardType` values.
3.  **`services/geminiService.ts`**: The `generateFlashcards` function calls the Gemini API. The `normalizeCardType` function within this file is crucial for cleaning the AI's output and mapping it to a valid `CardType` enum, preventing errors from minor string variations.
4.  **`services/ankiConnectService.ts`**: The `addNotesToAnki` function takes the processed `Flashcard` objects and maps their `cardType` to the correct Anki note type (`modelName`) and fields before sending them to Anki.
