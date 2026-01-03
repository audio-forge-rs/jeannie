/**
 * Jeannie - Bitwig Studio Controller
 * Vendor: Audio Forge RS
 *
 * Bitwig controller script with content enumeration (devices, presets, samples)
 * Version is read from ~/.config/jeannie/versions.json (single source of truth)
 */

// Bitwig API type stubs
declare const loadAPI: (version: number) => void;

// Value types
interface Value<T> {
  addValueObserver(callback: (value: T) => void): void;
  get(): T;
  markInterested(): void;
}

interface SettableValue<T> extends Value<T> {
  set(value: T): void;
}

interface StringValue extends Value<string> {}
interface SettableStringValue extends SettableValue<string> {}
interface IntegerValue extends Value<number> {}
interface SettableIntegerValue extends SettableValue<number> {}
interface BooleanValue extends Value<boolean> {}
interface SettableBooleanValue extends SettableValue<boolean> {}

// Track and Device interfaces
interface InsertionPoint {
  browse(): void;
  insertBitwigDevice(id: string): void;
  insertVST2Device(id: number): void;
  insertVST3Device(id: string): void;
  insertCLAPDevice(id: string): void;
  insertFile(path: string): void;
}

interface DeviceChain {
  startOfDeviceChainInsertionPoint(): InsertionPoint;
  endOfDeviceChainInsertionPoint(): InsertionPoint;
}

interface Channel {
  name(): SettableStringValue;
  color(): SettableValue<any>;
  solo(): SettableBooleanValue;
  mute(): SettableBooleanValue;
  volume(): SettableValue<any>;
  pan(): SettableValue<any>;
  exists(): BooleanValue;
  position(): IntegerValue;
  makeVisibleInArranger(): void;
  makeVisibleInMixer(): void;
}

interface Track extends Channel {
  createCursorDevice(id?: string, name?: string, numSends?: number, followMode?: any): CursorDevice;
  endOfDeviceChainInsertionPoint(): InsertionPoint;
  clipLauncherSlotBank(): ClipLauncherSlotBank;
}

interface CursorTrack extends Track {
  selectParent(): void;
  selectFirstChild(): void;
  selectNext(): void;
  selectPrevious(): void;
}

interface CursorDevice {
  exists(): BooleanValue;
  name(): StringValue;
  presetName(): StringValue;
  afterDeviceInsertionPoint(): InsertionPoint;
  beforeDeviceInsertionPoint(): InsertionPoint;
}

interface TrackBank {
  getItemAt(index: number): Track;
  itemCount(): IntegerValue;
  scrollPosition(): SettableIntegerValue;
}

// Clip Launcher interfaces
interface ClipLauncherSlotBank {
  getItemAt(index: number): ClipLauncherSlot;
  createEmptyClip(slotIndex: number, lengthInBeats: number): void;
}

interface ClipLauncherSlot {
  name(): StringValue;
  hasContent(): BooleanValue;
  isPlaying(): BooleanValue;
  isRecording(): BooleanValue;
  launch(): void;
  stop(): void;
  deleteObject(): void;
  select(): void;
}

// Clip interface for step sequencer operations
interface Clip {
  setStepSize(stepSize: number): void;
  setStep(channel: number, x: number, y: number, insertVelocity: number, insertDuration: number): void;
  clearStep(channel: number, x: number, y: number): void;
  clearSteps(): void;
  scrollToKey(key: number): void;
  scrollToStep(step: number): void;
  getLoopStart(): SettableValue<number>;
  getLoopLength(): SettableValue<number>;
  getPlayStart(): SettableValue<number>;
  getPlayStop(): SettableValue<number>;
}

interface Application {
  createAudioTrack(position: number): void;
  createInstrumentTrack(position: number): void;
  createEffectTrack(position: number): void;
  getAction(id: string): any;
}

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
  createCursorTrack(id: string, name: string, numSends: number, numScenes: number, shouldFollowSelection: boolean): CursorTrack;
  createMainTrackBank(numTracks: number, numSends: number, numScenes: number): TrackBank;
  createApplication(): Application;
  createLauncherCursorClip(gridWidth: number, gridHeight: number): Clip;
};

