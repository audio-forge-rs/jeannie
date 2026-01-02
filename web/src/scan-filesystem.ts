#!/usr/bin/env node
/**
 * Filesystem Content Scanner CLI
 *
 * Scans the filesystem for audio content and writes to content.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { scanFilesystem } from './filesystemScanner';

const CONFIG_DIR = path.join(process.env.HOME || '', '.config', 'jeannie');
const CONTENT_FILE = path.join(CONFIG_DIR, 'content.json');

async function main() {
  console.log('Jeannie Filesystem Content Scanner v0.1.0\n');

  try {
    // Run the scan
    const result = await scanFilesystem();

    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Write to content.json
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(result, null, 2));

    console.log(`\n✓ Content index written to: ${CONTENT_FILE}`);
    console.log(`\nSummary:`);
    console.log(`  Total items: ${result.totals.total}`);
    Object.entries(result.totals).forEach(([key, value]) => {
      if (key !== 'total') {
        console.log(`    ${key}: ${value}`);
      }
    });

    console.log(`\nYou can now use the web UI or Roger CLI to search this content.`);
    console.log(`Web UI: http://localhost:3000`);
    console.log(`Roger CLI: roger content search <query>`);

  } catch (error) {
    console.error('\n✗ Error during scan:', error);
    process.exit(1);
  }
}

main();
