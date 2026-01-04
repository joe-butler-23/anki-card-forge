{
  description = "Anki Card Forge - AI-powered flashcard generation application";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        lib = pkgs.lib;

        # Define Node.js version
        nodejs = pkgs.nodejs_20;

        # Runtime dependencies for Electron/GUI apps on Linux
        runtimeLibs = with pkgs; [
          libGL
          libxkbcommon
          wayland
          xorg.libX11
          xorg.libXcursor
          xorg.libXi
          xorg.libXrandr
        ] ++ (with pkgs.xorg; [ libxcb ]);

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            # Use the system electron to avoid binary incompatibility
            electron
            
            # Build tools
            nodePackages.npm
            nodePackages.typescript
            
            # Tools
            git
            curl
            jq
            pkg-config
          ];

          # Environment variables
          shellHook = ''
            echo "🚀 Anki Card Forge Development Environment"
            echo "Node: $(node --version) | NPM: $(npm --version)"

            # 1. Tell Electron builder to use the system electron binary
            export ELECTRON_OVERRIDE_DIST_PATH="${pkgs.electron}/bin"
            
            # 2. Fix specific specific libraries for Electron/Vite
            export LD_LIBRARY_PATH="${lib.makeLibraryPath runtimeLibs}:$LD_LIBRARY_PATH"
            
            # 3. Stop npm from downloading the incompatible electron binary
            export ELECTRON_SKIP_BINARY_DOWNLOAD=1

            echo ""
            echo "To get started:"
            echo "1. npm install"
            echo "2. npm run electron:dev"
          '';
        };

        # Build the package using npm instead of yarn
        packages.default = let
          apiKey = if builtins.pathExists ./.env.local then
            builtins.readFile ./.env.local
          else
            "";
        in pkgs.buildNpmPackage {
          pname = "anki-card-forge";
          version = "1.0.0";
          src = ./.;

          npmDepsHash = "sha256-rOXt+X6P3JMoT2ppOEuCDTt/3t5xl1NTXZz4hESxAco=";

          nativeBuildInputs = [ pkgs.pkg-config pkgs.makeWrapper ];
          buildInputs = [ pkgs.vips ];

          env = {
            ELECTRON_SKIP_BINARY_DOWNLOAD = 1;
          };

          installPhase = ''
            runHook preInstall
            # This runs 'tsc && vite build'
            npm run build

            # Create the directory structure in the output path
            mkdir -p $out/share/anki-card-forge

            # Copy only the necessary production files:
            # - package.json: Needed by Electron to find the main script.
            # - electron/: Contains the Electron main process entrypoint.
            # - dist/: Contains the compiled frontend assets.
            # - prompts/: Contains default prompts for first run.
            cp package.json $out/share/anki-card-forge/
            cp -r electron dist prompts $out/share/anki-card-forge/

            # Create the binary wrapper
            mkdir -p $out/bin
            makeWrapper ${pkgs.electron}/bin/electron $out/bin/anki-card-forge \
              --add-flags "$out/share/anki-card-forge" \
              --prefix LD_LIBRARY_PATH : "${lib.makeLibraryPath runtimeLibs}" \
              --set-default VITE_API_KEY "${apiKey}"

            runHook postInstall
          '';
        };
      });
}
