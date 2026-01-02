/**
 * YAML Config File Watcher for Jeannie
 * Version: 0.1.0
 *
 * Watches /tmp/jeannie-config.yaml for changes and parses updates
 */

import chokidar, { FSWatcher } from 'chokidar';
import { readFileSync, existsSync } from 'fs';
import YAML from 'yaml';

export const CONFIG_PATH = '/tmp/jeannie-config.yaml';

export interface JeannieConfig {
  version: string;
  roger?: {
    name: string;
    version: string;
    timestamp: string;
  };
  controller?: {
    name: string;
    enabled: boolean;
  };
  lastUpdated: string;
}

export interface ConnectionStatus {
  bitwig: {
    connected: boolean;
    lastSeen: string | null;
    controllerVersion: string | null;
  };
  roger: {
    connected: boolean;
    lastSeen: string | null;
    lastCommand: string | null;
  };
}

export class ConfigWatcher {
  private watcher: FSWatcher | null = null;
  private config: JeannieConfig | null = null;
  private callbacks: Array<(config: JeannieConfig) => void> = [];

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (existsSync(CONFIG_PATH)) {
        const fileContent = readFileSync(CONFIG_PATH, 'utf8');
        this.config = YAML.parse(fileContent) as JeannieConfig;
        console.log('[ConfigWatcher] Config loaded:', this.config);
      } else {
        console.log('[ConfigWatcher] Config file does not exist yet:', CONFIG_PATH);
        this.config = null;
      }
    } catch (error) {
      console.error('[ConfigWatcher] Error loading config:', error);
      this.config = null;
    }
  }

  public start(): void {
    console.log('[ConfigWatcher] Starting watcher for:', CONFIG_PATH);

    this.watcher = chokidar.watch(CONFIG_PATH, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (path: string) => {
        console.log('[ConfigWatcher] File created:', path);
        this.loadConfig();
        this.notifyCallbacks();
      })
      .on('change', (path: string) => {
        console.log('[ConfigWatcher] File changed:', path);
        this.loadConfig();
        this.notifyCallbacks();
      })
      .on('unlink', (path: string) => {
        console.log('[ConfigWatcher] File removed:', path);
        this.config = null;
        this.notifyCallbacks();
      })
      .on('error', (error: unknown) => {
        console.error('[ConfigWatcher] Watcher error:', error);
      });
  }

  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[ConfigWatcher] Watcher stopped');
    }
  }

  public getConfig(): JeannieConfig | null {
    return this.config;
  }

  public onChange(callback: (config: JeannieConfig) => void): void {
    this.callbacks.push(callback);
  }

  private notifyCallbacks(): void {
    if (this.config) {
      this.callbacks.forEach(cb => cb(this.config!));
    }
  }
}