// Java interop for file I/O (Nashorn provides access to Java classes)
declare const Java: any;

// Cross-platform paths (macOS + Linux)
const System = Java.type('java.lang.System');
const HOME_DIR = System.getProperty('user.home');
const CONFIG_DIR = HOME_DIR + '/.config/jeannie';
const LOG_FILE = CONFIG_DIR + '/logs/controller.log';
const CONTENT_FILE = CONFIG_DIR + '/content.json';
const RESCAN_FLAG = CONFIG_DIR + '/rescan.flag';
const COMMANDS_FILE = CONFIG_DIR + '/commands.json';
const RESPONSE_FILE = CONFIG_DIR + '/response.json';
const VERSIONS_FILE = CONFIG_DIR + '/versions.json';

// Load version from versions.json (single source of truth)
function loadVersion(): string {
  try {
    const Files = Java.type('java.nio.file.Files');
    const Paths = Java.type('java.nio.file.Paths');

    const filePath = Paths.get(VERSIONS_FILE);
    if (!Files.exists(filePath)) {
      return '0.10.0'; // Fallback if versions.json not found
    }

    // Read all bytes and convert to string - no constructor ambiguity
    const bytes = Files.readAllBytes(filePath);
    const JavaString = Java.type('java.lang.String');
    const content = new JavaString(bytes, 'UTF-8');

    const versions = JSON.parse(content);
    return versions.controller || '0.10.0';
  } catch (e) {
    return '0.10.0'; // Fallback on error
  }
}

const JEANNIE_VERSION = loadVersion();

// Track management globals (initialized in init())
let cursorTrack: CursorTrack;
let cursorDevice: CursorDevice;
let trackBank: TrackBank;
let application: Application;
let cursorClip: Clip;

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

  // Only write to content.json if we found items
  // This prevents overwriting filesystem scanner data when PopupBrowser returns 0
  if (allContent.length > 0) {
    // Build content index
    const contentIndex = {
      version: '0.2.0',
      scanDate: new Date().toISOString(),
      bitwigVersion: 'API v18', // Using API version as proxy (Bitwig 5.x uses API v18)
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
  } else {
    log('No items found - keeping existing content.json');
    log('Use filesystem scanner instead: cd web && npm run scan');
  }

  isScanning = false;
}

// Check for rescan flag periodically
function checkRescanFlag(): void {
  if (fileExists(RESCAN_FLAG)) {
    log('Rescan flag detected');
    deleteFile(RESCAN_FLAG);
    log('WARNING: Rescan from flag not supported - PopupBrowser can only be used during init()');
    log('Please restart Bitwig to rescan content');
  }
}

// =============================================================================
// Track Management
// =============================================================================

interface TrackCommand {
  id: string;
  action: 'createTrack' | 'renameTrack' | 'insertDevice' | 'getTrackInfo' |
          'selectTrack' | 'navigateTrack' | 'setTrackMute' | 'setTrackSolo' |
          'getTrackList' | 'deleteTrack' | 'setTrackColor' | 'setTrackVolume' | 'setTrackPan';
  params: {
    type?: 'instrument' | 'audio' | 'effect';
    name?: string;
    position?: number;
    trackIndex?: number;
    deviceId?: string;
    deviceType?: 'vst3' | 'vst2' | 'bitwig';
    direction?: 'next' | 'previous' | 'first' | 'last';
    mute?: boolean;
    solo?: boolean;
    color?: string;
    volume?: number;  // 0.0 to 1.0
    pan?: number;     // -1.0 to 1.0
  };
}

interface CommandResponse {
  id: string;
  success: boolean;
  error?: string;
  data?: any;
}

