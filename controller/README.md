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
2. Copy `dist/jeannie.control.js` to your Bitwig controller scripts folder:
   - macOS: `~/Documents/Bitwig Studio/Controller Scripts/`
   - Windows: `%USERPROFILE%\Documents\Bitwig Studio\Controller Scripts\`
   - Linux: `~/Bitwig Studio/Controller Scripts/`

3. Restart Bitwig Studio
4. Go to Settings > Controllers
5. Add "Jeannie Controller"

## Features (v0.1.0)
- Hello world initialization
- Logs connection info to Bitwig console
- Ready for integration with Jeannie web API

## Next Steps
- Add MIDI input/output handling
- Integrate with REST API for remote control
- Add device mapping and parameter control
