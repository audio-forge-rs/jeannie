#!/usr/bin/env node
/**
 * Jeannie CLI
 * Vendor: Audio Forge RS
 *
 * Unified CLI for Jeannie Bitwig Controller ecosystem.
 * Combines general control (health, status, content, track) with
 * composition tools (ABC validation, MIDI conversion).
 *
 * Usage:
 *   jeannie [global-options] <command> [command-options]
 *
 * Examples:
 *   jeannie health
 *   jeannie track list
 *   jeannie track create --name "Piano" --type instrument
 *   jeannie content search "strings" --fuzzy
 *   jeannie validate ./song.abc
 *   jeannie convert ./song.abc --output ./midi/
 */

import { Command } from 'commander';
import { validateAbcFile, validateAbcDirectory } from './abc/validator';
import { parseAbcFile } from './abc/parser';
import { convertAbcFileToMidi, convertAbcDirectory } from './midi/converter';
import * as fs from 'fs';
import * as path from 'path';
import { parseMidi } from 'midi-file';

// Load versions from single source of truth
const VERSIONS_FILE = path.join(__dirname, '..', '..', 'versions.json');
const versions = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));
const VERSION = versions.compose;

// API configuration
const DEFAULT_API_URL = 'http://localhost:3000';

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp?: string;
}

// =============================================================================
// API Client
// =============================================================================

class JeannieClient {
  private apiUrl: string;

  constructor(apiUrl: string = DEFAULT_API_URL) {
    this.apiUrl = apiUrl;
  }

  async request(endpoint: string, method: string = 'GET', body?: any): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      return await response.json() as ApiResponse;
    } catch (error) {
      return { success: false, error: `API request failed: ${error}` };
    }
  }

  // Health & Status
  async hello(): Promise<ApiResponse> {
    return this.request('/api/hello');
  }

  async health(): Promise<ApiResponse> {
    return this.request('/health');
  }

  async status(): Promise<ApiResponse> {
    return this.request('/api/status');
  }

  async version(): Promise<ApiResponse> {
    return this.request('/api/version');
  }

  async config(): Promise<ApiResponse> {
    return this.request('/api/config');
  }

  // Content
  async contentSearch(query: string, options: {
    fuzzy?: boolean;
    type?: string;
    creator?: string;
    limit?: number;
  } = {}): Promise<ApiResponse> {
    const params = new URLSearchParams({ q: query });
    if (options.fuzzy) params.set('fuzzy', 'true');
    if (options.type) params.set('type', options.type);
    if (options.creator) params.set('creator', options.creator);
    if (options.limit) params.set('limit', options.limit.toString());
    return this.request(`/api/content/search?${params}`);
  }

  async contentStats(): Promise<ApiResponse> {
    return this.request('/api/content/stats');
  }

  async contentTypes(): Promise<ApiResponse> {
    return this.request('/api/content/types');
  }

  async contentCreators(): Promise<ApiResponse> {
    return this.request('/api/content/creators');
  }

  async contentList(options: {
    type?: string;
    creator?: string;
    category?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (options.type) params.set('type', options.type);
    if (options.creator) params.set('creator', options.creator);
    if (options.category) params.set('category', options.category);
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    return this.request(`/api/content?${params}`);
  }

  async contentCategories(): Promise<ApiResponse> {
    return this.request('/api/content/categories');
  }

  async contentStatus(): Promise<ApiResponse> {
    return this.request('/api/content/status');
  }

  async contentRescan(): Promise<ApiResponse> {
    return this.request('/api/content/rescan', 'POST');
  }

  // Track Management
  async trackList(): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks');
  }

  async trackCurrent(): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks/current');
  }

  async trackCreate(type: string, name?: string, position: number = -1): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks', 'POST', { type, name, position });
  }

  async trackSelect(index: number): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks/select', 'POST', { index });
  }

  async trackNavigate(direction: string): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks/navigate', 'POST', { direction });
  }

  async trackRename(name: string): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks/rename', 'POST', { name });
  }

  async trackMute(mute: boolean): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks/mute', 'POST', { mute });
  }

  async trackSolo(solo: boolean): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks/solo', 'POST', { solo });
  }

  async trackVolume(volume: number): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks/volume', 'POST', { volume });
  }

  async trackPan(pan: number): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks/pan', 'POST', { pan });
  }

  async trackSetup(name: string, trackName?: string): Promise<ApiResponse> {
    return this.request('/api/bitwig/tracks/setup', 'POST', { name, trackName });
  }

  // Clip operations
  async clipCreate(slotIndex: number, lengthInBeats: number): Promise<ApiResponse> {
    return this.request('/api/bitwig/clips', 'POST', { slotIndex, lengthInBeats });
  }

  async clipSetNotes(notes: NoteData[]): Promise<ApiResponse> {
    return this.request('/api/bitwig/clips/notes', 'POST', { notes });
  }

  async clipClear(): Promise<ApiResponse> {
    return this.request('/api/bitwig/clips/notes', 'DELETE');
  }
}

