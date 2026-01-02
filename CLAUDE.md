# Jeannie - Development Guidelines

## Project Overview

**Jeannie** is a Bitwig Studio controller ecosystem with four main components:
- **Bitwig Controller**: TypeScript controller script (transpiles to JS for Bitwig)
- **Web Server & API**: Node.js/Express REST API with real-time web interface
- **Roger CLI**: Python command-line tool for general Bitwig control
- **Compose CLI**: TypeScript CLI for ABC→MIDI composition workflow

**Current Version**: 0.10.0 (see `versions.json` for per-component versions)
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
│   │   ├── contentSearch.ts    # Content search index v0.8.0
│   │   ├── filesystemScanner.ts # Filesystem scanner v0.3.0
│   │   ├── libraryMetadata.ts  # Library metadata (genres, MIDI, modes)
│   │   └── scan-filesystem.ts  # Scanner CLI entry point
│   ├── public/                 # Static web UI
│   │   ├── index.html
│   │   ├── app.js             # Vanilla JS SPA
│   │   └── styles.css
│   ├── dist/           # Compiled output (gitignored)
│   └── package.json    # v0.8.0
│
├── compose/            # ABC → MIDI composition CLI
│   ├── src/
│   │   ├── cli.ts              # jeannie-compose entrypoint
│   │   ├── index.ts            # Module exports
│   │   ├── abc/
│   │   │   ├── parser.ts       # ABC notation parser
│   │   │   ├── validator.ts    # ABC validation
│   │   │   └── index.ts
│   │   └── midi/
│   │       └── index.ts        # MIDI types and conversion (placeholder)
│   └── package.json    # v0.1.0
│
├── roger/              # Python CLI tool
│   ├── roger.py        # Main CLI script v0.3.0
│   └── requirements.txt
│
├── docs/               # Documentation
│   └── instruments/    # Downloaded manuals (gitignored)
│
├── shared/             # Shared TypeScript types
│   ├── src/types.ts    # Enhanced content types v0.2.0
│   └── package.json    # v0.2.0
│
├── songs/              # Song projects (gitignored, locally versioned)
│   └── <project>/
│       ├── song.yaml   # Metadata, version history
│       ├── versions/   # Version snapshots
│       └── current/    # Symlinks to latest
│
├── ~/.config/jeannie/  # User data directory
│   ├── config.yaml     # User configuration
│   ├── content.json    # Content index (5,373+ items with metadata)
│   ├── rescan.flag     # Rescan trigger
│   └── logs/
│       └── controller.log
│
├── INSTRUMENTS.md      # Instrument knowledge base
├── ARCHITECTURE.md     # Detailed architecture docs
└── CLAUDE.md           # Development guidelines (this file)
```

## CLI Tools: Roger vs Compose

Jeannie has **two CLI tools** with distinct purposes:

| Tool | Language | Purpose |
|------|----------|---------|
| **roger** (`roger/roger.py`) | Python | General-purpose Jeannie CLI |
| **jeannie-compose** (`compose/src/cli.ts`) | TypeScript | Specialized composition pipeline |

### Roger CLI - General Bitwig Control
The **primary CLI** for interacting with Jeannie and Bitwig:
- Health checks and status monitoring
- Content search (devices, presets, samples)
- **Track management** (create, select, mute, solo, volume, pan)
- Configuration management

```bash
roger health                      # Check server health
roger track list                  # List all tracks
roger track create --name Piano   # Create instrument track
roger track mute                  # Mute current track
roger content search "strings"    # Search content index
```

### Compose CLI - ABC→MIDI Workflow
A **specialized extension** for AI-assisted music composition:
- ABC notation validation
- ABC to MIDI conversion
- Loading MIDI into Bitwig

```bash
jeannie-compose validate ./song.abc   # Validate ABC notation
jeannie-compose convert ./song.abc    # Convert to MIDI
jeannie-compose load ./song.mid       # Load into Bitwig
```

**Analogy**: Think of it like `git` vs `git-lfs` - Roger is the main tool, Compose is a specialized extension.

**Important**: Roger is NOT abandoned. It is the primary CLI and is actively maintained.

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
   - **Genre filtering**: Search by genre suitability (e.g., `genre=country&minScore=70`)
   - **Vibe filtering**: Search by character tags (warm, vintage, aggressive, etc.)
   - **Playing mode filtering**: Filter by poly/mono/legato support
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

**Single Source of Truth**: All component versions are defined in `/versions.json`:

```json
{
  "main": "0.10.0",
  "web": "0.10.0",
  "controller": "0.10.0",
  "compose": "0.9.0",
  "shared": "0.9.0",
  "roger": "0.10.0"
}
```

Each component reads its version from this file at runtime:
- **Web Server**: Reads `versions.web` from `../../versions.json`
- **Compose CLI**: Reads `versions.compose` from `../../versions.json`
- **Roger CLI**: Reads `versions.roger` from `../versions.json`
- **Controller**: Reads `versions.controller` from `~/.config/jeannie/versions.json`

The controller runs in Bitwig's isolated environment, so `npm run build` copies `versions.json` to `~/.config/jeannie/` via the `sync-versions` script.

**Independent Versioning Strategy**:
Each component has its own version number. Only bump components that actually changed:

| Component | When to Bump |
|-----------|--------------|
| `main` | Any significant release (tracks latest major feature) |
| `controller` | Bitwig controller script changes |
| `web` | Web server or API changes |
| `roger` | Roger CLI changes |
| `compose` | Compose CLI changes |
| `shared` | Shared type definitions changes |

**Bump Strategy**:
- Edit `/versions.json` only - this is the single source of truth
- Run `npm run build` to sync versions to `~/.config/jeannie/`
- Only bump components that changed - this makes it clear what was modified
- Use semantic versioning: MAJOR.MINOR.PATCH

**Package.json Sync**:
The `package.json` files should also be updated when bumping versions (for npm compatibility), but the runtime versions come from `versions.json`.

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
| GET | `/api/content/search?genre=country&minScore=70` | Search by genre suitability |
| GET | `/api/content/search?vibe=vintage` | Search by vibe/character |
| GET | `/api/content/search?playingMode=legato` | Search by playing mode |
| GET | `/api/content/stats` | Content statistics (counts by type/creator/genre) |
| GET | `/api/content/types` | List all content types (Device, Preset, Sample) |
| GET | `/api/content/creators` | List all creators/vendors |
| GET | `/api/content/categories` | List all categories |
| GET | `/api/content/genres` | List all genres with counts |
| GET | `/api/content/vibes` | List all vibe tags |
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

## Future Vision: AI Music Composition

### Overview

Jeannie will enable AI-assisted music composition through Claude Code sessions:

```
User: "Create a honky tonk song"
Claude: [Uses instrument knowledge, creates tracks, writes music, loads into Bitwig]
```

### Architecture (Planned)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Code Session                          │
│  "Create a honky tonk song"                                      │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────┐                                            │
│  │ Instrument      │ ← INSTRUMENTS.md, content.json              │
│  │ Selection       │   Genre scores, MIDI ranges                 │
│  │ (Banjo, Fiddle, │   Playing modes, keyswitches               │
│  │  Piano, Bass)   │                                            │
│  └────────┬────────┘                                            │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ ABC Notation    │ ← Text-based, LLM-friendly                  │
│  │ Generation      │   One file per instrument/track             │
│  └────────┬────────┘                                            │
└───────────┼─────────────────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────────────────────────┐
│              jeannie-compose CLI (Single Entrypoint)             │
│                                                                  │
│  jeannie-compose --abc ./song/ --validate --convert --load      │
│                                                                  │
│  ┌─────────────────┐   ┌─────────────────┐   ┌───────────────┐ │
│  │ ABC Validation  │ → │ ABC → MIDI      │ → │ MIDI          │ │
│  │ - Musical sound │   │ Conversion      │   │ Validation    │ │
│  │ - Bar counts    │   │                 │   │ - Bar counts  │ │
│  │   match         │   │                 │   │ - Note ranges │ │
│  └─────────────────┘   └─────────────────┘   └───────┬───────┘ │
└──────────────────────────────────────────────────────┼──────────┘
                                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Bitwig Controller                             │
│                                                                  │
│  Option A: Live MIDI        │  Option B: Clip Placement         │
│  - Send notes in real-time  │  - Import MIDI clips to tracks    │
│  - Controller handles       │  - Position on timeline           │
│    timing                   │  - Set loop regions               │
│                             │                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Why ABC Notation

ABC is text-based musical notation, ideal for LLM generation:

```abc
X:1
T:Honky Tonk Piano
M:4/4
L:1/8
K:G
Q:1/4=120
|: G2 B2 d2 B2 | A2 c2 e2 c2 | G2 B2 d2 B2 | D2 G2 B2 d2 :|
```

**Advantages**:
- Plain text (no binary)
- Human readable
- Easy to validate bar counts
- LLM can generate and modify
- Standard format with tooling

### Validation Pipeline

**Stage 1: ABC Validation**
```bash
jeannie-compose validate-abc ./song/
# Checks:
# - Valid ABC syntax
# - All parts have same bar count
# - Notes within instrument ranges
# - Tempo/time signature consistency
```

**Stage 2: MIDI Conversion**
```bash
jeannie-compose convert ./song/
# Converts ABC → MIDI using abc2midi or similar
# Outputs: ./song/*.mid
```

**Stage 3: MIDI Validation**
```bash
jeannie-compose validate-midi ./song/
# Checks:
# - Valid MIDI format
# - All clips same bar count
# - Notes within playable ranges (not keyswitches)
# - No overlapping notes in mono instruments
```

**Stage 4: Bitwig Loading**
```bash
jeannie-compose load ./song/ --mode clips
# OR
jeannie-compose load ./song/ --mode live
```

### Instrument Selection Logic

When Claude receives "honky tonk song", it will:

1. **Query genre scores** from content.json metadata:
   ```
   Misfit Banjo: { "country": 80, "americana": 95, "blues": 90 }
   Misfit Fiddle: { "country": 85, "americana": 90, "folk": 95 }
   Piano: { "honky_tonk": 95, "country": 80, "jazz": 90 }
   ```

2. **Check playing modes**:
   - Banjo: auto-strum → send chords, not arpeggios
   - Fiddle: legato mode → single melody lines
   - Piano: poly mode → full chord voicings

3. **Respect MIDI ranges**:
   - Validate notes stay in playable range (blue keys)
   - Avoid keyswitch range (red keys)
   - Apply Bitwig octave offset (C3 = Middle C)

4. **Generate ABC** with correct:
   - Time signature
   - Key signature
   - Tempo
   - Bar count (same for all parts)

### Track Creation Sequence

```typescript
// Future Bitwig Controller API
interface CreateSongRequest {
  name: string;
  tempo: number;
  timeSignature: [number, number];
  tracks: {
    name: string;
    instrument: {
      plugin: string;       // 'Kontakt 8'
      preset: string;       // 'Misfit Banjo'
    };
    playingMode?: 'poly' | 'mono' | 'legato';
    midiFile?: string;      // Path to MIDI clip
  }[];
}
```

### Dual-Use Requirement

**CRITICAL**: System must work both ways:

1. **Claude Code Sessions**: AI generates music via prompts
2. **Human Use**: Manual operation via CLI, web UI, Roger

**Never remove human-accessible functionality** when adding AI features.
All tools must have CLI interfaces that work standalone.

### File Structure (Planned)

```
jeannie/
├── compose/                    # New composition tools
│   ├── src/
│   │   ├── cli.ts             # jeannie-compose entrypoint
│   │   ├── abcValidator.ts    # ABC validation
│   │   ├── abcToMidi.ts       # ABC → MIDI conversion
│   │   ├── midiValidator.ts   # MIDI validation
│   │   └── bitwigLoader.ts    # Bitwig integration
│   └── package.json
│
├── songs/                      # Example songs (gitignored?)
│   └── honky-tonk-example/
│       ├── song.yaml          # Metadata (tempo, key, instruments)
│       ├── banjo.abc
│       ├── fiddle.abc
│       ├── piano.abc
│       └── bass.abc
```

### Implementation Phases

1. **Phase 1**: ABC validation + MIDI conversion CLI - **DONE** (compose/src/abc/)
2. **Phase 2**: Instrument metadata enrichment - **DONE** (libraryMetadata.ts, enhanced types)
3. **Phase 3**: Bitwig track creation API - **PLANNED**
4. **Phase 4**: Claude Code integration prompts - **PLANNED**
5. **Phase 5**: Live MIDI playback option - **PLANNED**
6. **Phase 6**: Song versioning system - **PLANNED**

### Song Versioning System (Vision)

**Goal**: Allow iterative song development with version history, while Bitwig always has the latest version.

```
songs/                           # Gitignored directory
├── honky-tonk-demo/
│   ├── song.yaml                # Metadata (current version refs)
│   ├── versions/
│   │   ├── v001/                # Initial version
│   │   │   ├── piano.abc
│   │   │   ├── banjo.abc
│   │   │   └── bass.abc
│   │   ├── v002/                # Guitar part changed
│   │   │   ├── piano.abc        # Unchanged (copy or symlink)
│   │   │   ├── banjo.abc        # Modified
│   │   │   └── bass.abc
│   │   └── v003/                # Reverted banjo to v001
│   │       ├── piano.abc
│   │       ├── banjo.abc        # Copied from v001
│   │       └── bass.abc
│   └── current/                 # Symlinks to latest version
│       ├── piano.abc -> ../versions/v003/piano.abc
│       ├── banjo.abc -> ../versions/v003/banjo.abc
│       └── bass.abc -> ../versions/v003/bass.abc
│
└── another-project/
    └── ...
