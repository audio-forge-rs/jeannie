# Jeannie - Development Guidelines

## Project Overview

**Jeannie** is a Bitwig Studio controller ecosystem with three main components:
- **Bitwig Controller**: TypeScript controller script (transpiles to JS for Bitwig)
- **Web Server & API**: Node.js/Express REST API with real-time web interface
- **Roger CLI**: Python command-line tool for configuration and control

**Current Version**: 0.3.0
**Vendor**: Audio Forge RS
**Status**: Active Development

## Architecture

```
jeannie/
├── controller/          # Bitwig Studio controller script
│   ├── src/
│   │   └── jeannie.control.ts
│   ├── dist/           # Compiled output (gitignored)
│   └── package.json    # v0.3.0
│
├── web/                # Web server + REST API + UI
│   ├── src/
│   │   ├── server.ts           # Express server
│   │   └── configWatcher.ts    # YAML file watcher
│   ├── public/                 # Static web UI
│   │   ├── index.html
│   │   ├── app.js             # Vanilla JS SPA
│   │   └── styles.css
│   ├── dist/           # Compiled output (gitignored)
│   └── package.json    # v0.3.0
│
├── roger/              # Python CLI tool
│   ├── roger.py        # Main CLI script
│   └── requirements.txt
│
├── shared/             # Shared TypeScript types (optional)
│   ├── src/types.ts
│   └── package.json
│
└── /tmp/jeannie-config.yaml  # Runtime config file
```

## Key Concepts

### Component Communication

1. **Config File** (`/tmp/jeannie-config.yaml`)
   - Central configuration storage
   - Watched in real-time by web server
   - Updated by Roger CLI
   - Format: YAML

2. **REST API** (Port 3000)
   - Serves web UI
   - Provides endpoints for status, config, versions
   - Tracks connection status for Bitwig and Roger
   - 30-second connection timeout

3. **Bitwig Controller**
   - Runs inside Bitwig Studio
   - Can communicate with API (future feature)
   - Currently logs to Bitwig console

### Connection Status Tracking

Both Bitwig and Roger clients can "ping" the server:
- **Bitwig**: `POST /api/bitwig/ping` with version
- **Roger**: `POST /api/roger/command` with command name
- **Status**: `GET /api/status` returns connection state
- Auto-disconnects after 30 seconds of inactivity

## Version Management

**All components independently versioned** following semver (0.x.y for pre-1.0):

| Component | Location | Current |
|-----------|----------|---------|
| Main | `package.json` | 0.3.0 |
| Web Server | `web/package.json` | 0.3.0 |
| Controller | `controller/package.json` | 0.3.0 |
| Roger | `roger/roger.py __version__` | 0.1.0 |
| Web UI | `web/public/app.js` | 0.3.0 |

**Bump Strategy**:
- Bump often - every feature or significant fix
- Keep components in sync when possible
- Update version constants in source files:
  - `web/src/server.ts` - `VERSION` constant
  - `controller/src/jeannie.control.ts` - `JEANNIE_VERSION` constant
  - `web/public/app.js` - version in header comment
  - `roger/roger.py` - `__version__` variable

## Development Workflow

### Initial Setup

```bash
# Clone and install
git clone <repo>
cd jeannie
npm install

# Install Python dependencies (optional, for Roger config updates)
pip install -r roger/requirements.txt
```

### Building

```bash
# Build everything
npm run build

# Build specific components
npm run build:controller
npm run build:web

# Or build individually
cd controller && npm run build
cd web && npm run build
```

### Running

```bash
# Start web server (development)
npm run dev:web

# Start web server (production)
npm start
# or
node web/dist/server.js

# Use Roger CLI
python3 roger/roger.py --help
python3 roger/roger.py hello
python3 roger/roger.py update-config

# Install controller in Bitwig
cp controller/dist/jeannie.control.js "$HOME/Documents/Bitwig Studio/Controller Scripts/"
# Then add in Bitwig: Settings > Controllers > Add Controller
```

### Testing

```bash
# Test web server
curl http://localhost:3000/health
curl http://localhost:3000/api/hello
curl http://localhost:3000/api/status

# Test config watching
echo "version: 0.3.0
roger:
  name: roger
  version: 0.1.0
  timestamp: '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'
controller:
  name: jeannie
  enabled: true
lastUpdated: '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'" > /tmp/jeannie-config.yaml

# Test Roger CLI
python3 roger/roger.py health
python3 roger/roger.py version
```