// Note data for clip operations
interface NoteData {
  pitch: number;
  start: number;      // in beats
  duration: number;   // in beats
  velocity: number;
  channel?: number;
}

// MIDI file parsing helper
interface ParsedMidiData {
  notes: NoteData[];
  lengthInBeats: number;
  ticksPerBeat: number;
  noteCount: number;
}

function parseMidiFile(filePath: string): ParsedMidiData {
  const buffer = fs.readFileSync(filePath);
  const midi = parseMidi(buffer);

  const ticksPerBeat = midi.header.ticksPerBeat || 480;
  const notes: NoteData[] = [];
  let maxTick = 0;

  // Track active notes (for note-off matching)
  const activeNotes: Map<string, { pitch: number; velocity: number; startTick: number; channel: number }> = new Map();

  for (const track of midi.tracks) {
    let currentTick = 0;

    for (const event of track) {
      currentTick += event.deltaTime;

      if (event.type === 'noteOn' && event.velocity > 0) {
        // Note on
        const key = `${event.channel}-${event.noteNumber}`;
        activeNotes.set(key, {
          pitch: event.noteNumber,
          velocity: event.velocity,
          startTick: currentTick,
          channel: event.channel
        });
      } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
        // Note off
        const key = `${event.channel}-${event.noteNumber}`;
        const activeNote = activeNotes.get(key);

        if (activeNote) {
          const startBeats = activeNote.startTick / ticksPerBeat;
          const durationTicks = currentTick - activeNote.startTick;
          const durationBeats = durationTicks / ticksPerBeat;

          notes.push({
            pitch: activeNote.pitch,
            start: startBeats,
            duration: durationBeats,
            velocity: activeNote.velocity,
            channel: activeNote.channel
          });

          activeNotes.delete(key);
        }
      }

      if (currentTick > maxTick) {
        maxTick = currentTick;
      }
    }
  }

  // Sort notes by start time
  notes.sort((a, b) => a.start - b.start);

  // Calculate length in beats (round up to nearest bar, assuming 4/4)
  const lengthInBeats = Math.ceil(maxTick / ticksPerBeat / 4) * 4;

  return {
    notes,
    lengthInBeats: Math.max(lengthInBeats, 4), // Minimum 1 bar
    ticksPerBeat,
    noteCount: notes.length
  };
}

// =============================================================================
// Output Helpers
// =============================================================================

function printSuccess(message: string): void {
  console.log(`✓ ${message}`);
}

function printError(message: string): void {
  console.error(`✗ ${message}`);
}

function printJson(data: any): void {
  console.log(JSON.stringify(data, null, 2));
}

// =============================================================================
// CLI Setup
// =============================================================================

const program = new Command();

program
  .name('jeannie')
  .description('Jeannie Bitwig Controller CLI')
  .version(VERSION)
  .option('--api-url <url>', 'API server URL', DEFAULT_API_URL)
  .option('--json', 'Output raw JSON');

// Get client from program options
function getClient(): JeannieClient {
  const opts = program.opts();
  return new JeannieClient(opts.apiUrl);
}

