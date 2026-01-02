/**
 * Shared types for Jeannie Bitwig Controller
 * Version: 0.1.0
 */

export interface JeannieConfig {
  version: string;
  roger?: RogerInfo;
  controller?: ControllerConfig;
  lastUpdated: string;
}

export interface RogerInfo {
  name: string;
  version: string;
  timestamp: string;
}

export interface ControllerConfig {
  name: string;
  enabled: boolean;
  settings?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  uptime: number;
  configFile: string;
  configLoaded: boolean;
}

export interface RogerCommand {
  action: string;
  payload?: Record<string, unknown>;
}