// Read JSON file using nio.file API (avoids all constructor ambiguity)
function readJSONFile(path: string): any {
  try {
    const Files = Java.type('java.nio.file.Files');
    const Paths = Java.type('java.nio.file.Paths');

    const filePath = Paths.get(path);
    if (!Files.exists(filePath)) {
      return null;
    }

    // Read all bytes and convert to string - no constructor ambiguity
    const bytes = Files.readAllBytes(filePath);
    const JavaString = Java.type('java.lang.String');
    const content = new JavaString(bytes, 'UTF-8');

    return JSON.parse(content);
  } catch (e) {
    log('Error reading JSON file: ' + e, 'error');
    return null;
  }
}

// Write command response
function writeResponse(response: CommandResponse): void {
  writeJSONFile(RESPONSE_FILE, response);
}

// Create a new track
function createTrack(type: 'instrument' | 'audio' | 'effect', position: number = -1): boolean {
  try {
    log('Creating ' + type + ' track at position ' + position);

    switch (type) {
      case 'instrument':
        application.createInstrumentTrack(position);
        break;
      case 'audio':
        application.createAudioTrack(position);
        break;
      case 'effect':
        application.createEffectTrack(position);
        break;
      default:
        log('Unknown track type: ' + type, 'error');
        return false;
    }

    log('Track created successfully');
    return true;
  } catch (e) {
    log('Error creating track: ' + e, 'error');
    return false;
  }
}

// Rename the currently selected track
function renameTrack(name: string): boolean {
  try {
    log('Renaming current track to: ' + name);
    cursorTrack.name().set(name);
    log('Track renamed successfully');
    return true;
  } catch (e) {
    log('Error renaming track: ' + e, 'error');
    return false;
  }
}

// Insert file (preset) into current track - Bitwig auto-detects plugin from file type
function insertPresetFile(filePath: string): boolean {
  try {
    log('Inserting preset file: ' + filePath);
    const insertionPoint = cursorTrack.endOfDeviceChainInsertionPoint();
    insertionPoint.insertFile(filePath);
    log('Preset file inserted successfully');
    return true;
  } catch (e) {
    log('Error inserting preset file: ' + e, 'error');
    return false;
  }
}

// Create an empty clip on the current track at the specified slot
function createClip(slotIndex: number, lengthInBeats: number): boolean {
  try {
    log('Creating clip at slot ' + slotIndex + ' with length ' + lengthInBeats + ' beats');
    const slotBank = cursorTrack.clipLauncherSlotBank();
    slotBank.createEmptyClip(slotIndex, lengthInBeats);
    // Select the slot so cursorClip points to it
    const slot = slotBank.getItemAt(slotIndex);
    slot.select();
    log('Clip created and selected');
    return true;
  } catch (e) {
    log('Error creating clip: ' + e, 'error');
    return false;
  }
}

// Note definition for setNotes
interface NoteData {
  pitch: number;      // MIDI note number (0-127)
  start: number;      // Start time in beats
  duration: number;   // Duration in beats
  velocity: number;   // Velocity (0-127)
  channel?: number;   // MIDI channel (0-15), default 0
}

// Set notes in the current cursor clip
// Notes are specified with pitch, start (beats), duration (beats), velocity
function setNotes(notes: NoteData[]): boolean {
  try {
    log('Setting ' + notes.length + ' notes in cursor clip');

    // The step sequencer grid uses:
    // x = time position (in steps, where step size was set to 0.25 = 16th notes)
    // y = pitch (MIDI note number)
    // So to convert beats to steps: steps = beats / 0.25 = beats * 4

    const stepsPerBeat = 4;  // 16th note resolution
    const gridWidth = 128;   // Cursor clip grid width

    // Sort notes by start time
    const sortedNotes = notes.slice().sort((a, b) => a.start - b.start);

    // Track current scroll position
    let currentScrollStep = 0;
    cursorClip.scrollToStep(0);

    for (let i = 0; i < sortedNotes.length; i++) {
      const note = sortedNotes[i];
      const channel = note.channel || 0;
      const absoluteStep = Math.round(note.start * stepsPerBeat);  // Convert beats to steps
      const y = note.pitch;
      const velocity = Math.max(0, Math.min(127, note.velocity));
      const duration = note.duration;

      // Calculate which window this note falls into
      const windowStart = Math.floor(absoluteStep / gridWidth) * gridWidth;

      // Scroll if we need to move to a new window
      if (windowStart !== currentScrollStep) {
        cursorClip.scrollToStep(windowStart);
        currentScrollStep = windowStart;
      }

      // Calculate x relative to current window
      const x = absoluteStep - currentScrollStep;

      cursorClip.setStep(channel, x, y, velocity, duration);
    }

    // Scroll back to start
    cursorClip.scrollToStep(0);

    log('Notes set successfully');
    return true;
  } catch (e) {
    log('Error setting notes: ' + e, 'error');
    return false;
  }
}