function shouldOutputJson(): boolean {
  return program.opts().json;
}

// =============================================================================
// Health & Status Commands
// =============================================================================

program
  .command('hello')
  .description('Get hello world message from Jeannie')
  .action(async () => {
    const client = getClient();
    const response = await client.hello();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess('Hello from Jeannie!');
      if (response.data?.message) {
        console.log(`  ${response.data.message}`);
      }
      if (response.data?.version) {
        console.log(`  Server: v${response.data.version}`);
      }
    } else {
      printError(response.error || 'Hello failed');
      process.exit(1);
    }
  });

program
  .command('health')
  .description('Check Jeannie server health')
  .action(async () => {
    const client = getClient();
    const response = await client.health();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess('Server is healthy');
      console.log(`  Version: ${response.data?.version}`);
      console.log(`  Uptime: ${response.data?.uptime}s`);
    } else {
      printError(response.error || 'Health check failed');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show connection status (Bitwig & clients)')
  .action(async () => {
    const client = getClient();
    const response = await client.status();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      const { bitwig, roger } = response.data;
      console.log('Connection Status:');
      console.log(`  Bitwig: ${bitwig?.connected ? '✓ Connected' : '✗ Disconnected'}`);
      if (bitwig?.controllerVersion) {
        console.log(`    Controller: v${bitwig.controllerVersion}`);
      }
    } else {
      printError(response.error || 'Status check failed');
      process.exit(1);
    }
  });

program
  .command('version')
  .description('Show all component versions')
  .action(async () => {
    const client = getClient();
    const response = await client.version();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      console.log('Versions:');
      console.log(`  CLI: ${VERSION}`);
      console.log(`  Server: ${response.data?.jeannie}`);
      console.log(`  Controller: ${response.data?.controller}`);
    } else {
      printError(response.error || 'Version check failed');
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(async () => {
    const client = getClient();
    const response = await client.config();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printJson(response.data);
    } else {
      printError(response.error || 'Config fetch failed');
      process.exit(1);
    }
  });

// =============================================================================
// Content Commands
// =============================================================================

const contentCmd = program
  .command('content')
  .description('Content search and management');

contentCmd
  .command('search <query>')
  .description('Search content by name')
  .option('--fuzzy', 'Enable fuzzy matching')
  .option('--type <type>', 'Filter by type (Device, Preset, Sample)')
  .option('--creator <creator>', 'Filter by creator')
  .option('--limit <n>', 'Max results', '20')
  .action(async (query: string, options) => {
    const client = getClient();
    const response = await client.contentSearch(query, {
      fuzzy: options.fuzzy,
      type: options.type,
      creator: options.creator,
      limit: parseInt(options.limit)
    });

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      const results = response.data?.results || [];
      printSuccess(`Found ${response.data?.total || 0} results for "${query}"`);
      console.log();
      for (const item of results) {
        const score = item.score?.toFixed(2) || '1.00';
        console.log(`  [${score}] ${item.name} (${item.contentType})${item.creator ? ` - ${item.creator}` : ''}`);
      }
    } else {
      printError(response.error || 'Search failed');
      process.exit(1);
    }
  });

contentCmd
  .command('stats')
  .description('Show content statistics')
  .action(async () => {
    const client = getClient();
    const response = await client.contentStats();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess('Content Statistics');
      printJson(response.data);
    } else {
      printError(response.error || 'Stats fetch failed');
      process.exit(1);
    }
  });

contentCmd
  .command('types')
  .description('List available content types')
  .action(async () => {
    const client = getClient();
    const response = await client.contentTypes();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess('Content Types');
      for (const type of response.data || []) {
        console.log(`  - ${type}`);
      }
    } else {
      printError(response.error || 'Types fetch failed');
      process.exit(1);
    }
  });

