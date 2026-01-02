/**
 * Jeannie - REST API Server
 * Version: 0.3.0
 * Vendor: Audio Forge RS
 *
 * Main server providing REST API for Jeannie with web UI and connection status tracking
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

// Controller log path for monitoring connection status
const CONTROLLER_LOG_PATH = path.join(os.homedir(), '.config', 'jeannie', 'logs', 'controller.log');

// Content index paths
const CONTENT_FILE = path.join(os.homedir(), '.config', 'jeannie', 'content.json');
const RESCAN_FLAG = path.join(os.homedir(), '.config', 'jeannie', 'rescan.flag');

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
const VERSION = '0.7.0';

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
