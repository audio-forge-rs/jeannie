# Jeannie - Development Guidelines

## Project Overview

**Jeannie** is a Bitwig Studio controller ecosystem with three main components:
- **Bitwig Controller**: TypeScript controller script (transpiles to JS for Bitwig)
- **Web Server & API**: Node.js/Express REST API with real-time web interface
- **Roger CLI**: Python command-line tool for configuration and control

**Current Version**: 0.7.0
**Vendor**: Audio Forge RS
**Status**: Active Development

## Architecture

```
jeannie/
├── controller/          # Bitwig Studio controller script
│   ├── src/
│   │   └── jeannie.control.ts
│   ├── dist/           # Compiled output (gitignored)
│   └── package.json    # v0.5.1
│
├── web/                # Web server + REST API + UI
│   ├── src/
│   │   ├── server.ts           # Express server
│   │   ├── configWatcher.ts    # YAML file watcher
│   │   ├── contentSearch.ts    # Content search index
│   │   ├── filesystemScanner.ts # Filesystem content scanner
│   │   └── scan-filesystem.ts  # Scanner CLI entry point
│   ├── public/                 # Static web UI
│   │   ├── index.html
│   │   ├── app.js             # Vanilla JS SPA
│   │   └── styles.css
│   ├── dist/           # Compiled output (gitignored)
│   └── package.json    # v0.7.0
│
├── roger/              # Python CLI tool
│   ├── roger.py        # Main CLI script v0.3.0
│   └── requirements.txt
│
├── docs/               # Documentation
│   └── instruments/    # Downloaded manuals (gitignored)
│
├── shared/             # Shared TypeScript types (optional)
│   ├── src/types.ts
│   └── package.json
│
├── ~/.config/jeannie/  # User data directory
│   ├── config.yaml     # User configuration
│   ├── content.json    # Content index (5,373+ items)
│   ├── rescan.flag     # Rescan trigger
│   └── logs/
│       └── controller.log
│
├── INSTRUMENTS.md      # Instrument knowledge base
├── ARCHITECTURE.md     # Detailed architecture docs
└── CLAUDE.md           # Development guidelines (this file)
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
- **Bitwig**: Event-driven monitoring (process check + log file watching)
- **Roger**: `POST /api/roger/command` with command name
- **Status**: `GET /api/status` returns connection state
- Auto-disconnects after 30 seconds of inactivity (Roger only)
- Bitwig status based on process running + log file existence

### Content Index System

**Searchable content database** for instant access to all Bitwig content:

1. **Content Types**:
   - **Devices**: VST2, VST3, CLAP, Bitwig native instruments & effects
   - **Presets**: Plugin presets (Kontakt instruments, M-Tron patches, etc.)
   - **Samples**: Audio files, loops, one-shots
   - **Future**: Clips, multisamples

2. **Enumeration** (Controller on init, ~60-120s):
   - Scans all content types via PopupBrowser API
   - Captures: name, contentType, creator, category, plugin
   - Tokenizes names for fast search
   - Writes to `~/.config/jeannie/content.json` (~13MB for 67k items)

3. **Search Index** (Web server in memory, ~21MB):
   - Token-based index for fast lookups
   - Fuzzy search with Levenshtein distance
   - Multi-field filtering (contentType, creator, category, plugin)
   - **Performance**: <1ms exact, 2ms token search, 10-50ms fuzzy

4. **Rescan Mechanism**:
   - Create `~/.config/jeannie/rescan.flag` to trigger
   - Controller checks every 10 seconds
   - Automatic rescan on Bitwig restart
   - Endpoints: `POST /api/content/rescan`
   - CLI: `roger content rescan`

**Example Searches**:
```bash
# Search for acoustic snare samples
GET /api/content/search?q=acoustic+snare&type=Sample&fuzzy=true
# Returns: ~25 matching samples in ~2ms

# Search for Kontakt piano presets
GET /api/content/search?q=piano&type=Preset&creator=Native%20Instruments
# Returns: Kontakt piano instruments instantly
```

**See ARCHITECTURE.md** for complete technical details

## Version Management

**All components independently versioned** following semver (0.x.y for pre-1.0):

| Component | Location | Current |
|-----------|----------|---------|
| Main | `package.json` | 0.3.0 |
| Web Server | `web/package.json` | 0.7.0 |
| Controller | `controller/package.json` | 0.5.1 |
| Roger | `roger/roger.py __version__` | 0.3.0 |
| Web UI | `web/public/app.js` | 0.3.0 |
| JEANNIE_VERSION | `controller/src/jeannie.control.ts` | 0.7.0 |

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

# Content search commands
python3 roger/roger.py content search "acoustic snare" --fuzzy
python3 roger/roger.py content search "piano" --type Preset
python3 roger/roger.py content stats
python3 roger/roger.py content rescan

# Install controller in Bitwig
mkdir -p "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS"
cp controller/dist/jeannie.control.js "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS/"
# Then add in Bitwig: Settings > Controllers > Add Controller > Audio Forge RS > Jeannie
```

### Testing