contentCmd
  .command('creators')
  .description('List available creators')
  .action(async () => {
    const client = getClient();
    const response = await client.contentCreators();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      const creators = response.data || [];
      printSuccess(`${creators.length} creators`);
      for (const creator of creators.slice(0, 50)) {
        console.log(`  - ${creator}`);
      }
      if (creators.length > 50) {
        console.log(`  ... and ${creators.length - 50} more`);
      }
    } else {
      printError(response.error || 'Creators fetch failed');
      process.exit(1);
    }
  });

contentCmd
  .command('list')
  .description('List content with filters')
  .option('--type <type>', 'Filter by content type')
  .option('--creator <creator>', 'Filter by creator')
  .option('--category <category>', 'Filter by category')
  .option('--limit <n>', 'Max results', '20')
  .option('--offset <n>', 'Offset for pagination', '0')
  .action(async (options) => {
    const client = getClient();
    const response = await client.contentList({
      type: options.type,
      creator: options.creator,
      category: options.category,
      limit: parseInt(options.limit),
      offset: parseInt(options.offset)
    });

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      const results = response.data?.results || [];
      printSuccess(`${response.data?.total || 0} items (showing ${results.length})`);
      console.log();
      for (const item of results) {
        console.log(`  ${item.name} (${item.contentType})${item.creator ? ` - ${item.creator}` : ''}`);
      }
    } else {
      printError(response.error || 'List failed');
      process.exit(1);
    }
  });

contentCmd
  .command('categories')
  .description('List available categories')
  .action(async () => {
    const client = getClient();
    const response = await client.contentCategories();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      const categories = response.data || [];
      printSuccess(`${categories.length} categories`);
      for (const category of categories.slice(0, 50)) {
        console.log(`  - ${category}`);
      }
      if (categories.length > 50) {
        console.log(`  ... and ${categories.length - 50} more`);
      }
    } else {
      printError(response.error || 'Categories fetch failed');
      process.exit(1);
    }
  });

contentCmd
  .command('status')
  .description('Get content index status')
  .action(async () => {
    const client = getClient();
    const response = await client.contentStatus();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess('Content Index Status');
      printJson(response.data);
    } else {
      printError(response.error || 'Status fetch failed');
      process.exit(1);
    }
  });

contentCmd
  .command('rescan')
  .description('Trigger content rescan')
  .action(async () => {
    const client = getClient();
    const response = await client.contentRescan();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess('Rescan requested');
      console.log('  Controller will detect within 10 seconds');
    } else {
      printError(response.error || 'Rescan request failed');
      process.exit(1);
    }
  });

// =============================================================================
// Track Commands
// =============================================================================

const trackCmd = program
  .command('track')
  .description('Track management');

trackCmd
  .command('list')
  .description('List all tracks in project')
  .action(async () => {
    const client = getClient();
    const response = await client.trackList();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      const tracks = response.data?.tracks || [];
      printSuccess(`${tracks.length} track(s) in project`);
      console.log();
      for (const track of tracks) {
        const muted = track.muted ? '[M]' : '   ';
        const soloed = track.soloed ? '[S]' : '   ';
        console.log(`  ${track.index}: ${muted}${soloed} ${track.name}`);
      }
    } else {
      printError(response.error || 'Track list failed');
      process.exit(1);
    }
  });

trackCmd
  .command('current')
  .description('Show current track info')
  .action(async () => {
    const client = getClient();
    const response = await client.trackCurrent();

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess('Current track');
      console.log(`  Name: ${response.data?.name}`);
      console.log(`  Position: ${response.data?.position}`);
      console.log(`  Muted: ${response.data?.muted}`);
      console.log(`  Soloed: ${response.data?.soloed}`);
    } else {
      printError(response.error || 'Track info failed');
      process.exit(1);
    }
  });

trackCmd
  .command('create')
  .description('Create a new track')
  .option('--type <type>', 'Track type: instrument, audio, effect', 'instrument')
  .option('--name <name>', 'Track name')
  .option('--position <n>', 'Insert position (-1 for end)', '-1')
  .action(async (options) => {
    const client = getClient();
    const response = await client.trackCreate(
      options.type,
      options.name,
      parseInt(options.position)
    );

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess(`Created ${options.type} track${options.name ? `: ${options.name}` : ''}`);
    } else {
      printError(response.error || 'Track creation failed');
      process.exit(1);
    }
  });