// Insert device into current track by file path (preferred method)
function insertDeviceByPath(filePath: string): boolean {
  try {
    log('Inserting device by path: ' + filePath);

    const insertionPoint = cursorTrack.endOfDeviceChainInsertionPoint();
    insertionPoint.insertFile(filePath);

    log('Device inserted by path successfully');
    return true;
  } catch (e) {
    log('Error inserting device by path: ' + e, 'error');
    return false;
  }
}

// Insert device into current track by ID (fallback method)
function insertDevice(deviceId: string, deviceType: 'vst3' | 'vst2' | 'bitwig' | 'clap'): boolean {
  try {
    log('Inserting device: ' + deviceId + ' (type: ' + deviceType + ')');

    // Get insertion point directly from cursor track (not deviceChain)
    const insertionPoint = cursorTrack.endOfDeviceChainInsertionPoint();

    switch (deviceType) {
      case 'vst3':
        insertionPoint.insertVST3Device(deviceId);
        break;
      case 'vst2':
        insertionPoint.insertVST2Device(parseInt(deviceId));
        break;
      case 'clap':
        insertionPoint.insertCLAPDevice(deviceId);
        break;
      case 'bitwig':
        insertionPoint.insertBitwigDevice(deviceId);
        break;
      default:
        log('Unknown device type: ' + deviceType, 'error');
        return false;
    }

    log('Device inserted successfully');
    return true;
  } catch (e) {
    log('Error inserting device: ' + e, 'error');
    return false;
  }
}

// Get info about current track
function getTrackInfo(): any {
  try {
    return {
      name: cursorTrack.name().get(),
      position: cursorTrack.position().get(),
      muted: cursorTrack.mute().get(),
      soloed: cursorTrack.solo().get()
    };
  } catch (e) {
    log('Error getting track info: ' + e, 'error');
    return null;
  }
}

// Select track by index (scrolls track bank and selects)
function selectTrackByIndex(index: number): boolean {
  try {
    log('Selecting track at index: ' + index);

    // Scroll track bank to include the target track
    trackBank.scrollPosition().set(Math.max(0, index - 8));

    // Get the track at the relative position within the bank
    const relativeIndex = Math.min(index, 15);
    const track = trackBank.getItemAt(relativeIndex);

    if (track && track.exists().get()) {
      // Make the track visible and select it via cursor
      track.makeVisibleInArranger();
      track.makeVisibleInMixer();

      // Navigate cursor to the target position
      // First go to the beginning, then navigate forward
      const currentPos = cursorTrack.position().get();
      const delta = index - currentPos;

      if (delta > 0) {
        for (let i = 0; i < delta; i++) {
          cursorTrack.selectNext();
        }
      } else if (delta < 0) {
        for (let i = 0; i < Math.abs(delta); i++) {
          cursorTrack.selectPrevious();
        }
      }

      log('Track selected at index: ' + index);
      return true;
    } else {
      log('Track at index ' + index + ' does not exist', 'warn');
      return false;
    }
  } catch (e) {
    log('Error selecting track: ' + e, 'error');
    return false;
  }
}

