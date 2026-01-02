/**
 * Jeannie - Bitwig Studio Controller
 * Version: 0.3.0
 * Vendor: Audio Forge RS
 *
 * Bitwig controller script that integrates with the Jeannie web API and Roger CLI
 */

// Bitwig API type stubs (basic types for hello world)
declare const loadAPI: (version: number) => void;
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

loadAPI(18);

host.defineController(
  'Audio Forge RS',
  'Jeannie',
  JEANNIE_VERSION,
  '6c7e5d4f-8a9b-4c3d-2e1f-0a9b8c7d6e5f',
  'Audio Forge RS'
);

host.defineMidiPorts(0, 0);
host.addDeviceNameBasedDiscoveryPair(['Jeannie'], ['Jeannie']);

function init(): void {
  host.println('='.repeat(60));
  host.println('Jeannie v' + JEANNIE_VERSION + ' by Audio Forge RS');
  host.println('='.repeat(60));
  host.println('Controller initialized successfully!');
  host.println('Web API: http://localhost:3000');
  host.println('Config: /tmp/jeannie-config.yaml');
  host.println('Use Roger CLI to interact with Jeannie');
  host.println('='.repeat(60));
}

function exit(): void {
  host.println('[Jeannie] Shutting down...');
}

function flush(): void {
  // Called periodically to flush any pending changes
}
