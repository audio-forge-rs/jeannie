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
import { ConfigWatcher, CONFIG_PATH, JeannieConfig, ConnectionStatus } from './configWatcher';

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
const VERSION = '0.3.0';

const startTime = Date.now();
const configWatcher = new ConfigWatcher();

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

// Helper function to check if connection is stale
function isConnectionStale(lastSeen: string | null): boolean {
  if (!lastSeen) return true;
  return Date.now() - new Date(lastSeen).getTime() > CONNECTION_TIMEOUT;
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Logging middleware (after static to reduce noise)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

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
  // Update connection status based on last seen time
  connectionStatus.bitwig.connected = !isConnectionStale(connectionStatus.bitwig.lastSeen);
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

  console.log('[Bitwig] Controller ping received, version:', version || 'unknown');

  const response: ApiResponse = {
    success: true,
    data: { message: 'Ping received' },
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

  console.log('[Roger] Command received:', command || 'unknown');

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
      message: `Hello from Jeannie! Connected to ${rogerName} v${rogerVersion}`,
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

configWatcher.onChange((config) => {
  console.log('[Server] Config updated:', config);
});

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
  process.exit(0);
});
