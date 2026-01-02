/**
 * Jeannie - Bitwig Studio Controller
 * Version: 0.3.0
 * Vendor: Audio Forge RS
 *
 * Bitwig controller script that integrates with the Jeannie web API and Roger CLI
 */

// Bitwig API type stubs
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

// Java interop for file I/O (Nashorn provides access to Java classes)
declare const Java: any;

const JEANNIE_VERSION = '0.6.0';

// Cross-platform paths (macOS + Linux)
const System = Java.type('java.lang.System');
const LOG_FILE = System.getProperty('user.home') + '/.config/jeannie/logs/controller.log';

loadAPI(18);

host.defineController(
  'Audio Forge RS',
  'Jeannie',
  JEANNIE_VERSION,
  '6c7e5d4f-8a9b-4c3d-2e1f-0a9b8c7d6e5f',
  'Audio Forge RS'
);

host.defineMidiPorts(0, 0);

// Logger function that writes to both console and file (using Java FileWriter)
function log(message: string, level: string = 'info'): void {
  // Always log to Bitwig Script Console
  host.println(message);

  // Write to file using Java FileWriter (Bitwig/Nashorn way)
  try {
    const File = Java.type('java.io.File');
    const FileWriter = Java.type('java.io.FileWriter');
    const BufferedWriter = Java.type('java.io.BufferedWriter');
    const SimpleDateFormat = Java.type('java.text.SimpleDateFormat');
    const Date = Java.type('java.util.Date');

    // Ensure directory exists
    const logFile = new File(LOG_FILE);
    const parentDir = logFile.getParentFile();
    if (!parentDir.exists()) {
      parentDir.mkdirs();
    }

    // Format timestamp
    const dateFormat = new SimpleDateFormat('yyyy-MM-dd HH:mm:ss.SSS');
    const timestamp = dateFormat.format(new Date());

    // Write log entry
    const fw = new FileWriter(LOG_FILE, true); // append mode
    const bw = new BufferedWriter(fw);
    bw.write('[' + timestamp + '] [' + level.toUpperCase() + '] ' + message + '\n');
    bw.close();
  } catch (e) {
    // Silently fail if file writing doesn't work
    // Log appears in console regardless
  }
}

function init(): void {
  log('='.repeat(60));
  log('Jeannie v' + JEANNIE_VERSION + ' by Audio Forge RS');
  log('='.repeat(60));
  log('Controller initialized successfully!');
  log('Web API: http://localhost:3000');
  log('Config: ~/.config/jeannie/config.yaml');
  log('Logs: ~/.config/jeannie/logs/controller.log');
  log('Use Roger CLI to interact with Jeannie');
  log('='.repeat(60));
}

function exit(): void {
  log('[Jeannie] Shutting down...');
}

function flush(): void {
  // Called periodically to flush any pending changes
}
