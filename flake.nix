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
        packages.default = pkgs.buildNpmPackage {
          pname = "anki-card-forge";
          version = "1.0.0";
          src = ./.;

          # This is required for buildNpmPackage. 
          # On the first run, set this to lib.fakeHash, run the build, 
          # and copy the actual hash from the error message.
          npmDepsHash = "sha256-AqpLoEb8WSSsbTgxFyUtXu7R3nOvO9L2eEWsqSwEu88=";

          # Libraries required for the build process
          nativeBuildInputs = [ pkgs.pkg-config ];
          buildInputs = [ pkgs.vips ]; # Common image processing dep for Vite apps

          # Environment variables for the build
          env = {
            ELECTRON_SKIP_BINARY_DOWNLOAD = 1;
          };

          installPhase = ''
            runHook preInstall
            npm run build
            mkdir -p $out/share/anki-card-forge
            cp -r dist/* $out/share/anki-card-forge/
            runHook postInstall
          '';
        };
      });
}
