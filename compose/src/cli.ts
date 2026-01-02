#!/usr/bin/env node
/**
 * Jeannie Compose CLI
 * Vendor: Audio Forge RS
 *
 * Single entrypoint for ABC notation -> MIDI -> Bitwig workflow.
 * Version is read from /versions.json (single source of truth)
 *
 * Usage:
 *   jeannie-compose --abc ./song/ --validate --convert --load
 *   jeannie-compose validate ./song/piano.abc
 *   jeannie-compose convert ./song/ --output ./midi/
 *   jeannie-compose load ./midi/ --project "My Song"
 */

import { Command } from 'commander';
import { validateAbcFile, validateAbcDirectory } from './abc/validator';
import { parseAbcFile } from './abc/parser';
import { convertAbcFileToMidi, convertAbcDirectory } from './midi/converter';
import * as fs from 'fs';
import * as path from 'path';

// Load versions from single source of truth
const VERSIONS_FILE = path.join(__dirname, '..', '..', 'versions.json');
const versions = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));
const VERSION = versions.compose;

const program = new Command();

program
  .name('jeannie-compose')
  .description('ABC notation to MIDI to Bitwig composition pipeline')
  .version(VERSION);

// =============================================================================
// Validate Command
// =============================================================================

program
  .command('validate <path>')
  .description('Validate ABC notation files')
  .option('--strict', 'Enable strict validation (warnings as errors)')
  .option('--bars', 'Check that all parts have the same number of bars')
  .action(async (inputPath: string, options) => {
    console.log('='.repeat(60));
    console.log('Jeannie Compose - ABC Validator');
    console.log('='.repeat(60));

    const stats = fs.statSync(inputPath);

    if (stats.isDirectory()) {
      const result = await validateAbcDirectory(inputPath, {
        strict: options.strict,
        checkBars: options.bars
      });

      if (result.valid) {
        console.log('\n[OK] All ABC files are valid');
        if (result.warnings.length > 0) {
          console.log(`\nWarnings (${result.warnings.length}):`);
          result.warnings.forEach(w => console.log(`  - ${w}`));
        }
        process.exit(0);
      } else {
        console.error('\n[ERROR] Validation failed:');
        result.errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
      }
    } else {
      const result = await validateAbcFile(inputPath, {
        strict: options.strict
      });

      if (result.valid) {
        console.log(`\n[OK] ${inputPath} is valid`);
        console.log(`  Title: ${result.metadata?.title || 'Unknown'}`);
        console.log(`  Key: ${result.metadata?.key || 'Unknown'}`);
        console.log(`  Meter: ${result.metadata?.meter || 'Unknown'}`);
        console.log(`  Bars: ${result.barCount || 'Unknown'}`);
        process.exit(0);
      } else {
        console.error(`\n[ERROR] ${inputPath} is invalid:`);
        result.errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
      }
    }
  });

// =============================================================================
// Parse Command (for debugging)
// =============================================================================

program
  .command('parse <file>')
  .description('Parse and display ABC notation structure')
  .action(async (file: string) => {
    console.log('='.repeat(60));
    console.log('Jeannie Compose - ABC Parser');
    console.log('='.repeat(60));

    const result = parseAbcFile(file);

    if (result.error) {
      console.error(`\n[ERROR] ${result.error}`);
      process.exit(1);
    }

    console.log('\nMetadata:');
    console.log(`  Title: ${result.metadata?.title}`);
    console.log(`  Composer: ${result.metadata?.composer || 'Unknown'}`);
    console.log(`  Key: ${result.metadata?.key}`);
    console.log(`  Meter: ${result.metadata?.meter}`);
    console.log(`  Tempo: ${result.metadata?.tempo || 'Default'}`);

    console.log('\nVoices:');
    result.voices?.forEach((voice, i) => {
      console.log(`  [${i + 1}] ${voice.id}: ${voice.name || 'Unnamed'}`);
      console.log(`      Bars: ${voice.barCount}`);
    });

    process.exit(0);
  });

// =============================================================================
// Convert Command
// =============================================================================

