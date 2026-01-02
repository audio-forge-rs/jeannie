# Jeannie Quick Start Guide

## What Is Jeannie?

A complete Bitwig Studio controller ecosystem with:
- **Jeannie Controller** (v0.6.0): TypeScript Bitwig controller with Java FileWriter logging
- **Jeannie Web** (v0.7.0): REST API + web dashboard with event-driven connection monitoring
- **Roger** (v0.2.0): Python CLI that interacts with Jeannie
- **Config Watching**: Real-time YAML file monitoring in `~/.config/jeannie/`
- All components independently versioned and ready for frequent bumps

## Quick Demo

### 1. Start Jeannie Web Server
```bash
# Build everything
npm install
npm run build

# Start web server
node web/dist/server.js
```

### 2. Test the API
```bash
# Health check
curl http://localhost:3000/health

# Hello world (without config)
curl http://localhost:3000/api/hello
# Returns: "Hello from Jeannie! Connected to unknown vunknown"
```

### 3. Create Config File
```bash
# Option 1: Use Roger CLI (requires PyYAML)
pip install pyyaml
python3 roger/roger.py update-config

# Option 2: Create manually
mkdir -p ~/.config/jeannie
cat > ~/.config/jeannie/config.yaml << 'EOF'
version: 0.2.0
roger:
  name: roger
  version: 0.2.0
  timestamp: '2026-01-02T13:24:00.000Z'
controller:
  name: jeannie
  enabled: true
lastUpdated: '2026-01-02T13:24:00.000Z'
EOF
```

### 4. Watch the Magic!
The Jeannie server automatically detects the config file change:
```bash
curl http://localhost:3000/api/hello
# Returns: "Hello from Jeannie! Connected to roger v0.1.0"
```

## Available Endpoints

- `GET /health` - Server health and status
- `GET /api/hello` - Hello world with Roger integration
- `GET /api/version` - Version info for all components
- `GET /api/config` - Current configuration
- `GET /api/roger` - Roger-specific info from config
- `GET /api/status` - Connection status for Bitwig and Roger
- **Web UI**: `http://localhost:3000` - Dashboard with live connection status

## Roger CLI Commands

```bash
# Show help
python3 roger/roger.py --help

# Get version
python3 roger/roger.py --version

# Hello world
python3 roger/roger.py hello

# Check API health
python3 roger/roger.py health

# Get all versions
python3 roger/roger.py version

# View current config
python3 roger/roger.py config

# Update config with Roger info
python3 roger/roger.py update-config
```

## Bitwig Installation

1. Build Jeannie controller:
```bash
npm run build:controller
```

2. Create vendor folder and install:
```bash
# macOS
mkdir -p "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS"
cp controller/dist/jeannie.control.js "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS/"

# Check other platforms in controller/README.md
```

3. In Bitwig Studio:
   - Restart Bitwig (if already running)
   - Settings > Controllers
   - Add Controller
   - Hardware Vendor: **Audio Forge RS**
   - Product: **Jeannie**

**Note**: The folder "Audio Forge RS" must match the vendor name in the script.

## Project Structure

```
jeannie/
├── controller/       # Bitwig controller (TypeScript → JS)
├── web/             # REST API server + config watcher
├── roger/           # Python CLI tool
├── shared/          # Shared TypeScript types
├── CLAUDE.md        # Development guidelines
└── package.json     # Root workspace config
```

## Version Management

All components are at v0.1.0. To bump versions:

1. Update version in package.json files
2. Update VERSION constants in source files
3. Commit with descriptive message
4. Push frequently!

## What's Working

✅ TypeScript compilation for all components
✅ REST API server with Express
✅ YAML config file watching with chokidar (event-driven, no polling)
✅ Roger CLI with argparse
✅ Hello world integration showing Roger's name and version
✅ All endpoints returning correct data
✅ File logging for Bitwig controller (Java FileWriter)
✅ Event-driven Bitwig connection monitoring (process + log file watching)
✅ Production-ready web UI with live connection status
✅ Clean logging (minimal console output)
✅ Cross-platform support (macOS + Linux)
✅ Git committed and pushed

## Logging

Controller logs appear in two places:
- **Bitwig Script Console**: Settings > Controllers > Jeannie > Script Console
- **Log File**: `~/.config/jeannie/logs/controller.log` (macOS + Linux)

To watch logs from terminal:
```bash
tail -f ~/.config/jeannie/logs/controller.log
```

**How it works**: Controller uses Java FileWriter (via Nashorn) to write logs directly to `~/.config/jeannie/logs/`. No HTTP or web server required. Directory auto-created on first run.

## Next Steps

Ideas for v0.2.0+:
- Add Roger CLI commands to control Bitwig via REST API
- Implement actual MIDI handling in Bitwig controller
- Add device mapping and parameter control
- Add authentication/security
- Implement config file validation
- Add error handling and log levels
- Write tests

## Research Sources

Built using latest 2025 best practices from:
- [Anthropic Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [typed-bitwig-api](https://github.com/joslarson/typed-bitwig-api)
- [react-bitwig](https://github.com/joslarson/react-bitwig)
- Community Bitwig controller development patterns

---

**Version**: 0.7.0
**Last Updated**: 2026-01-02
**Vendor**: Audio Forge RS
**Status**: ✅ Production Ready

## Connection Monitoring

Jeannie v0.7.0 implements event-driven connection monitoring:

**Bitwig Controller Status**:
- Process monitoring checks if Bitwig is running (ps aux/tasklist)
- Event-driven log file watching (chokidar) detects controller activity
- 2-minute tolerance window for init-only logging behavior
- No polling spam, only responds to actual file changes

**Why it's reliable**:
- Combines process check + log file monitoring for accuracy
- Event-driven approach (no constant polling)
- Minimal server log output for production use
- Graceful shutdown handling
