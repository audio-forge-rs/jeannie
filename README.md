# Jeannie Bitwig Controller

A TypeScript-based Bitwig Studio controller with web interface and REST API, integrated with Roger CLI for configuration management.

## Version
- Main: 0.1.0
- Controller: 0.1.0
- Web API: 0.1.0
- Roger: 0.1.0

## Components

### Jeannie Controller
TypeScript Bitwig controller that transpiles to JavaScript for Bitwig Studio integration.

### Web Interface & REST API
Node.js/Express server providing REST API and web interface for controller management.

### Roger CLI
Python command-line tool for interacting with the Jeannie controller via REST API.

### Config File Watching
Monitors `/tmp/jeannie-config.yaml` for changes and updates controller state.

## Quick Start

```bash
# Install dependencies
npm install

# Build all components
npm run build

# Start web server
npm run dev:web

# Use Roger CLI
python3 roger/roger.py --version
```

## Architecture
- Config file: `/tmp/jeannie-config.yaml`
- REST API: http://localhost:3000
- Bitwig controller output: `dist/jeannie.control.js`

## Development
See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines and best practices.
