# Jeannie

A Bitwig Studio controller ecosystem with web interface and CLI tools.

**Vendor**: Audio Forge RS
**Version**: 0.10.0
**Status**: Active Development

## Components

### Jeannie (Bitwig Controller)
TypeScript controller script for Bitwig Studio with real-time connection tracking.

### Web Server & API
Node.js/Express server providing:
- REST API for status, configuration, and version info
- Real-time web UI dashboard
- Connection status tracking for Bitwig
- YAML config file watching (`/tmp/jeannie-config.yaml`)

### Jeannie CLI
Unified TypeScript command-line tool for:
- Bitwig control (health, status, tracks, content search)
- ABC notation → MIDI composition workflow
- Full REST API access

## Quick Start

```bash
# Install dependencies
npm install

# Build all components
npm run build

# Start web server
npm run dev:web
# or
node web/dist/server.js

# Install Bitwig controller
mkdir -p "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS"
cp controller/dist/jeannie.control.js "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS/"

# Use Jeannie CLI
cd compose && npm link  # Optional: makes 'jeannie' available globally
jeannie --help
jeannie health
jeannie track list
jeannie content search "strings" --fuzzy
```

## CLI Usage

```bash
# Server health & status
jeannie health              # Check server health
jeannie status              # Show Bitwig connection status
jeannie version             # Show all component versions

# Track management
jeannie track list          # List all tracks
jeannie track create --name "Piano" --type instrument
jeannie track select 0      # Select first track
jeannie track next          # Move to next track
jeannie track mute          # Mute current track
jeannie track volume 80     # Set volume to 80%

# Content search
jeannie content search "strings" --fuzzy
jeannie content search "piano" --type Preset
jeannie content stats       # Show content statistics
jeannie content types       # List content types

# ABC notation & MIDI
jeannie validate ./song.abc     # Validate ABC notation
jeannie convert ./song.abc      # Convert ABC to MIDI
jeannie load ./song.mid         # Load MIDI into Bitwig

# Global options
jeannie --api-url http://192.168.1.10:3000 health  # Custom API URL
jeannie --json health           # Output raw JSON
```

## Features

- Real-time web dashboard at `http://localhost:3000`
- Connection status tracking (30-second timeout)
- YAML config file watching with auto-reload
- REST API with health checks and version info
- Unified TypeScript CLI for all operations
- File logging for Bitwig controller (`~/.config/jeannie/logs/controller.log`)

## Logging

Controller logs appear in **both** locations:
- **Bitwig Script Console**: Settings > Controllers > Jeannie > Script Console
- **Log File**: `~/.config/jeannie/logs/controller.log` (macOS + Linux)

Tail logs from command line:
```bash
tail -f ~/.config/jeannie/logs/controller.log
```

**How it works**: Controller uses Java FileWriter (via Nashorn) to write logs directly. No HTTP or web server required.

## Architecture

```
jeannie/
├── controller/     # Bitwig controller (TypeScript → JS)
├── web/           # Express server + web UI
├── compose/       # Unified CLI (TypeScript)
└── shared/        # Shared TypeScript types
```

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Web UI dashboard |
| `GET /health` | Server health check |
| `GET /api/hello` | Hello world with versions |
| `GET /api/version` | All component versions |
| `GET /api/status` | Bitwig connection status |
| `GET /api/config` | Current configuration |
| `GET /api/bitwig/tracks` | List all tracks |
| `POST /api/bitwig/tracks` | Create new track |
| `GET /api/content/search` | Search content |

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guidelines
- [QUICKSTART.md](./QUICKSTART.md) - Quick start guide
- [controller/README.md](./controller/README.md) - Bitwig controller docs

## Development

See [CLAUDE.md](./CLAUDE.md) for comprehensive development guidelines including:
- Version management strategy
- Code style guidelines
- Git workflow
- API documentation
- Troubleshooting tips

## License

MIT License