// Navigate tracks (next, previous, first, last)
function navigateTrack(direction: 'next' | 'previous' | 'first' | 'last'): boolean {
  try {
    log('Navigating track: ' + direction);

    switch (direction) {
      case 'next':
        cursorTrack.selectNext();
        break;
      case 'previous':
        cursorTrack.selectPrevious();
        break;
      case 'first':
        // Navigate to beginning by going to position 0
        trackBank.scrollPosition().set(0);
        cursorTrack.selectPrevious(); // Go to first by going up until we can't
        // Keep going until position is 0
        host.scheduleTask(() => {
          while (cursorTrack.position().get() > 0) {
            cursorTrack.selectPrevious();
          }
        }, 100);
        break;
      case 'last':
        // Navigate to end by going down until track doesn't exist
        cursorTrack.selectNext();
        break;
    }

    log('Navigated to: ' + cursorTrack.name().get());
    return true;
  } catch (e) {
    log('Error navigating track: ' + e, 'error');
    return false;
  }
}

// Set track mute state
function setTrackMute(mute: boolean): boolean {
  try {
    log('Setting track mute: ' + mute);
    cursorTrack.mute().set(mute);
    log('Track mute set to: ' + mute);
    return true;
  } catch (e) {
    log('Error setting mute: ' + e, 'error');
    return false;
  }
}

// Set track solo state
function setTrackSolo(solo: boolean): boolean {
  try {
    log('Setting track solo: ' + solo);
    cursorTrack.solo().set(solo);
    log('Track solo set to: ' + solo);
    return true;
  } catch (e) {
    log('Error setting solo: ' + e, 'error');
    return false;
  }
}

// Get list of tracks from track bank
function getTrackList(): any[] {
  try {
    const tracks: any[] = [];
    const bankSize = 16; // We created a 16-track bank

    for (let i = 0; i < bankSize; i++) {
      const track = trackBank.getItemAt(i);
      if (track && track.exists().get()) {
        tracks.push({
          index: i,
          name: track.name().get(),
          muted: track.mute().get(),
          soloed: track.solo().get(),
          position: track.position().get()
        });
      }
    }

    log('Retrieved ' + tracks.length + ' tracks');
    return tracks;
  } catch (e) {
    log('Error getting track list: ' + e, 'error');
    return [];
  }
}

// Set track color
function setTrackColor(colorHex: string): boolean {
  try {
    log('Setting track color: ' + colorHex);
    // Bitwig uses a Color object, parse hex to RGB
    const r = parseInt(colorHex.substring(1, 3), 16) / 255;
    const g = parseInt(colorHex.substring(3, 5), 16) / 255;
    const b = parseInt(colorHex.substring(5, 7), 16) / 255;

    // Note: Color setting may require additional API setup
    // For now, log the attempt
    log('Would set color to RGB: ' + r + ', ' + g + ', ' + b);
    return true;
  } catch (e) {
    log('Error setting color: ' + e, 'error');
    return false;
  }
}

// Set track volume (0.0 to 1.0)
function setTrackVolume(volume: number): boolean {
  try {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    log('Setting track volume: ' + clampedVolume);
    cursorTrack.volume().set(clampedVolume);
    log('Track volume set to: ' + clampedVolume);
    return true;
  } catch (e) {
    log('Error setting volume: ' + e, 'error');
    return false;
  }
}

// Set track pan (-1.0 to 1.0)
function setTrackPan(pan: number): boolean {
  try {
    const clampedPan = Math.max(-1, Math.min(1, pan));
    log('Setting track pan: ' + clampedPan);
    // Bitwig pan is 0-1 where 0.5 is center, convert from -1 to 1
    const bitwigPan = (clampedPan + 1) / 2;
    cursorTrack.pan().set(bitwigPan);
    log('Track pan set to: ' + clampedPan + ' (bitwig: ' + bitwigPan + ')');
    return true;
  } catch (e) {
    log('Error setting pan: ' + e, 'error');
    return false;
  }
}