```

**Workflow**:
```
User: "Go back to the previous version of the guitar part"
Claude:
  1. Identifies current version (v003)
  2. Finds previous guitar (v002)
  3. Creates v004 with v003's files but v002's guitar
  4. Updates current/ symlinks
  5. Pushes to Bitwig via controller
```

**Key Features** (to implement):
- Each version is a snapshot of all parts
- Can selectively revert individual parts
- Bitwig always has `current/` loaded
- Version metadata in `song.yaml`:
  ```yaml
  name: Honky Tonk Demo
  current_version: v003
  versions:
    v001:
      created: 2026-01-02T10:00:00Z
      note: "Initial version"
    v002:
      created: 2026-01-02T11:30:00Z
      note: "Changed banjo strumming pattern"
      changes: [banjo]
    v003:
      created: 2026-01-02T12:00:00Z
      note: "Reverted banjo to v001"
      changes: [banjo]
      reverted_from: v001
  ```

**DO NOT IMPLEMENT YET** - Document only for future development.

### Compose CLI Usage

```bash
# Install dependencies
cd compose && npm install

# Validate ABC files
npx ts-node src/cli.ts validate ./song/piano.abc

# Validate directory (check bar counts match)
npx ts-node src/cli.ts validate ./song/ --bars

# Parse and display structure
npx ts-node src/cli.ts parse ./song/piano.abc

# Show system info
npx ts-node src/cli.ts info
```

---

## License

MIT License - See LICENSE file

---

**Last Updated**: 2026-01-02
**Version**: 0.8.0
**Maintainer**: Audio Forge RS
