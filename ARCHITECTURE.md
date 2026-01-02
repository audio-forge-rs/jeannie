# Jeannie Architecture - Content Index System

## Overview

Jeannie provides instant searchable access to ALL Bitwig browser content through a unified indexed search system:

- **Devices**: VST2, VST3, CLAP, Bitwig native instruments and effects
- **Presets**: Plugin presets (Kontakt instruments, M-Tron patches, synth presets, etc.)
- **Samples**: Audio files, loops, one-shots
- **Clips**: MIDI clips, audio clips (future)
- **Multisample**: Multisampled instruments (future)

## Component Responsibilities

### Controller (Bitwig)
- **On Init**: Scans ALL browser content (devices, presets, samples)
- **Content Types**: Iterates through all PopupBrowser content types
- **Periodic Check**: Monitors for rescan flag every 10 seconds
- **Output**: Writes `~/.config/jeannie/content.json`

### Web Server
- **On Startup**: Loads content index from JSON file
- **Search API**: Unified search across all content types
- **Filtering**: By content type, creator, category, file type
- **Rescan Trigger**: Creates rescan flag for controller

### Roger CLI
- **Query Interface**: Search and list all content (devices, presets, samples)
- **Content Types**: Filter by type (device, preset, sample)
- **Management**: Trigger rescans, view statistics

## Data Flow

```
┌─────────────┐
│   Bitwig    │
│ (Controller)│
└──────┬──────┘
       │ scan on init
       │ check flag every 10s
       ▼
┌─────────────────────────────┐
│ ~/.config/jeannie/          │
│ ├── content.json  (index)   │
│ └── rescan.flag  (trigger)  │
└──────┬──────────────────────┘
       │ read on startup
       │ watch for changes
       ▼
┌─────────────┐      ┌──────────┐
│ Web Server  │◀────▶│  Roger   │
│   (API)     │      │   CLI    │
└─────────────┘      └──────────┘
       │
       ▼
┌─────────────┐
│   Browser   │
│  (Web UI)   │
└─────────────┘
```

## File Formats

### content.json
```json
{
  "version": "0.2.0",
  "scanDate": "2026-01-02T15:30:00.000Z",
  "bitwigVersion": "5.3.0",
  "scanDurationMs": 125430,
  "contentTypes": ["Device", "Preset", "Sample"],
  "totals": {
    "devices": 9847,
    "presets": 45230,
    "samples": 12093,
    "total": 67170
  },
  "content": [
    {
      "index": 0,
      "contentType": "Device",
      "name": "Polysynth",
      "deviceType": "Instrument",
      "fileType": "Bitwig",
      "creator": "Bitwig",
      "category": "Synthesizer",
      "nameTokens": ["polysynth"]
    },
    {
      "index": 1,
      "contentType": "Preset",
      "name": "Kontakt - Steinway Grand Piano",
      "creator": "Native Instruments",
      "category": "Piano",
      "plugin": "Kontakt 7",
      "nameTokens": ["kontakt", "steinway", "grand", "piano"]
    },
    {
      "index": 2,
      "contentType": "Preset",
      "name": "M-Tron Pro - Mellotron Flute",
      "creator": "GForce Software",
      "category": "Mellotron",
      "plugin": "M-Tron Pro IV",
      "nameTokens": ["m", "tron", "pro", "mellotron", "flute"]
    },
    {
      "index": 3,
      "contentType": "Sample",
      "name": "Acoustic Snare Tight.wav",
      "category": "Drums",
      "sampleRate": 44100,
      "duration": 1.23,
      "nameTokens": ["acoustic", "snare", "tight", "wav"]
    }
  ],
  "stats": {
    "byContentType": {
      "Device": 9847,
      "Preset": 45230,
      "Sample": 12093
    },
    "devices": {
      "byType": {
        "Instrument": 4523,
        "Audio FX": 3891,
        "Note FX": 1433
      },
      "byFileType": {
        "VST3": 5234,
        "CLAP": 1203,
        "Bitwig": 3410
      }
    },
    "presets": {
      "byPlugin": {
        "Kontakt 7": 15230,
        "M-Tron Pro IV": 892,
        "Massive X": 1203
      }
    },
    "byCreator": {
      "Native Instruments": 16892,
      "Bitwig": 14203,
      "GForce Software": 1103
    }
  }
}
```

### rescan.flag
```json
{
  "requestedAt": "2026-01-02T16:00:00.000Z",
  "requestedBy": "roger-cli",
  "reason": "User requested rescan"
}
```

## Rescan Flow

```
User triggers rescan:
  ├─ Roger CLI: `roger devices rescan`
  ├─ Web UI: POST /api/devices/rescan
  └─ Direct: `touch ~/.config/jeannie/rescan.flag`

Controller detects flag (10s poll):
  1. Read rescan.flag
  2. Log scan start
  3. Enumerate all content types (60-120s)
     - Devices (VST, CLAP, Bitwig)
     - Presets (Kontakt, M-Tron, etc.)
     - Samples (WAV, AIFF, etc.)
  4. Write content.json
  5. Delete rescan.flag
  6. Log completion

Web server detects change:
  1. File watcher on content.json
  2. Reload index
  3. Rebuild search structures
  4. Log completion
```

## API Endpoints

