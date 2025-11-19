{ pkgs ? import <nixpkgs> {} }:

let
  # Use the same Node.js version as in your flake.nix
  nodejs = pkgs.nodejs_20;
  
  # Electron dependencies for NixOS
  electronDeps = with pkgs; [
    alsa-lib
    atk
    cairo
    cups
    dbus
    expat
    fontconfig
    freetype
    gdk-pixbuf
    glib
    gtk3
    libdrm
    libnotify
    libpulseaudio
    xorg.libX11
    xorg.libxcb
    xorg.libXcomposite
    xorg.libXcursor
    xorg.libXdamage
    xorg.libXext
    xorg.libXfixes
    xorg.libXi
    xorg.libXrandr
    xorg.libXrender
    xorg.libXScrnSaver
    libxtst
    nspr
    nss
    pango
    systemd
    xorg.libXtst
  ];
in
pkgs.stdenv.mkDerivation {
  pname = "anki-forge-app";
  version = "1.0.0";
  
  src = ./.;
  
  nativeBuildInputs = with pkgs; [
    nodejs
    makeWrapper
  ];
  
  buildInputs = electronDeps;
  
  # Build the application
  buildPhase = ''
    # Copy source to avoid permission issues
    cp -r $src ./source
    cd source
    
    # Install dependencies
    export HOME=$TMPDIR
    npm ci --offline
    
    # Build the application
    npm run build
    
    # Package the Electron app
    npx electron-builder --linux dir --publish never
  '';
  
  # Install the application
  installPhase = ''
    mkdir -p $out/bin
    mkdir -p $out/share/applications
    mkdir -p $out/share/icons/hicolor/256x256/apps
    
    # Copy the built application
    cp -r dist/linux-unpacked $out/share/anki-forge-app
    
    # Create a wrapper script
    makeWrapper \
      $out/share/anki-forge-app/anki-forge-app \
      $out/bin/anki-forge-app \
      --prefix LD_LIBRARY_PATH : "${pkgs.lib.makeLibraryPath electronDeps}" \
      --set ELECTRON_IS_DEV 0
    
    # Copy desktop file (will be created in next step)
    cp anki-forge-app.desktop $out/share/applications/
    
    # Copy icon (will be created in next step)
    cp icon.png $out/share/icons/hicolor/256x256/apps/
  '';
  
  meta = with pkgs.lib; {
    description = "Anki Card Forge - AI-powered flashcard generation";
    homepage = "https://github.com/your-username/anki-forge-app";
    license = licenses.mit;
    platforms = platforms.linux;
    mainProgram = "anki-forge-app";
  };
}
