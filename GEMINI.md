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

## Making & Deploying Changes

This section outlines the recommended workflow for making changes to the application, from development to a system-wide installation.

### Step 1: Make Code Changes
Make any desired changes to the application's source code.

### Step 2: Test in Development Mode
It is highly recommended to test your changes in the development environment before deploying them.

1.  **Enter the Nix development shell**:
    ```bash
    nix develop
    ```
2.  **Run the app in dev mode**:
    ```bash
    npm run electron:dev
    ```
This will launch the application with hot-reloading, allowing you to see your changes in real-time.

### Step 3: Commit Your Changes
For reproducible builds and to avoid "dirty tree" warnings from Nix, it is best practice to commit your changes to Git before building.

1.  **Stage your changes**:
    ```bash
    git add .
    ```
2.  **Commit your changes**:
    ```bash
    git commit -m "Your descriptive commit message"
    ```

### Step 4: Build and Install the New Version

Once you are satisfied with your changes and have committed them, you can build and install the new version of the application declaratively.

**Declarative Installation (Recommended):**

For a system-wide, declarative installation, you should incorporate the `anki-forge-app` flake into your NixOS `configuration.nix` or Home Manager `home.nix` file.

*   **For NixOS (e.g., in `configuration.nix`):**
    ```nix
    { config, pkgs, ... }:

    {
      nix.settings.experimental-features = [ "nix-command" "flakes" ];

      inputs.anki-forge-app.url = "github:your-github-user/anki-forge-app"; # or your local path
      # inputs.anki-forge-app.url = "/path/to/your/anki-forge-app"; # For local development

      environment.systemPackages = with pkgs; [
        inputs.anki-forge-app.packages.${pkgs.system}.default
      ];
    }
    ```
    Then, rebuild your system: `sudo nixos-rebuild switch`

*   **For Home Manager (e.g., in `home.nix`):**
    ```nix
    { config, pkgs, ... }:

    {
      nix.settings.experimental-features = [ "nix-command" "flakes" ];

      inputs.anki-forge-app.url = "github:your-github-user/anki-forge-app"; # or your local path
      # inputs.anki-forge-app.url = "/path/to/your/anki-forge-app"; # For local development

      home.packages = with pkgs; [
        inputs.anki-forge-app.packages.${pkgs.system}.default
      ];
    }
    ```
    Then, switch your Home Manager configuration: `home-manager switch`

**Local Build for Testing:**

To simply build the application and test the resulting artifact without affecting your system-wide installation:

```bash
nix build
```
This command compiles the application and places the output in a local `result` symlink (e.g., `./result/bin/anki-card-forge`). You can run it directly from there.

## Core Logic for Card Generation

The main logic for generating and processing card types is spread across a few key files:

1.  **`types.ts`**: The `CardType` enum defines the valid, known card types for the entire application.
2.  **`models/schemas.ts`**: The `cardSchema` defines the structure the AI is expected to return, including the allowed `cardType` values.
3.  **`services/geminiService.ts`**: The `generateFlashcards` function calls the Gemini API. The `normalizeCardType` function within this file is crucial for cleaning the AI's output and mapping it to a valid `CardType` enum, preventing errors from minor string variations.
4.  **`services/ankiConnectService.ts`**: The `addNotesToAnki` function takes the processed `Flashcard` objects and maps their `cardType` to the correct Anki note type (`modelName`) and fields before sending them to Anki.

## Troubleshooting Common Build & Development Issues

This section documents common issues encountered during development and building, along with their solutions.

### 1. Missing Features in Production Builds (`nix build`)

**Problem**: Features or recent code changes appear in the development environment (`npm run electron:dev`) but are missing from the application built with `nix build`.

**Cause**: The `installPhase` in `flake.nix` was not copying all necessary source files and directories into the final package. `nix build` only includes what's explicitly copied.

**Solution**: Ensure the `installPhase` in `flake.nix` explicitly copies all required application source files and directories (e.g., `App.tsx`, `components/`, `services/`, `models/`, `types.ts`, `constants.ts`, etc.) into the `$out/share/anki-card-forge` directory.

### 2. TypeScript Build Errors (`TS2717`)

**Problem**: Running `npm run build` results in TypeScript errors like `TS2717: Subsequent property declarations must have the same type`, often pointing to files within the `result` directory.

**Cause**: The TypeScript compiler (`tsc`) is attempting to compile files from both the project's source directory and previously built artifacts (e.g., from `nix build` output in the `result` directory). This happens when `tsconfig.json` doesn't explicitly exclude these directories.

**Solution**: Add or update the `exclude` property in `tsconfig.json` to ignore `node_modules` and the `result` directory:
```json
{
  "compilerOptions": {
    // ...
  },
  "exclude": ["node_modules", "result"]
}
```

### 3. Developer Tools Not Opening in Dev Mode

**Problem**: Developer tools (`Ctrl+Shift+I` / `Cmd+Option+I`) do not open when running the application in development mode (`npm run electron:dev`).

**Cause**: The `electron/main.js` file conditionally opens developer tools based on `process.env.NODE_ENV === 'development'`, but the `electron:dev` script in `package.json` was not correctly setting this environment variable for the Electron process.

**Solution**:
*   **Enable DevTools in `electron/main.js`**: Ensure the line `win.webContents.openDevTools();` is uncommented within the `if (isDev)` block.
*   **Set `NODE_ENV` in `package.json`**: Modify the `electron:dev` script to explicitly set `NODE_ENV=development` for the Electron command:
    ```json
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && NODE_ENV=development electron .\""
    ```

### 4. Nix Build (`nix build`) vs. Nix Profile Install (`nix profile install '.#'`)

**Distinction**:
*   **`nix build`**: Compiles the application and places the output in a local `result` symlink. This is primarily for **testing** the build artifact without affecting your system-wide environment.
*   **`nix profile install '.#'`**: Builds the package (if necessary) and then creates symlinks in your user's Nix profile (`~/.nix-profile/bin`) to make the application available system-wide (e.g., via desktop shortcuts or by typing its name in the terminal). This is for **installing/updating** the application for general use.

**Workflow**: To update the system-wide version of the application (e.g., after making changes and verifying them in dev mode), run `nix profile install '.#'` from the project root.

### 5. Stale Node.js Dependencies (`npmDepsHash`)

**Problem**: Unexpected build failures or behavior, even after `npm install` and `npm run build` seem successful, potentially related to Node.js dependencies.

**Cause**: The `npmDepsHash` in `flake.nix` might be stale, causing Nix to use an outdated cache of Node.js dependencies.

**Solution**:
1.  Temporarily set `npmDepsHash = "";` in `flake.nix`.
2.  Run `nix build`. It will fail, but the error message will provide the correct, updated `sha256-...` hash.
3.  Replace `npmDepsHash = "";` with the correct hash provided in the error message.
4.  Run `nix build` again.