## Git Workflow

### Commit Standards

Use conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `chore:` - Maintenance (deps, builds, etc.)
- `docs:` - Documentation only
- `refactor:` - Code changes without behavior change
- `style:` - Formatting, whitespace

**Commit Template**:
```
<type>: <short description>

<detailed description>

- Bullet point changes
- More details

Version bumps:
- Component: old -> new

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Branch Strategy

- `main` - Production-ready code
- Commit and push often
- No feature branches needed for solo development
- Use force push only for history rewrites (rare)

## Code Style

### TypeScript

```typescript
// ✅ Good
const VERSION = '0.3.0';
async function fetchData(): Promise<ApiResponse> {
  const response = await fetch('/api/data');
  return await response.json();
}

// ❌ Avoid
var version = '0.3.0';  // use const
function fetchData(callback) { ... }  // use async/await
```

**Rules**:
- Strict mode enabled
- Explicit types (no implicit `any`)
- `const` over `let`, never `var`
- async/await over callbacks
- Interface for object shapes
- Descriptive names

### Python

```python
# ✅ Good
__version__ = '0.1.0'

def update_config(self) -> bool:
    """Update config file with Roger's info"""
    try:
        config = {...}
        with open(CONFIG_FILE, 'w') as f:
            yaml.dump(config, f)
        return True
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False

# ❌ Avoid
version = '0.1.0'  # use __version__
def updateConfig():  # use snake_case
    config = {...}
    f = open(file, 'w')  # use context manager