trackCmd
  .command('select <index>')
  .description('Select track by index')
  .action(async (index: string) => {
    const client = getClient();
    const response = await client.trackSelect(parseInt(index));

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess(`Selected track ${index}: ${response.data?.name}`);
    } else {
      printError(response.error || 'Track selection failed');
      process.exit(1);
    }
  });

trackCmd
  .command('next')
  .description('Select next track')
  .action(async () => {
    const client = getClient();
    const response = await client.trackNavigate('next');

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess(`Moved to: ${response.data?.name}`);
    } else {
      printError(response.error || 'Navigation failed');
      process.exit(1);
    }
  });

trackCmd
  .command('prev')
  .description('Select previous track')
  .action(async () => {
    const client = getClient();
    const response = await client.trackNavigate('previous');

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess(`Moved to: ${response.data?.name}`);
    } else {
      printError(response.error || 'Navigation failed');
      process.exit(1);
    }
  });

trackCmd
  .command('first')
  .description('Select first track')
  .action(async () => {
    const client = getClient();
    const response = await client.trackNavigate('first');

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess(`Moved to first track: ${response.data?.name}`);
    } else {
      printError(response.error || 'Navigation failed');
      process.exit(1);
    }
  });

trackCmd
  .command('last')
  .description('Select last track')
  .action(async () => {
    const client = getClient();
    const response = await client.trackNavigate('last');

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess(`Moved to last track: ${response.data?.name}`);
    } else {
      printError(response.error || 'Navigation failed');
      process.exit(1);
    }
  });

trackCmd
  .command('rename <name>')
  .description('Rename current track')
  .action(async (name: string) => {
    const client = getClient();
    const response = await client.trackRename(name);

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess(`Renamed track to: ${name}`);
    } else {
      printError(response.error || 'Rename failed');
      process.exit(1);
    }
  });

trackCmd
  .command('mute')
  .description('Mute current track')
  .option('--off', 'Unmute instead')
  .action(async (options) => {
    const client = getClient();
    const mute = !options.off;
    const response = await client.trackMute(mute);

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess(`Track ${mute ? 'muted' : 'unmuted'}`);
    } else {
      printError(response.error || 'Mute failed');
      process.exit(1);
    }
  });

trackCmd
  .command('solo')
  .description('Solo current track')
  .option('--off', 'Unsolo instead')
  .action(async (options) => {
    const client = getClient();
    const solo = !options.off;
    const response = await client.trackSolo(solo);

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess(`Track solo ${solo ? 'enabled' : 'disabled'}`);
    } else {
      printError(response.error || 'Solo failed');
      process.exit(1);
    }
  });

trackCmd
  .command('volume <value>')
  .description('Set track volume (0-100 or 0.0-1.0)')
  .action(async (value: string) => {
    const client = getClient();
    let volume = parseFloat(value);
    if (volume > 1) volume = volume / 100; // Treat as percentage
    volume = Math.max(0, Math.min(1, volume));

    const response = await client.trackVolume(volume);

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      printSuccess(`Track volume set to ${Math.round(volume * 100)}%`);
    } else {
      printError(response.error || 'Volume change failed');
      process.exit(1);
    }
  });

trackCmd
  .command('pan <value>')
  .description('Set track pan (-1.0 left to 1.0 right)')
  .action(async (value: string) => {
    const client = getClient();
    const pan = Math.max(-1, Math.min(1, parseFloat(value)));

    const response = await client.trackPan(pan);

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      const label = pan === 0 ? 'center' : (pan < 0 ? `${Math.abs(Math.round(pan * 100))}% left` : `${Math.round(pan * 100)}% right`);
      printSuccess(`Track pan set to ${label}`);
    } else {
      printError(response.error || 'Pan change failed');
      process.exit(1);
    }
  });

