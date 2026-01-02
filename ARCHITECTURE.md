# Jeannie Architecture - Device Index System

## Overview

Jeannie provides instant searchable access to all Bitwig devices (VST, CLAP, native) through an indexed search system.

## Component Responsibilities

### Controller (Bitwig)
- **On Init**: Scans all devices and builds comprehensive index
- **Periodic Check**: Monitors for rescan flag every 10 seconds
- **Output**: Writes `~/.config/jeannie/devices.json`

### Web Server
- **On Startup**: Loads device index from JSON file
- **Search API**: Provides fast search endpoints
- **Rescan Trigger**: Creates rescan flag for controller

### Roger CLI
- **Query Interface**: Search and list devices
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
│ ├── devices.json  (index)   │
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

### devices.json
```json
{
  "version": "0.1.0",
  "scanDate": "2026-01-02T15:30:00.000Z",
  "bitwigVersion": "5.3.0",
  "totalDevices": 9847,
  "scanDurationMs": 45230,
  "devices": [
    {
      "index": 0,
      "name": "Polysynth",
      "type": "Instrument",
      "fileType": "Bitwig",
      "creator": "Bitwig",
      "category": "Synthesizer",
      "nameTokens": ["polysynth"]
    },
    {
      "index": 1,
      "name": "Acoustic Snare Natural",
      "type": "Instrument",
      "fileType": "Bitwig",
      "creator": "Bitwig",
      "category": "Drums",
      "nameTokens": ["acoustic", "snare", "natural"]
    }
  ],
  "stats": {
    "byType": {
      "Instrument": 4523,
      "Audio FX": 3891,
      "Note FX": 1433
    },
    "byFileType": {
      "VST3": 5234,
      "CLAP": 1203,
      "Bitwig": 3410
    },
    "byCreator": {
      "Native Instruments": 892,
      "Arturia": 423,
      "Bitwig": 3410
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
  3. Enumerate all devices (30-60s)
  4. Write devices.json
  5. Delete rescan.flag
  6. Log completion

Web server detects change:
  1. File watcher on devices.json
  2. Reload index
  3. Rebuild search structures
  4. Log completion
```

## API Endpoints

### Device Search
```
GET /api/devices
GET /api/devices/search?q=<query>&fuzzy=true
GET /api/devices/stats
GET /api/devices/types
GET /api/devices/creators
```

### Device Management
```
POST /api/devices/rescan
GET /api/devices/status
```

### Roger Commands
```bash
roger devices list              # List all devices
roger devices search <query>    # Search devices
roger devices stats             # Show statistics
roger devices rescan            # Trigger rescan
roger devices status            # Check scan status
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
- ~10,000 devices @ ~200 bytes each = ~2 MB
- Index structures = ~3 MB
- **Total**: ~5 MB (negligible)

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