// Find tracks by name (exact match, case-insensitive)
function findTracksByName(name: string): { index: number; name: string }[] {
  try {
    const matches: { index: number; name: string }[] = [];
    const bankSize = 16;
    const searchName = name.toLowerCase();

    for (let i = 0; i < bankSize; i++) {
      const track = trackBank.getItemAt(i);
      if (track && track.exists().get()) {
        const trackName = track.name().get();
        if (trackName.toLowerCase() === searchName) {
          matches.push({ index: i, name: trackName });
        }
      }
    }

    log('Found ' + matches.length + ' track(s) named "' + name + '"');
    return matches;
  } catch (e) {
    log('Error finding tracks by name: ' + e, 'error');
    return [];
  }
}

// Select track by name - returns success and track info, or error if 0 or 2+ matches
function selectTrackByName(name: string): { success: boolean; error?: string; track?: any } {
  try {
    const matches = findTracksByName(name);

    if (matches.length === 0) {
      return { success: false, error: 'No track found with name: ' + name };
    }

    if (matches.length > 1) {
      return { success: false, error: 'Multiple tracks (' + matches.length + ') found with name: ' + name };
    }

    // Exactly one match - select it
    const trackIndex = matches[0].index;
    if (selectTrackByIndex(trackIndex)) {
      return { success: true, track: getTrackInfo() };
    } else {
      return { success: false, error: 'Failed to select track at index ' + trackIndex };
    }
  } catch (e) {
    log('Error selecting track by name: ' + e, 'error');
    return { success: false, error: 'Exception: ' + e };
  }
}

