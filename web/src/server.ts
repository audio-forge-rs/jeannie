/**
 * Jeannie - REST API Server
 * Vendor: Audio Forge RS
 *
 * Main server providing REST API for Jeannie with web UI and connection status tracking
 * Version is read from /versions.json (single source of truth)
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import chokidar, { FSWatcher } from 'chokidar';
import { execSync } from 'child_process';
import { ConfigWatcher, CONFIG_PATH, JeannieConfig, ConnectionStatus } from './configWatcher';
import { ContentSearchIndex, SearchFilters } from './contentSearch';

// Load versions from single source of truth
const VERSIONS_FILE = path.join(__dirname, '..', '..', 'versions.json');
const versions = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));

// Controller log path for monitoring connection status
const CONTROLLER_LOG_PATH = path.join(os.homedir(), '.config', 'jeannie', 'logs', 'controller.log');

// Content index paths
const CONTENT_FILE = path.join(os.homedir(), '.config', 'jeannie', 'content.json');
const RESCAN_FLAG = path.join(os.homedir(), '.config', 'jeannie', 'rescan.flag');

// Track management paths (command/response communication with Bitwig controller)
const COMMANDS_FILE = path.join(os.homedir(), '.config', 'jeannie', 'commands.json');
const RESPONSE_FILE = path.join(os.homedir(), '.config', 'jeannie', 'response.json');

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  uptime: number;
  configFile: string;
  configLoaded: boolean;
}

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = versions.web;

const startTime = Date.now();
const configWatcher = new ConfigWatcher();
const contentSearchIndex = new ContentSearchIndex();

// Connection status tracking
const connectionStatus: ConnectionStatus = {
  bitwig: {
    connected: false,
    lastSeen: null,
    controllerVersion: null
  },
  roger: {
    connected: false,
    lastSeen: null,
    lastCommand: null
  }
};

// Connection timeout (30 seconds)
const CONNECTION_TIMEOUT = 30000;

// Log file path
// Note: Bitwig automatically creates a logs/ subdirectory, so the actual file will be at:
// ~/Library/Logs/Bitwig/logs/jeannie.log (macOS)
const LOG_DIR = path.join(os.homedir(), 'Library', 'Logs', 'Bitwig');
const LOG_FILE = path.join(LOG_DIR, 'jeannie.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log writing function
function writeToLogFile(level: string, message: string): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logLine, 'utf8');
}

// Helper function to check if connection is stale
function isConnectionStale(lastSeen: string | null): boolean {
  if (!lastSeen) return true;
  return Date.now() - new Date(lastSeen).getTime() > CONNECTION_TIMEOUT;
}

// Check if Bitwig process is running
function isBitwigRunning(): boolean {
  try {
    const { execSync } = require('child_process');
    // Cross-platform process check
    const cmd = process.platform === 'win32'
      ? 'tasklist'
      : 'ps aux';
    const output = execSync(cmd, { encoding: 'utf8' });
    return output.includes('Bitwig') || output.includes('BitwigStudio');
  } catch {
    return false;
  }
}

// Check Bitwig controller connection (process + log file)
function checkBitwigConnection(): void {
  try {
    // First check if Bitwig process is running
    const processRunning = isBitwigRunning();

    if (!processRunning) {
      connectionStatus.bitwig.connected = false;
      connectionStatus.bitwig.lastSeen = null;
      return;
    }

    // Process running - check if controller log exists (proves controller loaded)
    if (!fs.existsSync(CONTROLLER_LOG_PATH)) {
      connectionStatus.bitwig.connected = false;
      connectionStatus.bitwig.lastSeen = null;
      return;
    }

    // Read log to check for shutdown message and parse version
    const stats = fs.statSync(CONTROLLER_LOG_PATH);
    const logContent = fs.readFileSync(CONTROLLER_LOG_PATH, 'utf8');
    const lines = logContent.trim().split('\n');

    // Check if most recent log entry is a shutdown message
    const lastLine = lines[lines.length - 1] || '';
    if (lastLine.includes('Shutting down')) {
      // Controller is shutting down - mark as disconnected
      connectionStatus.bitwig.connected = false;
      connectionStatus.bitwig.lastSeen = stats.mtime.toISOString();
      return;
    }

    // Process is running AND log file exists = controller is loaded and active
    connectionStatus.bitwig.connected = true;
    connectionStatus.bitwig.lastSeen = stats.mtime.toISOString();

    // Parse version from log (always re-parse to ensure accuracy)
    // Check last 50 lines to ensure we find the version even with verbose logging
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 50); i--) {
      const match = lines[i].match(/Jeannie v([\d.]+)/);
      if (match) {
        connectionStatus.bitwig.controllerVersion = match[1];
        break;
      }
    }
  } catch {
    connectionStatus.bitwig.connected = false;
    connectionStatus.bitwig.lastSeen = null;
  }
}

// Event-driven Bitwig connection monitoring (no polling)
let logWatcher: FSWatcher | null = null;

// Initial check for Bitwig connection
checkBitwigConnection();

// Watch controller log file for changes (event-driven)
logWatcher = chokidar.watch(CONTROLLER_LOG_PATH, {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100
  }
});

logWatcher
  .on('add', () => checkBitwigConnection())
  .on('change', () => checkBitwigConnection())
  .on('unlink', () => {
    connectionStatus.bitwig.connected = false;
    connectionStatus.bitwig.lastSeen = null;
  });

// Also check connection status every 30 seconds (minimal polling for process check)
setInterval(checkBitwigConnection, 30000);

// Content index file watching (event-driven reload on rescans)
let contentWatcher: FSWatcher | null = null;

// Load content index on startup
contentSearchIndex.loadFromFile().then((loaded) => {
  if (!loaded) {
    console.log('[ContentSearch] No content index found - run a scan from Bitwig controller');
  }
});

// Watch content.json for changes (rescan completion)
if (fs.existsSync(CONTENT_FILE)) {
  contentWatcher = chokidar.watch(CONTENT_FILE, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });

  contentWatcher
    .on('change', () => {
      console.log('[ContentSearch] Content index changed, reloading...');
      contentSearchIndex.reload();
    });
}

// Helper function to create rescan flag
function createRescanFlag(): void {
  try {
    const flagData = {
      requestedAt: new Date().toISOString(),
      requestedBy: 'web-api',
      reason: 'User requested rescan'
    };
    fs.writeFileSync(RESCAN_FLAG, JSON.stringify(flagData, null, 2), 'utf8');
    console.log('[Rescan] Created rescan flag - controller will detect within 10 seconds');
  } catch (error) {
    console.error('[Rescan] Error creating rescan flag:', error);
    throw error;
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const config = configWatcher.getConfig();
  const response: ApiResponse<HealthResponse> = {
    success: true,
    data: {
      status: 'ok',
      version: VERSION,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      configFile: CONFIG_PATH,
      configLoaded: config !== null
    },
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Get current config
app.get('/api/config', (_req: Request, res: Response) => {
  const config = configWatcher.getConfig();
  const response: ApiResponse<JeannieConfig | null> = {
    success: true,
    data: config,
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Get Roger info from config
app.get('/api/roger', (_req: Request, res: Response) => {
  const config = configWatcher.getConfig();
  if (config && config.roger) {
    const response: ApiResponse = {
      success: true,
      data: config.roger,
      timestamp: new Date().toISOString()
    };
    res.json(response);
  } else {
    const response: ApiResponse = {
      success: false,
      error: 'Roger info not available in config',
      timestamp: new Date().toISOString()
    };
    res.status(404).json(response);
  }
});

// Get version info
app.get('/api/version', (_req: Request, res: Response) => {
  const config = configWatcher.getConfig();
  const response: ApiResponse = {
    success: true,
    data: {
      jeannie: VERSION,
      roger: config?.roger?.version || 'unknown',
      config: config?.version || 'unknown',
      controller: connectionStatus.bitwig.controllerVersion || 'unknown'
    },
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Connection status endpoint
app.get('/api/status', (_req: Request, res: Response) => {
  // Bitwig status is auto-updated by log file monitoring (every 5 seconds)
  // Only update Roger status based on last seen time
  connectionStatus.roger.connected = !isConnectionStale(connectionStatus.roger.lastSeen);

  const response: ApiResponse<ConnectionStatus> = {
    success: true,
    data: connectionStatus,
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Bitwig controller ping endpoint
app.post('/api/bitwig/ping', (req: Request, res: Response) => {
  const { version } = req.body;

  connectionStatus.bitwig.connected = true;
  connectionStatus.bitwig.lastSeen = new Date().toISOString();
  if (version) {
    connectionStatus.bitwig.controllerVersion = version;
  }

  const response: ApiResponse = {
    success: true,
    data: { message: 'Ping received' },
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Bitwig controller log endpoint
app.post('/api/bitwig/log', (req: Request, res: Response) => {
  const { level = 'info', message, version } = req.body;

  // Update connection status
  connectionStatus.bitwig.connected = true;
  connectionStatus.bitwig.lastSeen = new Date().toISOString();
  if (version) {
    connectionStatus.bitwig.controllerVersion = version;
  }

  // Write to log file
  if (message) {
    writeToLogFile(level, `[Bitwig] ${message}`);
  }

  const response: ApiResponse = {
    success: true,
    data: { message: 'Log received' },
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Roger command endpoint
app.post('/api/roger/command', (req: Request, res: Response) => {
  const { command } = req.body;

  connectionStatus.roger.connected = true;
  connectionStatus.roger.lastSeen = new Date().toISOString();
  if (command) {
    connectionStatus.roger.lastCommand = command;
  }

  const response: ApiResponse = {
    success: true,
    data: { message: 'Command received', command },
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Hello world endpoint
app.get('/api/hello', (_req: Request, res: Response) => {
  const config = configWatcher.getConfig();
  const rogerName = config?.roger?.name || 'unknown';
  const rogerVersion = config?.roger?.version || 'unknown';

  const response: ApiResponse = {
    success: true,
    data: {
      message: `Hello from Jeannie! Configured for ${rogerName} v${rogerVersion}`,
      jeannie: {
        name: 'jeannie',
        version: VERSION
      },
      roger: {
        name: rogerName,
        version: rogerVersion
      }
    },
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Content API endpoints

// Search content
app.get('/api/content/search', (req: Request, res: Response) => {
  const query = req.query.q as string;
  const fuzzy = req.query.fuzzy === 'true';
  const contentType = req.query.type as string | undefined;
  const creator = req.query.creator as string | undefined;
  const category = req.query.category as string | undefined;
  const limit = parseInt(req.query.limit as string) || 100;

  if (!query) {
    const response: ApiResponse = {
      success: false,
      error: 'Query parameter "q" is required',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  if (!contentSearchIndex.isLoaded()) {
    const response: ApiResponse = {
      success: false,
      error: 'Content index not loaded - run a scan from Bitwig controller',
      timestamp: new Date().toISOString()
    };
    res.status(503).json(response);
    return;
  }

  const filters: SearchFilters = {};
  if (contentType) filters.contentType = contentType;
  if (creator) filters.creator = creator;
  if (category) filters.category = category;

  const results = contentSearchIndex.search(query, filters, fuzzy);

  const response: ApiResponse = {
    success: true,
    data: {
      query,
      fuzzy,
      filters,
      total: results.length,
      results: results.slice(0, limit).map(r => ({
        ...r.item,
        score: r.score
      }))
    },
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// List content with filters
app.get('/api/content', (req: Request, res: Response) => {
  if (!contentSearchIndex.isLoaded()) {
    const response: ApiResponse = {
      success: false,
      error: 'Content index not loaded - run a scan from Bitwig controller',
      timestamp: new Date().toISOString()
    };
    res.status(503).json(response);
    return;
  }

  const contentType = req.query.type as string | undefined;
  const creator = req.query.creator as string | undefined;
  const category = req.query.category as string | undefined;
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;

  const filters: SearchFilters = {};
  if (contentType) filters.contentType = contentType;
  if (creator) filters.creator = creator;
  if (category) filters.category = category;

  const results = contentSearchIndex.list(filters, limit, offset);

  const response: ApiResponse = {
    success: true,
    data: {
      filters,
      total: results.length,
      limit,
      offset,
      results
    },
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Get content statistics
app.get('/api/content/stats', (_req: Request, res: Response) => {
  if (!contentSearchIndex.isLoaded()) {
    const response: ApiResponse = {
      success: false,
      error: 'Content index not loaded - run a scan from Bitwig controller',
      timestamp: new Date().toISOString()
    };
    res.status(503).json(response);
    return;
  }

  const stats = contentSearchIndex.getStats();

  const response: ApiResponse = {
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Get content types
app.get('/api/content/types', (_req: Request, res: Response) => {
  if (!contentSearchIndex.isLoaded()) {
    const response: ApiResponse = {
      success: false,
      error: 'Content index not loaded',
      timestamp: new Date().toISOString()
    };
    res.status(503).json(response);
    return;
  }

  const response: ApiResponse = {
    success: true,
    data: contentSearchIndex.getContentTypes(),
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Get creators
app.get('/api/content/creators', (_req: Request, res: Response) => {
  if (!contentSearchIndex.isLoaded()) {
    const response: ApiResponse = {
      success: false,
      error: 'Content index not loaded',
      timestamp: new Date().toISOString()
    };
    res.status(503).json(response);
    return;
  }

  const response: ApiResponse = {
    success: true,
    data: contentSearchIndex.getCreators(),
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Get categories
app.get('/api/content/categories', (_req: Request, res: Response) => {
  if (!contentSearchIndex.isLoaded()) {
    const response: ApiResponse = {
      success: false,
      error: 'Content index not loaded',
      timestamp: new Date().toISOString()
    };
    res.status(503).json(response);
    return;
  }

  const response: ApiResponse = {
    success: true,
    data: contentSearchIndex.getCategories(),
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Get content index status
app.get('/api/content/status', (_req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: contentSearchIndex.getStatus(),
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Trigger content rescan
app.post('/api/content/rescan', (_req: Request, res: Response) => {
  try {
    // Check if Bitwig is running
    if (!isBitwigRunning()) {
      const response: ApiResponse = {
        success: false,
        error: 'Bitwig is not running - cannot trigger rescan',
        timestamp: new Date().toISOString()
      };
      res.status(503).json(response);
      return;
    }

    createRescanFlag();

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Rescan requested - controller will detect within 10 seconds',
        flagPath: RESCAN_FLAG
      },
      timestamp: new Date().toISOString()
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create rescan flag: ' + (error as Error).message,
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

// =============================================================================
// Track Management API
// =============================================================================

interface TrackCommand {
  id: string;
  action: 'createTrack' | 'renameTrack' | 'insertDevice' | 'getTrackInfo' |
          'selectTrack' | 'navigateTrack' | 'setTrackMute' | 'setTrackSolo' |
          'getTrackList' | 'deleteTrack' | 'setTrackColor' | 'setTrackVolume' | 'setTrackPan';
  params: {
    type?: 'instrument' | 'audio' | 'effect';
    name?: string;
    position?: number;
    trackIndex?: number;
    deviceId?: string;
    deviceType?: 'vst3' | 'vst2' | 'bitwig';
    direction?: 'next' | 'previous' | 'first' | 'last';
    mute?: boolean;
    solo?: boolean;
    color?: string;
    volume?: number;
    pan?: number;
  };
}

// Helper to send command to Bitwig controller
async function sendBitwigCommand(command: TrackCommand): Promise<{ success: boolean; error?: string; data?: any }> {
  return new Promise((resolve) => {
    try {
      // Check if Bitwig is running
      if (!isBitwigRunning()) {
        resolve({ success: false, error: 'Bitwig is not running' });
        return;
      }

      // Write command to file
      fs.writeFileSync(COMMANDS_FILE, JSON.stringify([command], null, 2), 'utf8');
      console.log(`[Track] Sent command: ${command.action} (${command.id})`);

      // Poll for response (max 5 seconds)
      let attempts = 0;
      const maxAttempts = 50; // 50 * 100ms = 5 seconds

      const checkResponse = () => {
        attempts++;

        if (fs.existsSync(RESPONSE_FILE)) {
          try {
            const responseData = JSON.parse(fs.readFileSync(RESPONSE_FILE, 'utf8'));
            if (responseData.id === command.id) {
              fs.unlinkSync(RESPONSE_FILE); // Clean up response file
              resolve(responseData);
              return;
            }
          } catch (e) {
            // Response file not ready yet
          }
        }

        if (attempts >= maxAttempts) {
          resolve({ success: false, error: 'Timeout waiting for controller response' });
          return;
        }

        setTimeout(checkResponse, 100);
      };

      setTimeout(checkResponse, 100);
    } catch (error) {
      resolve({ success: false, error: 'Failed to send command: ' + (error as Error).message });
    }
  });
}

// Generate unique command ID
function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create track
app.post('/api/bitwig/tracks', async (req: Request, res: Response) => {
  const { type = 'instrument', name, position = -1 } = req.body;

  if (!['instrument', 'audio', 'effect'].includes(type)) {
    const response: ApiResponse = {
      success: false,
      error: 'Invalid track type. Must be: instrument, audio, or effect',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'createTrack',
    params: { type, position }
  };

  const result = await sendBitwigCommand(command);

  // If track created and name provided, rename it
  if (result.success && name) {
    const renameCommand: TrackCommand = {
      id: generateCommandId(),
      action: 'renameTrack',
      params: { name }
    };
    await sendBitwigCommand(renameCommand);
  }

  const response: ApiResponse = {
    success: result.success,
    data: result.success ? { message: `Created ${type} track`, name } : undefined,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// Rename current track
app.post('/api/bitwig/tracks/rename', async (req: Request, res: Response) => {
  const { name } = req.body;

  if (!name) {
    const response: ApiResponse = {
      success: false,
      error: 'Name is required',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'renameTrack',
    params: { name }
  };

  const result = await sendBitwigCommand(command);

  const response: ApiResponse = {
    success: result.success,
    data: result.success ? { message: `Renamed track to: ${name}` } : undefined,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// Insert device into current track
app.post('/api/bitwig/tracks/device', async (req: Request, res: Response) => {
  const { deviceId, deviceType = 'vst3' } = req.body;

  if (!deviceId) {
    const response: ApiResponse = {
      success: false,
      error: 'deviceId is required',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  if (!['vst3', 'vst2', 'bitwig'].includes(deviceType)) {
    const response: ApiResponse = {
      success: false,
      error: 'Invalid deviceType. Must be: vst3, vst2, or bitwig',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'insertDevice',
    params: { deviceId, deviceType }
  };

  const result = await sendBitwigCommand(command);

  const response: ApiResponse = {
    success: result.success,
    data: result.success ? { message: `Inserted device: ${deviceId}` } : undefined,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// Get current track info
app.get('/api/bitwig/tracks/current', async (_req: Request, res: Response) => {
  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'getTrackInfo',
    params: {}
  };

  const result = await sendBitwigCommand(command);

  const response: ApiResponse = {
    success: result.success,
    data: result.data,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// List all tracks
app.get('/api/bitwig/tracks', async (_req: Request, res: Response) => {
  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'getTrackList',
    params: {}
  };

  const result = await sendBitwigCommand(command);

  const response: ApiResponse = {
    success: result.success,
    data: result.data,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// Select track by index
app.post('/api/bitwig/tracks/select', async (req: Request, res: Response) => {
  const { index } = req.body;

  if (index === undefined || typeof index !== 'number') {
    const response: ApiResponse = {
      success: false,
      error: 'Track index is required (number)',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'selectTrack',
    params: { trackIndex: index }
  };

  const result = await sendBitwigCommand(command);

  const response: ApiResponse = {
    success: result.success,
    data: result.data,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// Navigate tracks (next, previous, first, last)
app.post('/api/bitwig/tracks/navigate', async (req: Request, res: Response) => {
  const { direction } = req.body;

  if (!direction || !['next', 'previous', 'first', 'last'].includes(direction)) {
    const response: ApiResponse = {
      success: false,
      error: 'Direction is required: next, previous, first, or last',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'navigateTrack',
    params: { direction }
  };

  const result = await sendBitwigCommand(command);

  const response: ApiResponse = {
    success: result.success,
    data: result.data,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// Set track mute
app.post('/api/bitwig/tracks/mute', async (req: Request, res: Response) => {
  const { mute } = req.body;

  if (mute === undefined || typeof mute !== 'boolean') {
    const response: ApiResponse = {
      success: false,
      error: 'Mute state is required (boolean)',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'setTrackMute',
    params: { mute }
  };

  const result = await sendBitwigCommand(command);

  const response: ApiResponse = {
    success: result.success,
    data: result.success ? { message: `Track ${mute ? 'muted' : 'unmuted'}` } : undefined,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// Set track solo
app.post('/api/bitwig/tracks/solo', async (req: Request, res: Response) => {
  const { solo } = req.body;

  if (solo === undefined || typeof solo !== 'boolean') {
    const response: ApiResponse = {
      success: false,
      error: 'Solo state is required (boolean)',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'setTrackSolo',
    params: { solo }
  };

  const result = await sendBitwigCommand(command);

  const response: ApiResponse = {
    success: result.success,
    data: result.success ? { message: `Track solo ${solo ? 'enabled' : 'disabled'}` } : undefined,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// Set track volume (0.0 to 1.0)
app.post('/api/bitwig/tracks/volume', async (req: Request, res: Response) => {
  const { volume } = req.body;

  if (volume === undefined || typeof volume !== 'number' || volume < 0 || volume > 1) {
    const response: ApiResponse = {
      success: false,
      error: 'Volume is required (number between 0.0 and 1.0)',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'setTrackVolume',
    params: { volume }
  };

  const result = await sendBitwigCommand(command);

  const response: ApiResponse = {
    success: result.success,
    data: result.success ? { message: `Track volume set to ${(volume * 100).toFixed(0)}%` } : undefined,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// Set track pan (-1.0 to 1.0)
app.post('/api/bitwig/tracks/pan', async (req: Request, res: Response) => {
  const { pan } = req.body;

  if (pan === undefined || typeof pan !== 'number' || pan < -1 || pan > 1) {
    const response: ApiResponse = {
      success: false,
      error: 'Pan is required (number between -1.0 and 1.0)',
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }

  const command: TrackCommand = {
    id: generateCommandId(),
    action: 'setTrackPan',
    params: { pan }
  };

  const result = await sendBitwigCommand(command);

  const panLabel = pan === 0 ? 'center' : (pan < 0 ? `${Math.abs(pan * 100).toFixed(0)}% left` : `${(pan * 100).toFixed(0)}% right`);
  const response: ApiResponse = {
    success: result.success,
    data: result.success ? { message: `Track pan set to ${panLabel}` } : undefined,
    error: result.error,
    timestamp: new Date().toISOString()
  };
  res.status(result.success ? 200 : 500).json(response);
});

// SPA fallback - serve index.html for non-API routes
app.get('*', (req: Request, res: Response) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  } else {
    const response: ApiResponse = {
      success: false,
      error: 'Endpoint not found',
      timestamp: new Date().toISOString()
    };
    res.status(404).json(response);
  }
});

// Start server
configWatcher.start();

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`Jeannie v${VERSION} by Audio Forge RS`);
  console.log('='.repeat(60));
  console.log(`🌐 Web UI: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`👋 API: http://localhost:${PORT}/api/hello`);
  console.log(`📁 Config: ${CONFIG_PATH}`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  configWatcher.stop();
  if (logWatcher) {
    logWatcher.close();
  }
  if (contentWatcher) {
    contentWatcher.close();
  }
  process.exit(0);
});
