/**
 * Jeannie - Bitwig Studio Controller
 * Version: 0.7.0
 * Vendor: Audio Forge RS
 *
 * Bitwig controller script with content enumeration (devices, presets, samples)
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
  println: (message: string) => void;
  scheduleTask: (callback: () => void, delayMs: number) => void;
  createPopupBrowser: () => any;
};

// Java interop for file I/O (Nashorn provides access to Java classes)
declare const Java: any;

const JEANNIE_VERSION = '0.7.0';

// Cross-platform paths (macOS + Linux)
const System = Java.type('java.lang.System');
const HOME_DIR = System.getProperty('user.home');
const CONFIG_DIR = HOME_DIR + '/.config/jeannie';
const LOG_FILE = CONFIG_DIR + '/logs/controller.log';
const CONTENT_FILE = CONFIG_DIR + '/content.json';
const RESCAN_FLAG = CONFIG_DIR + '/rescan.flag';

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

// Write JSON file using Java FileWriter
function writeJSONFile(path: string, data: any): void {
  try {
    const File = Java.type('java.io.File');
    const FileWriter = Java.type('java.io.FileWriter');
    const BufferedWriter = Java.type('java.io.BufferedWriter');

    const file = new File(path);
    const parentDir = file.getParentFile();
    if (!parentDir.exists()) {
      parentDir.mkdirs();
    }

    const json = JSON.stringify(data, null, 2);
    const fw = new FileWriter(path, false); // overwrite mode
    const bw = new BufferedWriter(fw);
    bw.write(json);
    bw.close();

    log('Wrote JSON file: ' + path + ' (' + json.length + ' bytes)');
  } catch (e) {
    log('Error writing JSON file: ' + e, 'error');
  }
}

// Check if file exists
function fileExists(path: string): boolean {
  try {
    const File = Java.type('java.io.File');
    const file = new File(path);
    return file.exists();
  } catch (e) {
    return false;
  }
}

// Delete file
function deleteFile(path: string): void {
  try {
    const File = Java.type('java.io.File');
    const file = new File(path);
    if (file.exists()) {
      file.delete();
      log('Deleted file: ' + path);
    }
  } catch (e) {
    log('Error deleting file: ' + e, 'error');
  }
}

// Tokenize string for search
function tokenize(name: string): string[] {
  return name.toLowerCase()
    .split(/[\s\-_()]+/)
    .filter(t => t.length > 0);
}

// Content enumeration
interface ContentItem {
  index: number;
  contentType: string;
  name: string;
  deviceType?: string;
  fileType?: string;
  creator?: string;
  category?: string;
  plugin?: string;
  nameTokens: string[];
}

let allContent: ContentItem[] = [];
let isScanning = false;

function enumerateAllContent(): void {
  if (isScanning) {
    log('Scan already in progress, skipping...');
    return;
  }

  isScanning = true;
  allContent = [];
  const startTime = new Date().getTime();

  log('='.repeat(60));
  log('Starting content enumeration...');
  log('This will take 60-120 seconds...');
  log('='.repeat(60));

  try {
    const browser = host.createPopupBrowser();

    // Get available content types
    const contentTypes: string[] = [];
    browser.contentTypeNames().addValueObserver((types: string[]) => {
      for (let i = 0; i < types.length; i++) {
        if (types[i]) {
          contentTypes.push(types[i]);
        }
      }
      log('Found content types: ' + contentTypes.join(', '));
    });

    // Wait for content types to be populated
    host.scheduleTask(() => {
      enumerateContentTypes(browser, contentTypes, startTime);
    }, 1000);

  } catch (e) {
    log('Error during content enumeration: ' + e, 'error');
    isScanning = false;
  }
}

function enumerateContentTypes(browser: any, contentTypes: string[], startTime: number): void {
  let typeIndex = 0;

  function enumerateNextType(): void {
    if (typeIndex >= contentTypes.length) {
      // Done with all content types
      finishEnumeration(startTime);
      return;
    }

    const contentType = contentTypes[typeIndex];
    log('Enumerating content type: ' + contentType);

    // Switch to this content type
    browser.selectedContentTypeIndex().set(typeIndex);

    // Wait for browser to update
    host.scheduleTask(() => {
      enumerateContentType(browser, contentType, () => {
        typeIndex++;
        enumerateNextType();
      });
    }, 500);
  }

  enumerateNextType();
}

function enumerateContentType(browser: any, contentType: string, callback: () => void): void {
  try {
    const results = browser.resultsColumn();

    results.entryCount().addValueObserver((count: number) => {
      if (count === 0) {
        log(contentType + ': 0 items');
        callback();
        return;
      }

      log(contentType + ': ' + count + ' items');

      // Create item bank
      const bank = results.createItemBank(Math.min(count, 10000));
      let processedCount = 0;

      for (let i = 0; i < Math.min(count, 10000); i++) {
        const item = bank.getItemAt(i);
        const itemIndex = i;

        item.name().addValueObserver((name: string) => {
          if (name && name !== '') {
            const contentItem: ContentItem = {
              index: allContent.length,
              contentType: contentType,
              name: name,
              nameTokens: tokenize(name)
            };

            allContent.push(contentItem);
          }

          processedCount++;
          if (processedCount >= Math.min(count, 10000)) {
            log(contentType + ': Processed ' + processedCount + ' items');
            callback();
          }
        });
      }
    });
  } catch (e) {
    log('Error enumerating ' + contentType + ': ' + e, 'error');
    callback();
  }
}

function finishEnumeration(startTime: number): void {
  const endTime = new Date().getTime();
  const duration = endTime - startTime;

  log('='.repeat(60));
  log('Content enumeration complete!');
  log('Total items: ' + allContent.length);
  log('Duration: ' + (duration / 1000).toFixed(1) + ' seconds');
  log('='.repeat(60));

  // Calculate statistics
  const stats: any = {
    byContentType: {}
  };

  allContent.forEach(item => {
    if (!stats.byContentType[item.contentType]) {
      stats.byContentType[item.contentType] = 0;
    }
    stats.byContentType[item.contentType]++;
  });

  // Build content index
  const contentIndex = {
    version: '0.2.0',
    scanDate: new Date().toISOString(),
    bitwigVersion: '5.3.0',
    scanDurationMs: duration,
    contentTypes: Object.keys(stats.byContentType),
    totals: {
      total: allContent.length,
      ...stats.byContentType
    },
    content: allContent,
    stats: stats
  };

  // Write to file
  writeJSONFile(CONTENT_FILE, contentIndex);

  log('Content index written to: ' + CONTENT_FILE);
  log('Use: jq .totals ' + CONTENT_FILE + ' to view statistics');

  isScanning = false;
}

// Check for rescan flag periodically
function checkRescanFlag(): void {
  if (fileExists(RESCAN_FLAG)) {
    log('Rescan flag detected, starting rescan...');
    deleteFile(RESCAN_FLAG);
    enumerateAllContent();
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
  log('Content: ~/.config/jeannie/content.json');
  log('Use Roger CLI to interact with Jeannie');
  log('='.repeat(60));

  // Start content enumeration after 2 seconds (let Bitwig finish loading)
  host.scheduleTask(() => {
    enumerateAllContent();
  }, 2000);

  // Check for rescan flag every 10 seconds
  host.scheduleTask(function checkFlag() {
    checkRescanFlag();
    host.scheduleTask(checkFlag, 10000);
  }, 10000);
}

function exit(): void {
  log('[Jeannie] Shutting down...');
}

function flush(): void {
  // Called periodically to flush any pending changes
}
