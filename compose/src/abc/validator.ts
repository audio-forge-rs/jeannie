/**
 * ABC Notation Validator
 * Version: 0.1.0
 *
 * Validates ABC notation for:
 * - Syntax correctness
 * - Required headers (T, M, K)
 * - Bar count consistency across voices
 * - Note range validation (for instrument compatibility)
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseAbcFile, parseAbcContent, AbcParseResult, countBars } from './parser';

// =============================================================================
// Types
// =============================================================================

export interface ValidationOptions {
  strict?: boolean;      // Treat warnings as errors
  checkBars?: boolean;   // Check that all voices have same bar count
  noteRange?: {          // Check notes are within range
    low: number;         // MIDI note number
    high: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    title?: string;
    key?: string;
    meter?: string;
  };
  barCount?: number;
  voiceBarCounts?: Record<string, number>;
}

export interface DirectoryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  files: Record<string, ValidationResult>;
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate an ABC file
 */
export async function validateAbcFile(
  filePath: string,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file exists
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      errors: [`File not found: ${filePath}`],
      warnings: []
    };
  }

  // Check file extension
  if (!filePath.endsWith('.abc')) {
    warnings.push(`File does not have .abc extension: ${filePath}`);
  }

  // Parse the file
  const parseResult = parseAbcFile(filePath);

  if (parseResult.error) {
    return {
      valid: false,
      errors: [parseResult.error],
      warnings
    };
  }

  // Validate content
  return validateAbcParseResult(parseResult, options, warnings);
}

/**
 * Validate ABC content string
 */
export async function validateAbcContent(
  content: string,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const parseResult = parseAbcContent(content);

  if (parseResult.error) {
    return {
      valid: false,
      errors: [parseResult.error],
      warnings: []
    };
  }

  return validateAbcParseResult(parseResult, options);
}

/**
 * Validate a parsed ABC result
 */
function validateAbcParseResult(
  parseResult: AbcParseResult,
  options: ValidationOptions,
  initialWarnings: string[] = []
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [...initialWarnings];

  const { metadata, voices } = parseResult;

  // Check required headers
  if (!metadata?.key) {
    errors.push('Missing required header: K (key signature)');
  }

  if (!metadata?.meter) {
    warnings.push('Missing header: M (meter/time signature)');
  }

  if (!metadata?.title) {
    warnings.push('Missing header: T (title)');
  }

  // Check voices exist
  if (!voices || voices.length === 0) {
    errors.push('No music content found');
  } else {
    // Check bar counts
    const voiceBarCounts: Record<string, number> = {};

    for (const voice of voices) {
      voiceBarCounts[voice.id] = voice.barCount;

      if (voice.barCount === 0) {
        warnings.push(`Voice "${voice.id}" has no bars`);
      }
    }

    // Check bar count consistency
    if (options.checkBars && voices.length > 1) {
      const barCounts = Object.values(voiceBarCounts);
      const firstCount = barCounts[0];

      if (!barCounts.every(c => c === firstCount)) {
        errors.push(
          `Bar count mismatch: ${Object.entries(voiceBarCounts)
            .map(([id, count]) => `${id}=${count}`)
            .join(', ')}`
        );
      }
    }

    // Note range validation (if specified)
    if (options.noteRange) {
      // TODO: Extract notes and validate range
      // This would require implementing note extraction with MIDI conversion
    }
  }

  // In strict mode, warnings become errors
  if (options.strict) {
    errors.push(...warnings);
    warnings.length = 0;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      title: metadata?.title,
      key: metadata?.key,
      meter: metadata?.meter
    },
    barCount: parseResult.barCount,
    voiceBarCounts: voices?.reduce((acc, v) => {
      acc[v.id] = v.barCount;
      return acc;
    }, {} as Record<string, number>)
  };
}

/**
 * Validate all ABC files in a directory
 */
export async function validateAbcDirectory(
  dirPath: string,
  options: ValidationOptions = {}
): Promise<DirectoryValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const files: Record<string, ValidationResult> = {};

  // Check directory exists
  if (!fs.existsSync(dirPath)) {
    return {
      valid: false,
      errors: [`Directory not found: ${dirPath}`],
      warnings: [],
      files: {}
    };
  }

  // Find all .abc files
  const entries = fs.readdirSync(dirPath);
  const abcFiles = entries.filter(e => e.endsWith('.abc'));

  if (abcFiles.length === 0) {
    return {
      valid: false,
      errors: ['No .abc files found in directory'],
      warnings: [],
      files: {}
    };
  }

  console.log(`Found ${abcFiles.length} ABC file(s)`);

  // Validate each file
  let allBarCounts: number[] = [];

  for (const file of abcFiles) {
    const filePath = path.join(dirPath, file);
    console.log(`  Validating: ${file}`);

    const result = await validateAbcFile(filePath, options);
    files[file] = result;

    if (!result.valid) {
      errors.push(`${file}: ${result.errors.join(', ')}`);
    }

    warnings.push(...result.warnings.map(w => `${file}: ${w}`));

    if (result.barCount) {
      allBarCounts.push(result.barCount);
    }
  }

  // Check bar count consistency across all files
  if (options.checkBars && allBarCounts.length > 1) {
    const firstCount = allBarCounts[0];
    if (!allBarCounts.every(c => c === firstCount)) {
      errors.push(
        `Bar count mismatch across files: ${abcFiles
          .map((f, i) => `${f}=${allBarCounts[i]}`)
          .join(', ')}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    files
  };
}

/**
 * Quick syntax check for ABC content
 */
export function quickSyntaxCheck(content: string): { valid: boolean; error?: string } {
  // Check for minimum required structure
  if (!content.includes('K:')) {
    return { valid: false, error: 'Missing K: (key signature) header' };
  }

  // Check for basic note content
  const hasNotes = /[A-Ga-g]/.test(content);
  if (!hasNotes) {
    return { valid: false, error: 'No notes found in content' };
  }

  // Check for balanced brackets
  const openBrackets = (content.match(/\[/g) || []).length;
  const closeBrackets = (content.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    return { valid: false, error: 'Unbalanced brackets' };
  }

  return { valid: true };
}