program
  .command('convert <path>')
  .description('Convert ABC notation to MIDI')
  .option('-o, --output <dir>', 'Output directory for MIDI files')
  .option('--validate', 'Validate before converting')
  .option('--bpm <number>', 'Override tempo (BPM)', parseInt)
  .option('--transpose <semitones>', 'Transpose by semitones', parseInt)
  .action(async (inputPath: string, options) => {
    console.log('='.repeat(60));
    console.log('Jeannie Compose - ABC to MIDI Converter');
    console.log('='.repeat(60));

    // Validate first if requested
    if (options.validate) {
      console.log('\n[1/2] Validating ABC...');
      const stats = fs.statSync(inputPath);

      if (stats.isDirectory()) {
        const valResult = await validateAbcDirectory(inputPath, { checkBars: true });
        if (!valResult.valid) {
          console.error('\n[ERROR] Validation failed:');
          valResult.errors.forEach(e => console.error(`  - ${e}`));
          process.exit(1);
        }
        console.log('  [OK] Validation passed');
      } else {
        const valResult = await validateAbcFile(inputPath);
        if (!valResult.valid) {
          console.error('\n[ERROR] Validation failed:');
          valResult.errors.forEach(e => console.error(`  - ${e}`));
          process.exit(1);
        }
        console.log('  [OK] Validation passed');
      }
    }

    // Convert
    console.log(options.validate ? '\n[2/2] Converting to MIDI...' : '\nConverting to MIDI...');

    const stats = fs.statSync(inputPath);
    const conversionOptions = {
      bpm: options.bpm,
      transpose: options.transpose,
      outputDir: options.output
    };

    if (stats.isDirectory()) {
      const result = await convertAbcDirectory(inputPath, conversionOptions);

      console.log(`\nResults: ${result.successCount}/${result.totalFiles} files converted`);

      for (const [file, fileResult] of Object.entries(result.results)) {
        if (fileResult.success) {
          console.log(`  [OK] ${file} -> ${fileResult.outputPath}`);
          console.log(`       Tracks: ${fileResult.trackCount}, Notes: ${fileResult.noteCount}`);
        } else {
          console.error(`  [FAIL] ${file}: ${fileResult.error}`);
        }
      }

      if (result.failCount > 0) {
        process.exit(1);
      }
    } else {
      // Determine output path
      let outputPath = options.output;
      if (outputPath && fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
        const baseName = path.basename(inputPath, '.abc');
        outputPath = path.join(outputPath, baseName + '.mid');
      }

      const result = await convertAbcFileToMidi(inputPath, {
        ...conversionOptions,
        outputPath
      });

      if (result.success) {
        console.log(`\n[OK] Converted successfully!`);
        console.log(`  Output: ${result.outputPath}`);
        console.log(`  Tracks: ${result.trackCount}`);
        console.log(`  Notes: ${result.noteCount}`);
        console.log(`  Bars: ${result.durationBars || 'Unknown'}`);
      } else {
        console.error(`\n[ERROR] Conversion failed: ${result.error}`);
        process.exit(1);
      }
    }

    process.exit(0);
  });

// =============================================================================
// Load Command - Create tracks in Bitwig
// =============================================================================

const JEANNIE_API_URL = process.env.JEANNIE_API_URL || 'http://localhost:3000';

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