```bash
# Test web server
curl http://localhost:3000/health
curl http://localhost:3000/api/hello
curl http://localhost:3000/api/status

# Test content search (requires content.json from controller scan)
curl "http://localhost:3000/api/content/stats"
curl "http://localhost:3000/api/content/types"
curl "http://localhost:3000/api/content/search?q=piano&fuzzy=true"

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
| GET | `/api/status` | Connection status (Bitwig + Roger) |
| GET | `/api/roger` | Roger info from config |
| POST | `/api/bitwig/ping` | Bitwig heartbeat (deprecated - uses process check now) |
| POST | `/api/bitwig/log` | Bitwig log forwarding |
| POST | `/api/roger/command` | Roger command tracking |

### Content Index Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/content` | List all content (paginated) |
| GET | `/api/content/search?q=<query>` | Search content (token match) |
| GET | `/api/content/search?q=<query>&fuzzy=true` | Fuzzy search content |
| GET | `/api/content/search?q=<query>&type=Preset` | Search specific type |
| GET | `/api/content/stats` | Content statistics (counts by type/creator) |
| GET | `/api/content/types` | List all content types (Device, Preset, Sample) |
| GET | `/api/content/creators` | List all creators/vendors |
| GET | `/api/content/categories` | List all categories |
| GET | `/api/content/status` | Index status (last scan, content count) |
| POST | `/api/content/rescan` | Trigger content rescan |

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
# Verify file exists in vendor folder
ls -la "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS/jeannie.control.js"
# Check file size (should be ~800 bytes)
# IMPORTANT: Folder name must match vendor name in defineController()
# Restart Bitwig Studio and check Settings > Controllers > Add Controller
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

### Logging & Debugging

**Controller Logs**:
- **Bitwig Script Console**: Settings > Controllers > Jeannie > Script Console
- **File Log**: `~/.config/jeannie/logs/controller.log` (macOS + Linux)
  - Controller uses Java FileWriter via Nashorn to write logs directly
  - No HTTP or web server required
  - Directory auto-created on first run
  - Logs appear in both console AND file

**Tail Jeannie Logs**:
```bash
# Watch Jeannie controller logs
tail -f ~/.config/jeannie/logs/controller.log

# Watch Bitwig main logs
tail -f ~/Library/Logs/Bitwig/BitwigStudio.log

# Watch both at once (separate terminals)
tail -f ~/.config/jeannie/logs/controller.log
tail -f ~/Library/Logs/Bitwig/BitwigStudio.log
```

**Web Server Logs**:
```bash
# Server outputs to console
node web/dist/server.js
```

**How Controller Logging Works**:
- TypeScript compiles to JavaScript
- JavaScript runs in Bitwig's Nashorn environment
- Nashorn provides access to Java classes via `Java.type()`
- Controller uses `java.io.FileWriter` and `java.io.BufferedWriter`
- Cross-platform paths via `java.lang.System.getProperty('user.home')`

**General Tips**:
- Always check Bitwig Script Console first for controller errors
- File logs persist across Bitwig restarts in `~/.config/jeannie/logs/`
- File logging works independently (no web server required)
- Use `grep` to filter logs: `tail -f ~/.config/jeannie/logs/controller.log | grep -i error`
- Logs use standard Java timestamp format with milliseconds

**⚠️ CRITICAL DEBUGGING PRINCIPLE**:
- **NEVER delete code or functionality to debug issues**
- **ALWAYS add logging, not remove code**
- **ALWAYS catch more edge cases and exceptions**
- **NEVER comment out working code to isolate problems**
- Debug by adding instrumentation, not by subtraction
- If something breaks, add logs to understand why - don't remove the feature
- Use feature flags if you must disable functionality temporarily
- Preserve all working code and only enhance error handling

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

## MIDI Note Conventions

### Bitwig Octave Offset (CRITICAL)

**Bitwig uses C3 = Middle C (MIDI note 60)**

This differs from some standards where Middle C is C4 or C5:
- **Bitwig**: C3 = MIDI 60 = 262 Hz
- **Bitwig range**: C-2 (MIDI 0) to G8 (MIDI 127)

**Conversion**: When importing from other DAWs, notes may appear 1-2 octaves different.

### Kontakt Keyboard Colors
- **Blue keys**: Playable instrument range
- **Red keys**: Keyswitches (articulation control)
- **Green keys**: Custom keyswitches

**See INSTRUMENTS.md** for complete instrument knowledge base including:
- MIDI CC mappings per library
- Keyswitch ranges
- Genre suitability scores
- Playable note ranges

---

## Filesystem Scanner

### Overview

The **Filesystem Scanner** is the primary content discovery method (PopupBrowser API returns 0 items).

**Location**: `web/src/filesystemScanner.ts`
**CLI**: `npm run scan` (from web/ directory)
**Output**: `~/.config/jeannie/content.json`

### What It Scans

| Content Type | Paths | Items Found |
|--------------|-------|-------------|
| VST3 Plugins | `/Library/Audio/Plug-Ins/VST3/`, `~/Library/Audio/Plug-Ins/VST3/` | ~109 |
| CLAP Plugins | `/Library/Audio/Plug-Ins/CLAP/` | ~2 |
| M-Tron Patches | `/Library/Application Support/GForce/M-Tron Pro IV/Patches/` | ~3,814 |
| Kontakt Libraries | `/Library/Application Support/Native Instruments/Kontakt X/Content/`, `/Volumes/External/kontakt_libraries/` | ~1,448 |

**Total**: ~5,373 items in ~4 seconds

### Kontakt Detection

- Detects installed versions (Kontakt 5, 6, 7, 8)
- Scans `.nki` files for instruments
- Detects Player vs Full: `.nicnt` file present = Player compatible
- Scans external volumes automatically

### M-Tron Detection

- Parses XML patch files
- Extracts: name, creator, category, collection, cptId
- References `.cpt2` collection files

### Controller Protection

The Bitwig controller will NOT overwrite `content.json` if PopupBrowser returns 0 items. This prevents losing filesystem scanner data.

---

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
npm run build:controller && cp controller/dist/jeannie.control.js "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS/"

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
alias jeannie-install='cd ~/jeannie && mkdir -p "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS" && cp controller/dist/jeannie.control.js "$HOME/Documents/Bitwig Studio/Controller Scripts/Audio Forge RS/"'
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
**Version**: 0.7.0
**Maintainer**: Audio Forge RS
