/**
 * Jeannie Bitwig Controller
 * Version: 0.3.0
 *
 * A Bitwig controller that integrates with the Jeannie web API and Roger CLI
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
  'Jeannie Controller',
  JEANNIE_VERSION,
  '6c7e5d4f-8a9b-4c3d-2e1f-0a9b8c7d6e5f',
  'Audio Forge RS'
);

host.defineMidiPorts(0, 0);
host.addDeviceNameBasedDiscoveryPair(['Jeannie'], ['Jeannie']);

function init(): void {
  host.println('='.repeat(60));
  host.println('Jeannie Bitwig Controller v' + JEANNIE_VERSION);
  host.println('='.repeat(60));
  host.println('Controller initialized successfully!');
  host.println('Web API running at: http://localhost:3000');
  host.println('Config file: /tmp/jeannie-config.yaml');
  host.println('Use the Roger CLI to interact with Jeannie');
  host.println('='.repeat(60));
}

function exit(): void {
  host.println('[Jeannie] Controller shutting down...');
}

function flush(): void {
  // Called periodically to flush any pending changes
}