trackCmd
  .command('device <name> [trackName]')
  .description('Setup track with instrument/preset (searches content, creates track if needed)')
  .action(async (name: string, trackName: string | undefined) => {
    const client = getClient();
    const response = await client.trackSetup(name, trackName);

    if (shouldOutputJson()) {
      printJson(response);
    } else if (response.success) {
      const data = response.data;
      const created = data?.trackCreated ? ' (created)' : '';
      const type = data?.insertionType === 'preset' ? data?.plugin : data?.deviceType;
      printSuccess(`${data?.content} (${type}) → ${data?.track}${created}`);
      // Show note about manual preset loading if applicable
      if (data?.note) {
        console.log(`  Note: ${data.note}`);
      }
      if (data?.presetPath) {
        console.log(`  Preset: ${data.presetPath}`);
      }
    } else {
      printError(response.error || 'Track setup failed');
      process.exit(1);
    }
  });

// =============================================================================
// ABC/MIDI Commands (Composition)
// =============================================================================

program
  .command('validate <path>')
  .description('Validate ABC notation files')
  .option('--strict', 'Enable strict validation (warnings as errors)')
  .option('--bars', 'Check that all parts have the same number of bars')
  .action(async (inputPath: string, options) => {
    const stats = fs.statSync(inputPath);

    if (stats.isDirectory()) {
      const result = await validateAbcDirectory(inputPath, {
        strict: options.strict,
        checkBars: options.bars
      });

      if (result.valid) {
        printSuccess('All ABC files are valid');
        if (result.warnings.length > 0) {
          console.log(`\nWarnings (${result.warnings.length}):`);
          result.warnings.forEach(w => console.log(`  - ${w}`));
        }
      } else {
        printError('Validation failed');
        result.errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
      }
    } else {
      const result = await validateAbcFile(inputPath, {
        strict: options.strict
      });

      if (result.valid) {
        printSuccess(`${inputPath} is valid`);
        console.log(`  Title: ${result.metadata?.title || 'Unknown'}`);
        console.log(`  Key: ${result.metadata?.key || 'Unknown'}`);
        console.log(`  Meter: ${result.metadata?.meter || 'Unknown'}`);
        console.log(`  Bars: ${result.barCount || 'Unknown'}`);
      } else {
        printError(`${inputPath} is invalid`);
        result.errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
      }
    }
  });

program
  .command('parse <file>')
  .description('Parse and display ABC notation structure')
  .action(async (file: string) => {
    const result = parseAbcFile(file);

    if (result.error) {
      printError(result.error);
      process.exit(1);
    }

    console.log('Metadata:');
    console.log(`  Title: ${result.metadata?.title}`);
    console.log(`  Composer: ${result.metadata?.composer || 'Unknown'}`);
    console.log(`  Key: ${result.metadata?.key}`);
    console.log(`  Meter: ${result.metadata?.meter}`);
    console.log(`  Tempo: ${result.metadata?.tempo || 'Default'}`);

    console.log('\nVoices:');
    result.voices?.forEach((voice, i) => {
      console.log(`  [${i + 1}] ${voice.id}: ${voice.name || 'Unnamed'}`);
      console.log(`      Bars: ${voice.barCount}`);
    });
  });

