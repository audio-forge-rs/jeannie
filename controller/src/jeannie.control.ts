/**
 * Jeannie - Bitwig Studio Controller
 * Version: 0.3.0
 * Vendor: Audio Forge RS
 *
 * Bitwig controller script that integrates with the Jeannie web API and Roger CLI
 */

// Bitwig API type stubs
declare const loadAPI: (version: number) => void;
declare const load: (url: string) => string;
declare const host: {
  defineController: (
    vendor: string,
    name: string,
    version: string,
    uuid: string,
    author: string
  ) => void;
  defineMidiPorts: (inputs: number, outputs: number) => void;
  addDeviceNameBasedDiscoveryPair: (inputs: string[], outputs: string[]) => void;
  println: (message: string) => void;
};

const JEANNIE_VERSION = '0.3.0';
const API_URL = 'http://localhost:3000';

loadAPI(18);

host.defineController(
  'Audio Forge RS',
  'Jeannie',
  JEANNIE_VERSION,
  '6c7e5d4f-8a9b-4c3d-2e1f-0a9b8c7d6e5f',
  'Audio Forge RS'
);

host.defineMidiPorts(0, 0);

// Logger function that sends to both console and file
function log(message: string, level: string = 'info'): void {
  // Always log to Bitwig console
  host.println(message);

  // Try to send to web API for file logging
  try {
    const payload = JSON.stringify({
      level: level,
      message: message,
      version: JEANNIE_VERSION
    });

    const url = API_URL + '/api/bitwig/log';
    load(url + '?level=' + encodeURIComponent(level) +
         '&message=' + encodeURIComponent(message) +
         '&version=' + encodeURIComponent(JEANNIE_VERSION));
  } catch (e) {
    // Silently fail if API is not available
    // Don't spam console with connection errors
  }
}

function init(): void {
  log('='.repeat(60));
  log('Jeannie v' + JEANNIE_VERSION + ' by Audio Forge RS');
  log('='.repeat(60));
  log('Controller initialized successfully!');
  log('Web API: http://localhost:3000');
  log('Config: /tmp/jeannie-config.yaml');
  log('Use Roger CLI to interact with Jeannie');
  log('='.repeat(60));
}

function exit(): void {
  log('[Jeannie] Shutting down...');
}

function flush(): void {
  // Called periodically to flush any pending changes
}
