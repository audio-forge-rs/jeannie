# Device Enumeration Guide for Jeannie

## Overview

This guide shows how to enumerate all devices (VST, CLAP, built-in Bitwig devices, Grid, etc.) using the Bitwig Control Surface API v18.

## API Documentation Location

Local: `file:///Applications/Bitwig%20Studio.app/Contents/Resources/Documentation/control-surface/api/index.html`

## Key API Interfaces

### PopupBrowser
Main interface for accessing the Bitwig browser:
```typescript
const browser = host.createPopupBrowser();
```

### Available Columns
- `deviceColumn()` - All available devices
- `deviceTypeColumn()` - Filter by type (Instrument, Audio FX, Note FX, Container)
- `fileTypeColumn()` - Format (VST2, VST3, CLAP, Bitwig Native)
- `creatorColumn()` - Vendor/creator names
- `categoryColumn()` - Device categories
- `tagColumn()` - User tags
- `locationColumn()` - Installation paths
- `resultsColumn()` - Final filtered results

### BrowserResultsColumn Methods
```typescript
resultsColumn.entryCount()              // Total number of results
resultsColumn.createCursorItem()        // Navigate through items
resultsColumn.createItemBank(size)      // Access multiple items at once
```

### BrowserItem Methods
```typescript
item.name()                             // Device name
item.exists()                           // Check if item exists
item.isSelected()                       // Selection state
```

## Implementation Strategy

### Approach 1: Enumerate All Devices on Init

```typescript
declare const host: {
  createPopupBrowser: () => any;
  println: (msg: string) => void;
  // ... other methods
};

function init(): void {
  log('Jeannie initialized');

  // Enumerate devices after a short delay (let Bitwig finish loading)
  host.scheduleTask(() => {
    enumerateAllDevices();
  }, 1000); // 1 second delay
}

function enumerateAllDevices(): void {
  log('Starting device enumeration...');

  const browser = host.createPopupBrowser();
  const results = browser.resultsColumn();

  // Get total count first
  results.entryCount().addValueObserver((count: number) => {
    log(`Found ${count} total devices`);

    if (count > 0) {
      // Create item bank to access all devices
      const bank = results.createItemBank(Math.min(count, 1000)); // Max 1000 at a time

      // Scroll through all items
      for (let i = 0; i < Math.min(count, 1000); i++) {
        const item = bank.getItemAt(i);

        item.name().addValueObserver((name: string) => {
          if (name && name !== '') {
            log(`Device ${i}: ${name}`);
            // TODO: Send to web API
          }
        });
      }
    }
  });
}
```

### Approach 2: Enumerate by Device Type

```typescript
function enumerateDevicesByType(): void {
  const browser = host.createPopupBrowser();

  // Get device type column
  const deviceTypeCol = browser.deviceTypeColumn();
  const typeBank = deviceTypeCol.createItemBank(10);

  // Iterate through device types (Instrument, Audio FX, etc.)
  for (let i = 0; i < 10; i++) {
    const typeItem = typeBank.getItemAt(i);

    typeItem.name().addValueObserver((typeName: string) => {
      if (typeName && typeName !== '') {
        log(`Device Type: ${typeName}`);

        // Select this type to filter
        typeItem.isSelected().set(true);

        // Get results for this type
        const results = browser.resultsColumn();
        results.entryCount().addValueObserver((count: number) => {
          log(`  ${typeName} has ${count} devices`);
        });
      }
    });
  }
}
```

### Approach 3: Enumerate by File Type (VST/CLAP/Native)

```typescript
function enumerateByFileType(): void {
  const browser = host.createPopupBrowser();
  const fileTypeCol = browser.fileTypeColumn();

  // Get wildcard (all) filter first
  const wildcardItem = fileTypeCol.getWildcardItem();
  wildcardItem.isSelected().set(true);

  // Create bank for file types
  const fileTypeBank = fileTypeCol.createItemBank(20);

  for (let i = 0; i < 20; i++) {
    const fileTypeItem = fileTypeBank.getItemAt(i);

    fileTypeItem.name().addValueObserver((fileType: string) => {
      if (fileType && fileType !== '') {
        log(`File Type: ${fileType}`);

        // Get hit count for this file type
        fileTypeItem.hitCount().addValueObserver((count: number) => {
          log(`  ${fileType}: ${count} plugins`);
        });
      }
    });
  }
}
```

### Approach 4: Complete Enumeration with Details

```typescript
interface DeviceInfo {
  index: number;
  name: string;
  type?: string;
  fileType?: string;
  creator?: string;
  category?: string;
}

const allDevices: DeviceInfo[] = [];

function enumerateWithDetails(): void {
  const browser = host.createPopupBrowser();

  // Clear any filters - select wildcard on all columns
  const deviceCol = browser.deviceColumn();
  const wildcardDevice = deviceCol.getWildcardItem();
  wildcardDevice.isSelected().set(true);

  // Get results
  const results = browser.resultsColumn();

  results.entryCount().addValueObserver((totalCount: number) => {
    log(`Total devices to enumerate: ${totalCount}`);

    // Process in chunks of 100
    const chunkSize = 100;
    const numChunks = Math.ceil(totalCount / chunkSize);

    for (let chunk = 0; chunk < numChunks; chunk++) {
      const start = chunk * chunkSize;
      const end = Math.min(start + chunkSize, totalCount);

      // Scroll to this position
      results.scrollPosition().set(start);

      // Create bank for this chunk
      const bank = results.createItemBank(chunkSize);

      for (let i = 0; i < (end - start); i++) {
        const item = bank.getItemAt(i);
        const globalIndex = start + i;

        item.name().addValueObserver((name: string) => {
          if (name && name !== '') {
            const deviceInfo: DeviceInfo = {
              index: globalIndex,
              name: name
            };

            allDevices.push(deviceInfo);
            log(`[${globalIndex}] ${name}`);

            // Send to web API (implement sendDeviceToAPI)
            sendDeviceToAPI(deviceInfo);
          }
        });
      }
    }
  });
}

function sendDeviceToAPI(device: DeviceInfo): void {
  // TODO: Use Java HTTP client or write to file for web server to pick up
  log(`Sending device to API: ${device.name}`);
}
```