program
  .command('convert <path>')
  .description('Convert ABC notation to MIDI')
  .option('-o, --output <dir>', 'Output directory for MIDI files')
  .option('--validate', 'Validate before converting')
  .option('--bpm <number>', 'Override tempo (BPM)', parseInt)
  .option('--transpose <semitones>', 'Transpose by semitones', parseInt)
  .action(async (inputPath: string, options) => {
    // Validate first if requested
    if (options.validate) {
      console.log('Validating ABC...');
      const stats = fs.statSync(inputPath);

      if (stats.isDirectory()) {
        const valResult = await validateAbcDirectory(inputPath, { checkBars: true });
        if (!valResult.valid) {
          printError('Validation failed');
          valResult.errors.forEach(e => console.error(`  - ${e}`));
          process.exit(1);
        }
        printSuccess('Validation passed');
      } else {
        const valResult = await validateAbcFile(inputPath);
        if (!valResult.valid) {
          printError('Validation failed');
          valResult.errors.forEach(e => console.error(`  - ${e}`));
          process.exit(1);
        }
        printSuccess('Validation passed');
      }
    }

    // Convert
    console.log('Converting to MIDI...');

    const stats = fs.statSync(inputPath);
    const conversionOptions = {
      bpm: options.bpm,
      transpose: options.transpose,
      outputDir: options.output
    };

    if (stats.isDirectory()) {
      const result = await convertAbcDirectory(inputPath, conversionOptions);

      console.log(`\nResults: ${result.successCount}/${result.totalFiles} files converted`);

      for (const [file, fileResult] of Object.entries(result.results)) {
        if (fileResult.success) {
          console.log(`  [OK] ${file} -> ${fileResult.outputPath}`);
          console.log(`       Tracks: ${fileResult.trackCount}, Notes: ${fileResult.noteCount}`);
        } else {
          console.error(`  [FAIL] ${file}: ${fileResult.error}`);
        }
      }

      if (result.failCount > 0) {
        process.exit(1);
      }
    } else {
      let outputPath = options.output;
      if (outputPath && fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
        const baseName = path.basename(inputPath, '.abc');
        outputPath = path.join(outputPath, baseName + '.mid');
      }

      const result = await convertAbcFileToMidi(inputPath, {
        ...conversionOptions,
        outputPath
      });

      if (result.success) {
        printSuccess('Converted successfully');
        console.log(`  Output: ${result.outputPath}`);
        console.log(`  Tracks: ${result.trackCount}`);
        console.log(`  Notes: ${result.noteCount}`);
      } else {
        printError(`Conversion failed: ${result.error}`);
        process.exit(1);
      }
    }
  });