### Content Search
```
GET /api/content                            # List all content (paginated)
GET /api/content/search?q=<query>          # Search all content
GET /api/content/search?q=<query>&type=Preset  # Search presets only
GET /api/content/search?q=kontakt+piano&fuzzy=true  # Fuzzy search
GET /api/content/stats                      # Statistics
GET /api/content/types                      # List content types
GET /api/content/creators                   # List all creators
```

### Legacy Device Endpoints (Aliases)
```
GET /api/devices → /api/content?type=Device
GET /api/devices/search → /api/content/search&type=Device
```

### Content Management
```
POST /api/content/rescan                    # Trigger full rescan
GET /api/content/status                     # Index status
```

### Roger Commands
```bash
# Search all content
roger search <query>                        # All content types
roger search <query> --type preset         # Presets only
roger search "kontakt piano"               # Exact phrase
roger search "akoustic snare" --fuzzy     # Fuzzy search

# List content
roger content list                         # All content
roger content list --type device          # Devices only
roger content list --creator "Native Instruments"

# Statistics
roger content stats                        # All statistics

# Management
roger content rescan                       # Trigger rescan
roger content status                       # Check scan status
```

## Search Performance

### Indexing Strategy
- **Token Index**: Map<token, Set<deviceIndex>>
- **Creator Index**: Map<creator, deviceIndex[]>
- **Type Index**: Map<type, deviceIndex[]>
- **Category Index**: Map<category, deviceIndex[]>

### Query Performance
| Operation | Complexity | Time |
|-----------|------------|------|
| Exact match | O(1) | <1ms |
| Token AND search | O(k log n) | <5ms |
| Fuzzy search | O(n × m) | 10-50ms |
| Filter by type | O(k) | <2ms |

### Memory Usage
- ~67,000 content items @ ~200 bytes each = ~13 MB
- Index structures = ~8 MB
- **Total**: ~21 MB (negligible)

## Web UI Navigation

The web interface provides separate views for different concerns:

```
┌─────────────────────────────┐
│  Navigation Bar             │
│  [Search] [Status] [Stats]  │
└─────────────────────────────┘

/search (default)
├── Search bar with auto-complete
├── Content type filter tabs
│   ├── All (67k items)
│   ├── Devices (9.8k)
│   ├── Presets (45k)
│   └── Samples (12k)
├── Creator filter
├── Category filter
└── Results grid with pagination

/status
├── System health
├── Bitwig connection status
├── Roger connection status
├── Config viewer
└── Version information

/stats
├── Content statistics
│   ├── Total content: 67,170
│   ├── By type (pie chart)
│   └── By creator (bar chart)
├── Scan information
│   ├── Last scan date
│   ├── Scan duration
│   └── Rescan button
└── Performance metrics
```

### Example Search Flow
```
1. User lands on /search
2. Types "kontakt piano" in search bar
3. Auto-complete shows suggestions
4. Selects "Presets" tab to filter
5. Clicks search → Results in ~2ms
6. Displays:
   - Kontakt - Steinway Grand Piano
   - Kontakt - Yamaha C7 Grand
   - Kontakt - Upright Piano
   ... (25 results)
```

## Implementation Phases

### Phase 1: Core Scanning ✓
- [x] Controller device enumeration
- [x] JSON file output
- [x] Basic type declarations

### Phase 2: Search Index (Current)
- [ ] Web server device index loader
- [ ] Search algorithms (exact, token, fuzzy)
- [ ] API endpoints

### Phase 3: Rescan Support
- [ ] Controller flag checking
- [ ] Web API rescan trigger
- [ ] Roger CLI rescan command

### Phase 4: Advanced Features
- [ ] Real-time index updates
- [ ] Device usage tracking
- [ ] Favorite devices
- [ ] Custom tags

## Error Handling

### Scan Failures
- Log to controller.log
- Keep previous devices.json
- Set error flag in status

### Invalid JSON
- Validate on load
- Fallback to empty index
- Log warning

### Concurrent Rescans
- Lock file mechanism
- Queue rescan requests
- Prevent duplicate scans

## Configuration

### Controller Settings (in config.yaml)
```yaml
deviceIndex:
  scanOnInit: true
  rescanCheckInterval: 10000  # ms
  outputPath: "~/.config/jeannie/devices.json"
  maxDevices: 50000
  timeout: 120000  # 2 minutes
```

### Web Server Settings
```yaml
deviceIndex:
  autoReload: true
  watchFile: true
  cacheResults: true
  maxSearchResults: 1000
```

## Future Enhancements

1. **Incremental Updates**: Only scan changed plugins
2. **Cloud Sync**: Share device index across machines
3. **Preset Search**: Extend to search device presets
4. **Sample Search**: Index samples and audio files
5. **AI Recommendations**: Suggest devices based on usage
6. **Plugin Compatibility**: Track which plugins crash/work
7. **Performance Metrics**: Device CPU usage tracking

## Testing Strategy

### Unit Tests
- Token parsing
- Search algorithms
- Index building

### Integration Tests
- Full scan → search flow
- Rescan functionality
- File watching

### Performance Tests
- 10,000 device scan time
- Search response time
- Memory usage under load

## Monitoring

### Metrics to Track
- Scan duration
- Device count changes
- Search query performance
- API response times
- Index reload frequency

### Logging
- Controller: Scan start/end, errors
- Web: Index reloads, search queries
- Roger: Command execution

---

**Version**: 0.1.0 (Draft)
**Last Updated**: 2026-01-02
**Status**: In Development