## Complete Type Declarations

Add these to your controller TypeScript file:

```typescript
// Extended Bitwig API type declarations
declare const host: {
  defineController: (vendor: string, name: string, version: string, uuid: string, author: string) => void;
  defineMidiPorts: (inputs: number, outputs: number) => void;
  println: (message: string) => void;
  createPopupBrowser: () => PopupBrowser;
  scheduleTask: (callback: () => void, delayMs: number) => void;
};

interface PopupBrowser {
  smartCollectionColumn(): BrowserFilterColumn;
  locationColumn(): BrowserFilterColumn;
  deviceColumn(): BrowserFilterColumn;
  categoryColumn(): BrowserFilterColumn;
  tagColumn(): BrowserFilterColumn;
  deviceTypeColumn(): BrowserFilterColumn;
  fileTypeColumn(): BrowserFilterColumn;
  creatorColumn(): BrowserFilterColumn;
  resultsColumn(): BrowserResultsColumn;
  canAudition(): BooleanValue;
  shouldAudition(): SettableBooleanValue;
  selectNextFile(): void;
  selectPreviousFile(): void;
  selectFirstFile(): void;
  selectLastFile(): void;
  cancel(): void;
  commit(): void;
  contentTypeNames(): StringArrayValue;
  selectedContentTypeName(): StringValue;
  selectedContentTypeIndex(): SettableIntegerValue;
  title(): StringValue;
}

interface BrowserFilterColumn extends BrowserColumn {
  getWildcardItem(): BrowserFilterItem;
  createCursorItem(): BrowserFilterItem;
  createItemBank(size: number): BrowserFilterItemBank;
  name(): StringValue;
}

interface BrowserResultsColumn extends BrowserColumn {
  createCursorItem(): BrowserResultsItem;
  createItemBank(size: number): BrowserResultsItemBank;
}

interface BrowserColumn {
  entryCount(): IntegerValue;
  scrollPosition(): SettableIntegerValue;
}

interface BrowserItem {
  exists(): BooleanValue;
  name(): StringValue;
  isSelected(): SettableBooleanValue;
}

interface BrowserFilterItem extends BrowserItem {
  hitCount(): IntegerValue;
}

interface BrowserResultsItem extends BrowserItem {
  // Same as BrowserItem
}

interface BrowserItemBank<T extends BrowserItem> {
  getItemAt(index: number): T;
  scrollPosition(): SettableIntegerValue;
  canScrollBackwards(): BooleanValue;
  canScrollForwards(): BooleanValue;
  scrollBackwards(): void;
  scrollForwards(): void;
  scrollBy(amount: number): void;
}

interface BrowserFilterItemBank extends BrowserItemBank<BrowserFilterItem> {}
interface BrowserResultsItemBank extends BrowserItemBank<BrowserResultsItem> {}

// Value types
interface Value {
  markInterested(): void;
  addValueObserver(callback: (value: any) => void): void;
}

interface BooleanValue extends Value {
  addValueObserver(callback: (value: boolean) => void): void;
  get(): boolean;
}

interface SettableBooleanValue extends BooleanValue {
  set(value: boolean): void;
}

interface IntegerValue extends Value {
  addValueObserver(callback: (value: number) => void): void;
  get(): number;
}

interface SettableIntegerValue extends IntegerValue {
  set(value: number): void;
}

interface StringValue extends Value {
  addValueObserver(callback: (value: string) => void): void;
  get(): string;
}

interface StringArrayValue extends Value {
  addValueObserver(callback: (value: string[]) => void): void;
  get(): string[];
}
```

## Recommended Implementation

For Jeannie, I recommend:

1. **On Init**: Enumerate all devices and write to JSON file
2. **Web API**: Read JSON file and expose via `/api/devices` endpoint
3. **Roger CLI**: Add `devices` command to query the list

### Step 1: Controller Enhancement

Add to `jeannie.control.ts`:
- Type declarations (above)
- `enumerateWithDetails()` function
- Write results to JSON file using Java FileWriter

### Step 2: Web API Enhancement

Add to `web/src/server.ts`:
- `/api/devices` endpoint that reads the JSON file
- `/api/devices/types` - List all device types
- `/api/devices/search?q=<query>` - Search devices

### Step 3: Roger CLI Enhancement

Add to `roger/roger.py`:
- `devices` command - List all devices
- `devices --type instrument` - Filter by type
- `devices --search <name>` - Search by name

## Next Steps

1. Do you want me to implement device enumeration in the controller?
2. Should I create the web API endpoints?
3. Should I add Roger CLI commands?
4. All of the above?

Let me know which direction you'd like to go!