async function callJeannieApi(endpoint: string, method: string = 'GET', body?: any): Promise<ApiResponse> {
  try {
    const response = await fetch(`${JEANNIE_API_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return await response.json() as ApiResponse;
  } catch (error) {
    return { success: false, error: `API call failed: ${error}` };
  }
}

async function checkBitwigConnection(): Promise<boolean> {
  const status = await callJeannieApi('/api/status');
  return status.success && status.data?.bitwig?.connected;
}

program
  .command('load <path>')
  .description('Load MIDI files into Bitwig via controller')
  .option('-p, --project <name>', 'Project name')
  .option('--create-tracks', 'Create instrument tracks automatically')
  .option('--dry-run', 'Show what would be done without making changes')
  .action(async (inputPath: string, options) => {
    console.log('='.repeat(60));
    console.log('Jeannie Compose - Bitwig Loader');
    console.log('='.repeat(60));

    // Check if Bitwig is connected
    console.log('\nChecking Bitwig connection...');
    const connected = await checkBitwigConnection();

    if (!connected) {
      console.error('\n[ERROR] Bitwig is not running or controller not loaded');
      console.error('Please ensure:');
      console.error('  1. Bitwig Studio is running');
      console.error('  2. Jeannie controller is enabled in Settings > Controllers');
      console.error('  3. Jeannie web server is running (npm start in web/)');
      process.exit(1);
    }
    console.log('  [OK] Bitwig connected');

    // Check input path
    if (!fs.existsSync(inputPath)) {
      console.error(`\n[ERROR] Path not found: ${inputPath}`);
      process.exit(1);
    }

    const stats = fs.statSync(inputPath);
    const midiFiles: string[] = [];

    if (stats.isDirectory()) {
      // Find all MIDI files in directory
      const entries = fs.readdirSync(inputPath);
      for (const entry of entries) {
        if (entry.endsWith('.mid') || entry.endsWith('.midi')) {
          midiFiles.push(path.join(inputPath, entry));
        }
      }
    } else if (inputPath.endsWith('.mid') || inputPath.endsWith('.midi')) {
      midiFiles.push(inputPath);
    } else if (inputPath.endsWith('.abc')) {
      // Convert ABC to MIDI first
      console.log('\nConverting ABC to MIDI...');
      const result = await convertAbcFileToMidi(inputPath);
      if (result.success && result.outputPath) {
        midiFiles.push(result.outputPath);
        console.log(`  [OK] Converted to: ${result.outputPath}`);
      } else {
        console.error(`\n[ERROR] Failed to convert ABC: ${result.error}`);
        process.exit(1);
      }
    }

    if (midiFiles.length === 0) {
      console.error('\n[ERROR] No MIDI files found');
      process.exit(1);
    }

    console.log(`\nFound ${midiFiles.length} MIDI file(s):`);
    midiFiles.forEach(f => console.log(`  - ${path.basename(f)}`));

    if (options.dryRun) {
      console.log('\n[DRY RUN] Would create tracks:');
      for (const midiFile of midiFiles) {
        const trackName = path.basename(midiFile, path.extname(midiFile));
        console.log(`  - Instrument track: "${trackName}"`);
      }
      console.log('\nUse without --dry-run to actually create tracks.');
      process.exit(0);
    }

    // Create tracks for each MIDI file
    console.log('\nCreating tracks in Bitwig...');
    let successCount = 0;

    for (const midiFile of midiFiles) {
      const trackName = path.basename(midiFile, path.extname(midiFile));
      console.log(`  Creating track: "${trackName}"...`);

      const result = await callJeannieApi('/api/bitwig/tracks', 'POST', {
        type: 'instrument',
        name: trackName
      });

      if (result.success) {
        console.log(`    [OK] Track created`);
        successCount++;
      } else {
        console.error(`    [FAIL] ${result.error}`);
      }
    }

    console.log(`\n${successCount}/${midiFiles.length} tracks created successfully`);
    console.log('\nNext steps:');
    console.log('  1. Select instruments for each track in Bitwig');
    console.log('  2. Import MIDI clips manually (drag & drop)');
    console.log('  3. Or use Bitwig\'s File > Import MIDI feature');

    process.exit(successCount === midiFiles.length ? 0 : 1);
  });

// =============================================================================
// Full Pipeline Command
// =============================================================================

program
  .command('pipeline <path>')
  .description('Run full ABC -> MIDI -> Bitwig pipeline')
  .option('--validate', 'Validate ABC files first')
  .option('--convert', 'Convert to MIDI')
  .option('--load', 'Load into Bitwig')
  .option('-o, --output <dir>', 'Output directory for MIDI files')
  .option('-p, --project <name>', 'Bitwig project name')
  .action(async (inputPath: string, options) => {
    console.log('='.repeat(60));
    console.log('Jeannie Compose - Full Pipeline');
    console.log('='.repeat(60));

    const steps = [];
    if (options.validate) steps.push('validate');
    if (options.convert) steps.push('convert');
    if (options.load) steps.push('load');

    console.log(`\nSteps: ${steps.join(' -> ') || '(none selected)'}`);
    console.log(`Input: ${inputPath}`);
    console.log(`Output: ${options.output || './midi/'}`);
    console.log(`Project: ${options.project || 'Unnamed'}`);

    // TODO: Implement pipeline steps

    if (steps.length === 0) {
      console.log('\nNo steps selected. Use --validate, --convert, --load');
    }

    process.exit(0);
  });

// =============================================================================
// Info Command
// =============================================================================

program
  .command('info')
  .description('Show system information and capabilities')
  .action(() => {
    console.log('='.repeat(60));
    console.log('Jeannie Compose - System Information');
    console.log('='.repeat(60));

    console.log(`\nVersion: ${VERSION}`);
    console.log('\nCapabilities:');
    console.log('  [x] ABC notation parsing');
    console.log('  [x] ABC validation (syntax, bar counts)');
    console.log('  [x] ABC to MIDI conversion (midi-writer-js)');
    console.log('  [x] Bitwig track creation (via controller API)');
    console.log('  [x] Bitwig track naming (via controller API)');
    console.log('  [ ] Bitwig device insertion (partial)');
    console.log('  [ ] Live MIDI note sending (TODO)');

    console.log('\nABC Notation:');
    console.log('  Standard: ABC 2.1');
    console.log('  Voices: Multi-voice support');
    console.log('  Features: Headers, notes, rests, bars, repeats');

    console.log('\nBitwig Integration:');
    console.log('  Controller: Jeannie v0.7.0+');
    console.log('  Content Index: ~/.config/jeannie/content.json');
    console.log('  API: http://localhost:3000');

    process.exit(0);
  });

program.parse();
