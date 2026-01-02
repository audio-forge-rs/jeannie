/**
 * Filesystem Content Scanner
 *
 * Scans the filesystem for audio plugins, Kontakt libraries, M-Tron patches, etc.
 * Works independently of Bitwig's PopupBrowser API.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { parseString } from 'xml2js';

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const exists = promisify(fs.exists);

interface ContentItem {
  index: number;
  contentType: string;
  name: string;
  deviceType?: string;
  fileType?: string;
  creator?: string;
  category?: string;
  plugin?: string;
  path?: string;
  nameTokens: string[];
  // Kontakt-specific
  library?: string;
  requiresFullKontakt?: boolean;
  kontaktVersion?: number;
  // M-Tron-specific
  collection?: string;
  cptId?: string;
  tapes?: string[];
}

interface ScanResult {
  version: string;
  scanDate: string;
  bitwigVersion: string;
  scanDurationMs: number;
  contentTypes: string[];
  totals: { [key: string]: number };
  content: ContentItem[];
  stats: any;
}

// Tokenize string for search
function tokenize(name: string): string[] {
  return name.toLowerCase()
    .split(/[\s\-_()]+/)
    .filter(t => t.length > 0);
}

// Check if path exists
async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// Find files recursively
async function findFiles(dir: string, pattern: RegExp, maxDepth: number = 10): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentPath: string, depth: number) {
    if (depth > maxDepth) return;

    try {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }

  await walk(dir, 0);
  return results;
}

/**
 * Scan VST3 plugins
 */
async function scanVST3Plugins(): Promise<ContentItem[]> {
  const vst3Paths = [
    '/Library/Audio/Plug-Ins/VST3',
    path.join(process.env.HOME || '', 'Library/Audio/Plug-Ins/VST3')
  ];

  const items: ContentItem[] = [];

  for (const basePath of vst3Paths) {
    if (!await pathExists(basePath)) continue;

    try {
      const entries = await readdir(basePath);

      for (const entry of entries) {
        if (entry.endsWith('.vst3')) {
          const name = entry.replace('.vst3', '');
          items.push({
            index: items.length,
            contentType: 'Device',
            name: name,
            deviceType: 'Unknown',
            fileType: 'VST3',
            path: path.join(basePath, entry),
            nameTokens: tokenize(name)
          });
        }
      }
    } catch (err) {
      console.error(`Error scanning VST3 path ${basePath}:`, err);
    }
  }

  return items;
}

/**
 * Scan CLAP plugins
 */
async function scanCLAPPlugins(): Promise<ContentItem[]> {
  const clapPaths = [
    '/Library/Audio/Plug-Ins/CLAP',
    path.join(process.env.HOME || '', 'Library/Audio/Plug-Ins/CLAP')
  ];

  const items: ContentItem[] = [];

  for (const basePath of clapPaths) {
    if (!await pathExists(basePath)) continue;

    try {
      const entries = await readdir(basePath);

      for (const entry of entries) {
        if (entry.endsWith('.clap')) {
          const name = entry.replace('.clap', '');
          items.push({
            index: items.length,
            contentType: 'Device',
            name: name,
            deviceType: 'Unknown',
            fileType: 'CLAP',
            path: path.join(basePath, entry),
            nameTokens: tokenize(name)
          });
        }
      }
    } catch (err) {
      console.error(`Error scanning CLAP path ${basePath}:`, err);
    }
  }

  return items;
}

/**
 * Parse M-Tron Pro XML patch
 */
async function parseMTronPatch(xmlPath: string): Promise<ContentItem | null> {
  try {
    const xmlContent = await readFile(xmlPath, 'utf-8');
    const result = await promisify(parseString)(xmlContent) as any;

    const metadata = result.patch?.metadata?.[0]?.$;
    if (!metadata) return null;

    return {
      index: 0, // Will be set later
      contentType: 'Preset',
      name: metadata.name || path.basename(xmlPath, '.xml'),
      creator: metadata.author || 'GForce Software',
      category: metadata.category || 'Unknown',
      plugin: 'M-Tron Pro IV',
      collection: metadata.collection || 'Unknown',
      cptId: metadata.cpt || 'Unknown',
      path: xmlPath,
      nameTokens: tokenize(metadata.name || '')
    };
  } catch (err) {
    console.error(`Error parsing M-Tron patch ${xmlPath}:`, err);
    return null;
  }
}

/**
 * Scan M-Tron Pro patches
 */
async function scanMTronPatches(): Promise<ContentItem[]> {
  const mtronPatchPath = '/Library/Application Support/GForce/M-Tron Pro IV/Patches';

  if (!await pathExists(mtronPatchPath)) {
    console.log('M-Tron Pro IV patches not found');
    return [];
  }

  const items: ContentItem[] = [];
  const xmlFiles = await findFiles(mtronPatchPath, /\.xml$/i, 1);

  for (const xmlFile of xmlFiles) {
    const patch = await parseMTronPatch(xmlFile);
    if (patch) {
      patch.index = items.length;
      items.push(patch);
    }
  }

  console.log(`Found ${items.length} M-Tron patches`);
  return items;
}

/**
 * Scan Kontakt library
 */
async function scanKontaktLibrary(libraryPath: string, version: number): Promise<ContentItem[]> {
  const items: ContentItem[] = [];

  // Check if it's a Player library (has .nicnt file)
  const nicntFiles = await findFiles(libraryPath, /\.nicnt$/i, 2);
  const isPlayerLibrary = nicntFiles.length > 0;

  // Find all .nki instrument files
  const nkiFiles = await findFiles(libraryPath, /\.nki$/i, 10);

  const libraryName = path.basename(libraryPath);

  for (const nkiFile of nkiFiles) {
    const name = path.basename(nkiFile, '.nki');

    items.push({
      index: items.length,
      contentType: 'Preset',
      name: name,
      creator: 'Native Instruments',
      plugin: `Kontakt ${version}`,
      library: libraryName,
      requiresFullKontakt: !isPlayerLibrary,
      kontaktVersion: version,
      path: nkiFile,
      nameTokens: tokenize(name)
    });
  }

  return items;
}