// Process commands from file
function processCommands(): void {
  if (!fileExists(COMMANDS_FILE)) {
    return;
  }

  try {
    const commands = readJSONFile(COMMANDS_FILE);
    if (!commands || !Array.isArray(commands) || commands.length === 0) {
      return;
    }

    log('Processing ' + commands.length + ' command(s)');

    // Process each command
    for (const cmd of commands) {
      const response: CommandResponse = {
        id: cmd.id,
        success: false
      };

      try {
        switch (cmd.action) {
          case 'createTrack':
            response.success = createTrack(
              cmd.params.type || 'instrument',
              cmd.params.position !== undefined ? cmd.params.position : -1
            );
            break;

          case 'renameTrack':
            if (cmd.params.name) {
              response.success = renameTrack(cmd.params.name);
            } else {
              response.error = 'Missing name parameter';
            }
            break;

          case 'insertDevice':
            if (cmd.params.deviceId && cmd.params.deviceType) {
              response.success = insertDevice(cmd.params.deviceId, cmd.params.deviceType);
            } else {
              response.error = 'Missing deviceId or deviceType parameter';
            }
            break;

          case 'insertDeviceByPath':
            if (cmd.params.path) {
              response.success = insertDeviceByPath(cmd.params.path);
            } else {
              response.error = 'Missing path parameter';
            }
            break;

          case 'getTrackInfo':
            const info = getTrackInfo();
            if (info) {
              response.success = true;
              response.data = info;
            } else {
              response.error = 'Failed to get track info';
            }
            break;

          case 'selectTrack':
            if (cmd.params.trackIndex !== undefined) {
              response.success = selectTrackByIndex(cmd.params.trackIndex);
              if (response.success) {
                response.data = getTrackInfo();
              }
            } else {
              response.error = 'Missing trackIndex parameter';
            }
            break;

          case 'navigateTrack':
            if (cmd.params.direction) {
              response.success = navigateTrack(cmd.params.direction);
              if (response.success) {
                response.data = getTrackInfo();
              }
            } else {
              response.error = 'Missing direction parameter';
            }
            break;

          case 'setTrackMute':
            if (cmd.params.mute !== undefined) {
              response.success = setTrackMute(cmd.params.mute);
            } else {
              response.error = 'Missing mute parameter';
            }
            break;

          case 'setTrackSolo':
            if (cmd.params.solo !== undefined) {
              response.success = setTrackSolo(cmd.params.solo);
            } else {
              response.error = 'Missing solo parameter';
            }
            break;

          case 'getTrackList':
            const tracks = getTrackList();
            response.success = true;
            response.data = { tracks, count: tracks.length };
            break;

          case 'setTrackColor':
            if (cmd.params.color) {
              response.success = setTrackColor(cmd.params.color);
            } else {
              response.error = 'Missing color parameter';
            }
            break;

          case 'setTrackVolume':
            if (cmd.params.volume !== undefined) {
              response.success = setTrackVolume(cmd.params.volume);
            } else {
              response.error = 'Missing volume parameter';
            }
            break;

          case 'setTrackPan':
            if (cmd.params.pan !== undefined) {
              response.success = setTrackPan(cmd.params.pan);
            } else {
              response.error = 'Missing pan parameter';
            }
            break;

          case 'findTracksByName':
            if (cmd.params.name) {
              const matches = findTracksByName(cmd.params.name);
              response.success = true;
              response.data = { matches, count: matches.length };
            } else {
              response.error = 'Missing name parameter';
            }
            break;

          case 'selectTrackByName':
            if (cmd.params.name) {
              const result = selectTrackByName(cmd.params.name);
              response.success = result.success;
              response.data = result.track;
              response.error = result.error;
            } else {
              response.error = 'Missing name parameter';
            }
            break;

          case 'insertPresetFile':
            if (cmd.params.filePath) {
              response.success = insertPresetFile(cmd.params.filePath);
            } else {
              response.error = 'Missing filePath parameter';
            }
            break;

          case 'createClip':
            if (cmd.params.slotIndex !== undefined && cmd.params.lengthInBeats !== undefined) {
              response.success = createClip(cmd.params.slotIndex, cmd.params.lengthInBeats);
            } else {
              response.error = 'Missing slotIndex or lengthInBeats parameter';
            }
            break;

          case 'setNotes':
            if (cmd.params.notes && Array.isArray(cmd.params.notes)) {
              response.success = setNotes(cmd.params.notes);
              response.data = { notesSet: cmd.params.notes.length };
            } else {
              response.error = 'Missing or invalid notes array';
            }
            break;

          case 'clearClip':
            cursorClip.clearSteps();
            response.success = true;
            log('Clip cleared');
            break;

          default:
            response.error = 'Unknown action: ' + cmd.action;
        }
      } catch (e) {
        response.error = 'Command execution error: ' + e;
      }

      // Write response
      writeResponse(response);
      log('Command ' + cmd.id + ' completed: ' + (response.success ? 'success' : response.error));
    }

    // Delete commands file after processing
    deleteFile(COMMANDS_FILE);

  } catch (e) {
    log('Error processing commands: ' + e, 'error');
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

  // IMPORTANT: All PopupBrowser operations must happen during init()
  // We'll set up the enumeration here and let observers handle async work
  try {
    log('Setting up content enumeration...');
    log('Clearing browser filters and enumerating all content');

    const browser = host.createPopupBrowser();
    const startTime = new Date().getTime();

    // CRITICAL: Subscribe to browser to ensure it's active
    browser.subscribe();
    log('Subscribed to browser');

    // CRITICAL: Clear all filters first by selecting wildcard items
    // Without this, the browser may be filtered and show 0 items
    log('Clearing browser filters...');
    const deviceCol = browser.deviceColumn();
    deviceCol.subscribe();
    const wildcardDevice = deviceCol.getWildcardItem();
    wildcardDevice.isSelected().set(true);

    const results = browser.resultsColumn();
    results.subscribe();
    log('Subscribed to results column');

    log('='.repeat(60));
    log('Starting content enumeration...');
    log('This will take a few seconds...');
    log('='.repeat(60));

    isScanning = true;
    allContent = [];

    // Get total count
    results.entryCount().addValueObserver((count: number) => {
      log('Found ' + count + ' total items in browser');

      if (count === 0) {
        log('No items found - browser may be empty or filtered');
        finishEnumeration(startTime);
        return;
      }

      // Create item bank (limit to 10000 items)
      const maxItems = Math.min(count, 10000);
      const bank = results.createItemBank(maxItems);
      let processedCount = 0;

      log('Creating item bank for ' + maxItems + ' items...');

      for (let i = 0; i < maxItems; i++) {
        const item = bank.getItemAt(i);
        const itemIndex = i;

        item.name().addValueObserver((name: string) => {
          if (name && name !== '') {
            const contentItem: ContentItem = {
              index: allContent.length,
              contentType: 'Unknown', // We don't know the type with this approach
              name: name,
              nameTokens: tokenize(name)
            };

            allContent.push(contentItem);
          }

          processedCount++;
          if (processedCount >= maxItems) {
            // All items processed
            host.scheduleTask(() => {
              finishEnumeration(startTime);
            }, 500);
          }
        });
      }
    });

  } catch (e) {
    log('ERROR: Failed to set up content enumeration: ' + e, 'error');
    isScanning = false;
  }

  // Check for rescan flag every 10 seconds
  host.scheduleTask(function checkFlag() {
    checkRescanFlag();
    host.scheduleTask(checkFlag, 10000);
  }, 10000);

  // ==========================================================================
  // Track Management Initialization
  // ==========================================================================
  try {
    log('Initializing track management...');

    // Get application for creating tracks
    application = host.createApplication();
    log('Application API initialized');

    // Create cursor track for track selection and manipulation
    // numSends=0, numScenes=8 (need scenes for clip launcher slots)
    cursorTrack = host.createCursorTrack('jeannie-cursor', 'Jeannie Cursor', 0, 8, true);
    log('Cursor track initialized (8 scene slots)');

    // Create cursor device for device insertion (must be created at init time)
    const CursorDeviceFollowMode = Java.type('com.bitwig.extension.controller.api.CursorDeviceFollowMode');
    cursorDevice = cursorTrack.createCursorDevice('jeannie-device', 'Jeannie Device', 0, CursorDeviceFollowMode.FOLLOW_SELECTION);
    log('Cursor device initialized');

    // Create track bank for accessing multiple tracks
    trackBank = host.createMainTrackBank(16, 0, 8);  // 16 tracks, 0 sends, 8 scenes
    log('Track bank initialized (16 tracks, 8 scenes)');

    // Create cursor clip for clip/note manipulation
    // Grid: 128 steps (32 bars at 4 steps/beat) x 128 keys (full MIDI range)
    cursorClip = host.createLauncherCursorClip(128, 128);
    cursorClip.setStepSize(0.25);  // 16th notes (1/4 beat per step)
    log('Cursor clip initialized (128x128 grid, 16th note resolution)');

    // Mark track properties as interested so we can read them at runtime
    for (let i = 0; i < 16; i++) {
      const track = trackBank.getItemAt(i);
      track.name().markInterested();
      track.exists().markInterested();
      track.mute().markInterested();
      track.solo().markInterested();
      track.position().markInterested();
    }
    log('Track bank properties marked as interested');

    // Subscribe to track name changes
    cursorTrack.name().addValueObserver((name: string) => {
      log('Selected track: ' + name);
    });

    // Subscribe to track position changes
    cursorTrack.position().addValueObserver((pos: number) => {
      log('Track position: ' + pos);
    });

    log('Track management ready!');
    log('Commands file: ' + COMMANDS_FILE);
    log('Response file: ' + RESPONSE_FILE);

  } catch (e) {
    log('ERROR: Failed to initialize track management: ' + e, 'error');
  }

  // Process commands every 500ms
  host.scheduleTask(function processLoop() {
    processCommands();
    host.scheduleTask(processLoop, 500);
  }, 1000);

  log('='.repeat(60));
  log('Jeannie controller fully initialized');
  log('Track creation: application.createInstrumentTrack()');
  log('Track naming: cursorTrack.name().set()');
  log('Device insertion: insertionPoint.insertVST3Device()');
  log('='.repeat(60));
}

function exit(): void {
  log('[Jeannie] Shutting down...');
}

function flush(): void {
  // Called periodically to flush any pending changes
}