```

**Rules**:
- PEP 8 style
- snake_case for functions/variables
- Type hints where helpful
- Docstrings for public functions
- Context managers for files

### JavaScript (Web UI)

```javascript
// ✅ Good - Modern ES6+
class JeannieApp {
    async fetchAPI(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`);
        return await response.json();
    }
}

// ❌ Avoid
function fetchAPI(endpoint, callback) {
    $.ajax({ url: endpoint, success: callback });
}
```

**Rules**:
- ES6+ features (classes, arrow functions, template literals)
- No build step required (runs in browser)
- Async/await for API calls
- Clear class-based organization

## Naming Conventions

### User-Facing Names

Use simple, consistent naming:

- ✅ **"Jeannie"** - Web UI, user messages, general references
- ✅ **"Roger"** - CLI tool, all references
- ❌ "Jeannie Controller" - Too verbose for UI
- ❌ "Jeannie Bitwig Controller" - Only in technical docs

**Exception**: Use full names in:
- Package descriptions (`package.json`)
- Technical documentation
- File headers/comments
- Where disambiguation is critical

### File Naming

- TypeScript: `kebab-case.ts` or `camelCase.ts`
- Python: `snake_case.py`
- Config: `kebab-case.yaml` or `kebab-case.json`
- Scripts: `jeannie.control.js` (Bitwig requirement)

### Variable Naming

- Constants: `UPPER_SNAKE_CASE` or `SCREAMING_SNAKE_CASE`
- Variables: `camelCase` (TS/JS), `snake_case` (Python)
- Classes: `PascalCase`
- Files: `kebab-case` or `snake_case`

## API Endpoints

### Public Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Web UI (index.html) |
| GET | `/health` | Server health check |
| GET | `/api/hello` | Hello world with versions |
| GET | `/api/version` | All component versions |
| GET | `/api/config` | Current config |
| GET | `/api/status` | Connection status |
| GET | `/api/roger` | Roger info from config |
| POST | `/api/bitwig/ping` | Bitwig heartbeat |
| POST | `/api/roger/command` | Roger command tracking |

### Response Format

All API responses follow this structure:

```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;  // ISO 8601
}
```

## Configuration

### Config File Structure

```yaml
# /tmp/jeannie-config.yaml
version: 0.3.0
roger:
  name: roger
  version: 0.1.0
  timestamp: '2026-01-02T13:00:00.000Z'
controller:
  name: jeannie
  enabled: true
lastUpdated: '2026-01-02T13:00:00.000Z'
```

### Environment Variables

Currently none required. Future additions:
- `PORT` - Web server port (default: 3000)
- `CONFIG_PATH` - Config file location
- `LOG_LEVEL` - Logging verbosity

## Troubleshooting

### Common Issues

**Web server won't start**:
```bash
# Check if port is in use
lsof -i :3000
# Kill existing process
pkill -f "node.*server.js"
```

**Bitwig controller not showing**:
```bash
# Verify file exists
ls -la "$HOME/Documents/Bitwig Studio/Controller Scripts/jeannie.control.js"
# Check file size (should be ~800 bytes)
# Restart Bitwig Studio
```

**Config changes not detected**:
```bash
# Verify file exists
cat /tmp/jeannie-config.yaml
# Check server logs for watcher messages
# Ensure YAML is valid
```

**Build errors**:
```bash
# Clean and rebuild
rm -rf */dist */node_modules
npm install
npm run build
```

## Security & Git Hygiene

### Gitignored Files

Never commit:
- `dist/`, `build/`, `out/` - Build outputs
- `node_modules/` - Dependencies
- `.env*` - Environment files
- `*.key`, `*.pem`, `*.cert` - Secrets
- `credentials.json`, `secrets.json` - Secrets
- `*.log` - Logs
- `.DS_Store`, `Thumbs.db` - OS files
- Large files: `*.zip`, `*.wav`, `*.mp3`, etc.

### Checking for Committed Secrets

```bash
# Search git history
git log --all --oneline --name-status | grep -i "secret\|credential\|key"

# List all tracked files
git ls-files | grep -E "\.env|secret|credential|\.key"

# Check for large files
git ls-files | xargs ls -lh | sort -k5 -h | tail -20
```

## Technology Stack

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type-safe JavaScript
- **Chokidar** - File watching
- **YAML** - Config parsing

### Frontend
- **Vanilla JavaScript** - No framework
- **ES6+ Modules** - Modern JS
- **Fetch API** - HTTP requests
- **CSS3** - Styling

### CLI
- **Python 3** - Runtime
- **argparse** - CLI parsing
- **PyYAML** - Config writing

### Bitwig
- **Bitwig Control Surface API v18**
- **TypeScript** - Development
- **ES5 JavaScript** - Runtime (Bitwig requirement)

## Resources & References

### Official Documentation
- [Bitwig Control Surface API](https://www.bitwig.com/support/technical_support/)
- [Express.js](https://expressjs.com/)
- [Chokidar](https://github.com/paulmillr/chokidar)

### Community Resources
- [typed-bitwig-api](https://github.com/joslarson/typed-bitwig-api) - TypeScript types
- [react-bitwig](https://github.com/joslarson/react-bitwig) - React framework
- [Taktil](https://github.com/joslarson/taktil) - Build framework

### Best Practices (2025)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Vanilla JS Comeback 2025](https://dev.to/arkhan/why-vanilla-javascript-is-making-a-comeback-in-2025-4939)
- [VanJS - 1.0kB Framework](https://vanjs.org/)

## Quick Reference

### One-Line Commands

```bash
# Full build and start
npm install && npm run build && node web/dist/server.js

# Update Bitwig controller
npm run build:controller && cp controller/dist/jeannie.control.js "$HOME/Documents/Bitwig Studio/Controller Scripts/"

# Test everything
curl http://localhost:3000/health && curl http://localhost:3000/api/status && python3 roger/roger.py version

# Clean slate
rm -rf */dist */node_modules && npm install && npm run build
```

### Helpful Aliases

Add to `~/.zshrc` or `~/.bashrc`:

```bash
alias jeannie-build='cd ~/jeannie && npm run build'
alias jeannie-start='cd ~/jeannie && node web/dist/server.js'
alias jeannie-install='cd ~/jeannie && cp controller/dist/jeannie.control.js "$HOME/Documents/Bitwig Studio/Controller Scripts/"'
alias roger='python3 ~/jeannie/roger/roger.py'
```

## Contributing

This is a solo project but follows professional standards:
- Clean commit messages
- Frequent version bumps
- Comprehensive documentation
- Type-safe code
- No breaking changes without major version bump

## License

MIT License - See LICENSE file

---

**Last Updated**: 2026-01-02
**Version**: 0.3.0
**Maintainer**: Audio Forge RS
