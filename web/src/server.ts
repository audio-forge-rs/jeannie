/**
 * Jeannie REST API Server
 * Version: 0.1.0
 *
 * Main server providing REST API for Jeannie Bitwig controller
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { ConfigWatcher, CONFIG_PATH, JeannieConfig } from './configWatcher';

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
const VERSION = '0.1.0';

const startTime = Date.now();
const configWatcher = new ConfigWatcher();

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
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
      config: config?.version || 'unknown'
    },
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

// 404 handler
app.use((_req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  };
  res.status(404).json(response);
});

// Start server
configWatcher.start();

configWatcher.onChange((config) => {
  console.log('[Server] Config updated:', config);
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`Jeannie REST API Server v${VERSION}`);
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Config file: ${CONFIG_PATH}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Hello endpoint: http://localhost:${PORT}/api/hello`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  configWatcher.stop();
  process.exit(0);
});