program
  .command('load <path>')
  .description('Load MIDI files into Bitwig')
  .option('--dry-run', 'Show what would be done without making changes')
  .action(async (inputPath: string, options) => {
    const client = getClient();

    // Check Bitwig connection
    console.log('Checking Bitwig connection...');
    const status = await client.status();

    if (!status.success || !status.data?.bitwig?.connected) {
      printError('Bitwig is not running or controller not loaded');
      console.log('Please ensure:');
      console.log('  1. Bitwig Studio is running');
      console.log('  2. Jeannie controller is enabled');
      console.log('  3. Jeannie web server is running');
      process.exit(1);
    }
    printSuccess('Bitwig connected');

    // Find MIDI files
    if (!fs.existsSync(inputPath)) {
      printError(`Path not found: ${inputPath}`);
      process.exit(1);
    }

    const stats = fs.statSync(inputPath);
    const midiFiles: string[] = [];

    if (stats.isDirectory()) {
      const entries = fs.readdirSync(inputPath);
      for (const entry of entries) {
        if (entry.endsWith('.mid') || entry.endsWith('.midi')) {
          midiFiles.push(path.join(inputPath, entry));
        }
      }
    } else if (inputPath.endsWith('.mid') || inputPath.endsWith('.midi')) {
      midiFiles.push(inputPath);
    } else if (inputPath.endsWith('.abc')) {
      console.log('Converting ABC to MIDI...');
      const result = await convertAbcFileToMidi(inputPath);
      if (result.success && result.outputPath) {
        midiFiles.push(result.outputPath);
        printSuccess(`Converted to: ${result.outputPath}`);
      } else {
        printError(`Failed to convert ABC: ${result.error}`);
        process.exit(1);
      }
    }

    if (midiFiles.length === 0) {
      printError('No MIDI files found');
      process.exit(1);
    }

    console.log(`\nFound ${midiFiles.length} MIDI file(s):`);
    midiFiles.forEach(f => console.log(`  - ${path.basename(f)}`));

    if (options.dryRun) {
      console.log('\n[DRY RUN] Would create tracks:');
      for (const midiFile of midiFiles) {
        const trackName = path.basename(midiFile, path.extname(midiFile));
        console.log(`  - Instrument track: "${trackName}"`);
      }
      console.log('\nUse without --dry-run to actually create tracks.');
      return;
    }

    // Parse MIDI files first
    console.log('\nParsing MIDI files...');
    const parsedFiles: { file: string; trackName: string; data: ParsedMidiData }[] = [];

    for (const midiFile of midiFiles) {
      const trackName = path.basename(midiFile, path.extname(midiFile));
      try {
        const data = parseMidiFile(midiFile);
        console.log(`  ✓ ${trackName}: ${data.noteCount} notes, ${data.lengthInBeats} beats`);
        parsedFiles.push({ file: midiFile, trackName, data });
      } catch (e) {
        console.error(`  ✗ ${trackName}: Failed to parse - ${e}`);
      }
    }

    if (parsedFiles.length === 0) {
      printError('No MIDI files could be parsed');
      process.exit(1);
    }

    // Create tracks and load clips
    console.log('\nCreating tracks and loading clips in Bitwig...');
    let successCount = 0;
    let totalNotes = 0;

    for (let i = 0; i < parsedFiles.length; i++) {
      const { trackName, data } = parsedFiles[i];
      console.log(`\n[${i + 1}/${parsedFiles.length}] ${trackName}:`);

      // Create the track
      console.log(`  Creating track...`);
      const createResult = await client.trackCreate('instrument', trackName);

      if (!createResult.success) {
        console.error(`  ✗ Failed to create track: ${createResult.error}`);
        continue;
      }
      console.log(`  ✓ Track created`);

      // Small delay to ensure track is ready and selected
      // (newly created track should already be selected)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create a clip in slot 0
      console.log(`  Creating clip (${data.lengthInBeats} beats)...`);
      const clipResult = await client.clipCreate(0, data.lengthInBeats);

      if (!clipResult.success) {
        console.error(`  ✗ Failed to create clip: ${clipResult.error}`);
        continue;
      }
      console.log(`  ✓ Clip created`);

      // Small delay before setting notes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Set the notes
      console.log(`  Loading ${data.noteCount} notes...`);
      const notesResult = await client.clipSetNotes(data.notes);

      if (!notesResult.success) {
        console.error(`  ✗ Failed to set notes: ${notesResult.error}`);
        continue;
      }
      console.log(`  ✓ Notes loaded`);

      successCount++;
      totalNotes += data.noteCount;
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`✓ ${successCount}/${parsedFiles.length} tracks loaded`);
    console.log(`✓ ${totalNotes} total notes imported`);
    console.log(`${'═'.repeat(50)}`);

    if (successCount > 0) {
      console.log('\nNext steps:');
      console.log('  1. Select instruments for each track');
      console.log('  2. Add effects and mixing');
      console.log('  3. Press play!');
    }

    if (successCount !== parsedFiles.length) {
      process.exit(1);
    }
  });

// =============================================================================
// Info Command
// =============================================================================

program
  .command('info')
  .description('Show CLI capabilities and system info')
  .action(() => {
    console.log('Jeannie CLI');
    console.log('===========');
    console.log(`Version: ${VERSION}`);
    console.log(`API: ${program.opts().apiUrl}`);

    console.log('\nCapabilities:');
    console.log('  [x] Server health/status monitoring');
    console.log('  [x] Content search (devices, presets, samples)');
    console.log('  [x] Track management (create, select, mute, solo, volume, pan)');
    console.log('  [x] ABC notation parsing and validation');
    console.log('  [x] ABC to MIDI conversion');
    console.log('  [x] Bitwig track creation from MIDI');
    console.log('  [ ] Live MIDI note sending (planned)');

    console.log('\nCommands:');
    console.log('  jeannie health              Server health check');
    console.log('  jeannie status              Connection status');
    console.log('  jeannie content search <q>  Search content');
    console.log('  jeannie track list          List tracks');
    console.log('  jeannie track create        Create track');
    console.log('  jeannie validate <path>     Validate ABC');
    console.log('  jeannie convert <path>      ABC to MIDI');
    console.log('  jeannie load <path>         Load into Bitwig');
  });

// Parse and run
program.parse();
