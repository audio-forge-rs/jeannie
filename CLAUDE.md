# Jeannie Bitwig Controller - Claude Code Guidelines

## Project Overview
Jeannie is a Bitwig Studio controller written in TypeScript with a web interface and REST API. It integrates with Roger, a Python CLI tool for configuration management.

## Architecture
- `/controller` - TypeScript Bitwig controller (transpiles to JS for Bitwig)
- `/web` - Node.js/Express REST API server with web interface
- `/roger` - Python CLI script for config management
- `/shared` - Shared TypeScript types and interfaces
- Config file: `/tmp/jeannie-config.yaml`

## Version Strategy
All components are independently versioned:
- Main project: package.json version
- Controller: controller/package.json version
- Web API: web/package.json version
- Roger: roger/__version__ in Python script

Bump versions frequently for all changes. Follow semver (0.x.y for pre-1.0).

## Git Workflow
- Commit often with descriptive messages
- Push after each significant feature completion
- Use conventional commit format: `feat:`, `fix:`, `chore:`, etc.

## Development Commands
```bash
# Install all dependencies
npm install

# Build everything
npm run build

# Run web server in dev mode
npm run dev:web

# Build controller only
npm run build:controller

# Run Roger CLI
python3 roger/roger.py --help
```

## Code Style
- TypeScript: strict mode, explicit types
- Use async/await over callbacks
- Prefer const over let
- Use descriptive variable names

## Testing
- Test config file watching with: `echo "test: value" > /tmp/jeannie-config.yaml`
- Test REST API with curl or Postman
- Test Roger CLI with various arguments

## Key Files
- `web/src/server.ts` - Main REST API server
- `web/src/configWatcher.ts` - YAML file watcher
- `controller/src/jeannie.controller.ts` - Main Bitwig controller
- `roger/roger.py` - Python CLI script
- `shared/src/types.ts` - Shared type definitions

## Research Sources (January 2026)
Based on latest 2025 best practices from:
- Anthropic Claude Code guidelines
- typed-bitwig-api for TypeScript definitions
- react-bitwig and Taktil frameworks for Bitwig development
