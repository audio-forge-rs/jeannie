# Jeannie

A Bitwig Studio controller ecosystem with web interface and CLI tools.

**Vendor**: Audio Forge RS
**Version**: 0.3.0
**Status**: Active Development

## Components

### Jeannie (Bitwig Controller)
TypeScript controller script for Bitwig Studio with real-time connection tracking.

### Web Server & API
Node.js/Express server providing:
- REST API for status, configuration, and version info
- Real-time web UI dashboard
- Connection status tracking for Bitwig and Roger
- YAML config file watching (`/tmp/jeannie-config.yaml`)

### Roger (CLI Tool)
Python command-line tool for interacting with Jeannie via REST API.

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
cp controller/dist/jeannie.control.js "$HOME/Documents/Bitwig Studio/Controller Scripts/"

# Use Roger CLI
python3 roger/roger.py --version
python3 roger/roger.py hello
```

## Features

- ✅ Real-time web dashboard at `http://localhost:3000`
- ✅ Connection status tracking (30-second timeout)
- ✅ YAML config file watching with auto-reload
- ✅ REST API with health checks and version info
- ✅ Roger CLI for configuration and control
- ✅ TypeScript throughout for type safety
- ✅ Vanilla JavaScript web UI (no build step)

## Architecture

```
jeannie/
├── controller/     # Bitwig controller (TypeScript → JS)
├── web/           # Express server + web UI
├── roger/         # Python CLI tool
└── shared/        # Shared TypeScript types
```

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Web UI dashboard |
| `GET /health` | Server health check |
| `GET /api/hello` | Hello world with versions |
| `GET /api/version` | All component versions |
| `GET /api/status` | Bitwig & Roger connection status |
| `GET /api/config` | Current configuration |
| `POST /api/bitwig/ping` | Bitwig heartbeat |
| `POST /api/roger/command` | Roger command tracking |

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guidelines
- [QUICKSTART.md](./QUICKSTART.md) - Quick start guide
- [controller/README.md](./controller/README.md) - Bitwig controller docs
- [roger/README.md](./roger/README.md) - Roger CLI docs

## Development

See [CLAUDE.md](./CLAUDE.md) for comprehensive development guidelines including:
- Version management strategy
- Code style guidelines
- Git workflow
- API documentation
- Troubleshooting tips

## License

MIT License
