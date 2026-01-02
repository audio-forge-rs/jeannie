# Jeannie Bitwig Controller

Version: 0.1.0

## Overview
TypeScript-based Bitwig Studio controller script that transpiles to JavaScript for Bitwig integration.

## Building
```bash
npm install
npm run build
```

## Installation

1. Build the controller: `npm run build`

2. Create vendor folder and copy controller script:

**macOS**:
```bash
mkdir -p "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS"
cp dist/jeannie.control.js "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS/"
```

**Windows**:
```cmd
mkdir "%USERPROFILE%\Documents\Bitwig Studio\Controller Scripts\Audio Forge RS"
copy dist\jeannie.control.js "%USERPROFILE%\Documents\Bitwig Studio\Controller Scripts\Audio Forge RS\"
```

**Linux**:
```bash
mkdir -p "$HOME/Bitwig Studio/Controller Scripts/Audio Forge RS"
cp dist/jeannie.control.js "$HOME/Bitwig Studio/Controller Scripts/Audio Forge RS/"
```

3. Restart Bitwig Studio

4. Add controller:
   - Settings > Controllers
   - Add Controller
   - Hardware Vendor: **Audio Forge RS**
   - Product: **Jeannie**

**IMPORTANT**: The folder name "Audio Forge RS" must match the vendor name defined in the controller script.

## Features (v0.1.0)
- Hello world initialization
- Logs connection info to Bitwig console
- Ready for integration with Jeannie web API

## Next Steps
- Add MIDI input/output handling
- Integrate with REST API for remote control
- Add device mapping and parameter control