/**
 * Find all Kontakt versions installed
 */
async function findKontaktVersions(): Promise<number[]> {
  const versions: number[] = [];
  const basePath = '/Library/Application Support/Native Instruments';

  if (!await pathExists(basePath)) return versions;

  try {
    const entries = await readdir(basePath);

    for (const entry of entries) {
      const match = entry.match(/^Kontakt (\d+)$/);
      if (match) {
        versions.push(parseInt(match[1]));
      }
    }
  } catch (err) {
    console.error('Error finding Kontakt versions:', err);
  }

  return versions.sort((a, b) => b - a); // Newest first
}

/**
 * Scan all Kontakt libraries
 */
async function scanKontaktLibraries(): Promise<ContentItem[]> {
  const items: ContentItem[] = [];
  const versions = await findKontaktVersions();

  console.log(`Found Kontakt versions: ${versions.join(', ')}`);

  const libraryPaths: Array<{path: string, version: number}> = [];

  // Standard factory content paths
  for (const version of versions) {
    const contentPath = `/Library/Application Support/Native Instruments/Kontakt ${version}/Content`;
    if (await pathExists(contentPath)) {
      libraryPaths.push({ path: contentPath, version });
    }
  }

  // External drive
  const externalPath = '/Volumes/External/kontakt_libraries';
  if (await pathExists(externalPath)) {
    try {
      const libraries = await readdir(externalPath);
      for (const library of libraries) {
        const libraryPath = path.join(externalPath, library);
        const stats = await stat(libraryPath);
        if (stats.isDirectory()) {
          // Use the newest Kontakt version for external libraries
          libraryPaths.push({ path: libraryPath, version: versions[0] || 8 });
        }
      }
    } catch (err) {
      console.error('Error scanning external Kontakt libraries:', err);
    }
  }

  // Scan each library
  for (const { path: libraryPath, version } of libraryPaths) {
    console.log(`Scanning Kontakt library: ${libraryPath}`);
    const libraryItems = await scanKontaktLibrary(libraryPath, version);
    items.push(...libraryItems);
  }

  console.log(`Found ${items.length} Kontakt instruments`);
  return items;
}

/**
 * Main scan function
 */
export async function scanFilesystem(): Promise<ScanResult> {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('Starting filesystem content scan...');
  console.log('='.repeat(60));

  const allContent: ContentItem[] = [];

  // Scan VST3 plugins
  console.log('\n[1/4] Scanning VST3 plugins...');
  const vst3Items = await scanVST3Plugins();
  allContent.push(...vst3Items);
  console.log(`✓ Found ${vst3Items.length} VST3 plugins`);

  // Scan CLAP plugins
  console.log('\n[2/4] Scanning CLAP plugins...');
  const clapItems = await scanCLAPPlugins();
  allContent.push(...clapItems);
  console.log(`✓ Found ${clapItems.length} CLAP plugins`);

  // Scan M-Tron patches
  console.log('\n[3/4] Scanning M-Tron Pro patches...');
  const mtronItems = await scanMTronPatches();
  allContent.push(...mtronItems);
  console.log(`✓ Found ${mtronItems.length} M-Tron patches`);

  // Scan Kontakt libraries
  console.log('\n[4/4] Scanning Kontakt libraries...');
  const kontaktItems = await scanKontaktLibraries();
  allContent.push(...kontaktItems);
  console.log(`✓ Found ${kontaktItems.length} Kontakt instruments`);

  // Reindex all items
  allContent.forEach((item, index) => {
    item.index = index;
  });

  // Calculate statistics
  const stats: any = {
    byContentType: {},
    byFileType: {},
    byPlugin: {},
    byCreator: {},
    byCategory: {}
  };

  allContent.forEach(item => {
    // By content type
    if (!stats.byContentType[item.contentType]) {
      stats.byContentType[item.contentType] = 0;
    }
    stats.byContentType[item.contentType]++;

    // By file type
    if (item.fileType) {
      if (!stats.byFileType[item.fileType]) {
        stats.byFileType[item.fileType] = 0;
      }
      stats.byFileType[item.fileType]++;
    }

    // By plugin
    if (item.plugin) {
      if (!stats.byPlugin[item.plugin]) {
        stats.byPlugin[item.plugin] = 0;
      }
      stats.byPlugin[item.plugin]++;
    }

    // By creator
    if (item.creator) {
      if (!stats.byCreator[item.creator]) {
        stats.byCreator[item.creator] = 0;
      }
      stats.byCreator[item.creator]++;
    }

    // By category
    if (item.category) {
      if (!stats.byCategory[item.category]) {
        stats.byCategory[item.category] = 0;
      }
      stats.byCategory[item.category]++;
    }
  });

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log('\n' + '='.repeat(60));
  console.log('Scan complete!');
  console.log(`Total items: ${allContent.length}`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)} seconds`);
  console.log('='.repeat(60));

  return {
    version: '0.2.0',
    scanDate: new Date().toISOString(),
    bitwigVersion: 'Filesystem Scanner',
    scanDurationMs: duration,
    contentTypes: Object.keys(stats.byContentType),
    totals: {
      total: allContent.length,
      ...stats.byContentType
    },
    content: allContent,
    stats: stats
  };
}
