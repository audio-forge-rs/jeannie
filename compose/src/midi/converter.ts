/**
 * ABC to MIDI Converter
 * Version: 0.1.0
 *
 * Converts ABC notation to MIDI using midi-writer-js.
 * Uses our custom ABC parser for full control over the conversion.
 *
 * Bitwig MIDI Convention: C3 = Middle C = MIDI note 60
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const MidiWriter = require('midi-writer-js');
import * as fs from 'fs';
import * as path from 'path';
import { parseAbcFile, parseAbcContent, AbcParseResult, AbcVoice } from '../abc/parser';

// =============================================================================
// Types
// =============================================================================

export interface ConversionOptions {
  /** BPM (beats per minute), overrides ABC Q: field */
  bpm?: number;
  /** Output file path */
  outputPath?: string;
  /** Transpose semitones (positive = up, negative = down) */
  transpose?: number;
  /** MIDI channel (0-15, default 0) */
  channel?: number;
  /** Velocity (0-127, default 80) */
  velocity?: number;
}

export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  trackCount?: number;
  noteCount?: number;
  durationBars?: number;
}

// =============================================================================
// Note Conversion
// =============================================================================

/**
 * ABC note name to MIDI pitch mapping
 * ABC uses: C,D,E,F,G,A,B (uppercase = lower octave), c,d,e,f,g,a,b (lowercase = higher)
 * Bitwig convention: C3 = Middle C = MIDI 60
 */
const NOTE_VALUES: Record<string, number> = {
  'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
  'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
};

/**
 * Convert ABC note to MIDI note number
 * Uses Bitwig convention: C3 = MIDI 60
 *
 * ABC notation:
 * - C,D,E,F,G,A,B = octave 3 (C3-B3)
 * - c,d,e,f,g,a,b = octave 4 (C4-B4)
 * - ' raises octave, , lowers octave
 * - ^ sharp, _ flat, = natural
 */
export function abcNoteToMidi(abcNote: string, keySignature?: string): number | null {
  // Parse: [accidental][note][octave modifiers][duration]
  const match = abcNote.match(/^([_^=]?)([A-Ga-g])([',]*)/);
  if (!match) return null;

  const [, accidental, noteName, octaveMod] = match;

  const noteValue = NOTE_VALUES[noteName];
  if (noteValue === undefined) return null;

  // Determine base octave
  // Uppercase = octave 3 (C3-B3), lowercase = octave 4 (C4-B4)
  // In MIDI: octave 3 starts at 48, octave 4 starts at 60
  let octave = noteName === noteName.toUpperCase() ? 3 : 4;

  // Apply octave modifiers
  for (const mod of octaveMod) {
    if (mod === "'") octave++;
    if (mod === ",") octave--;
  }

  // Calculate MIDI note (C0 = 12 in MIDI standard)
  let midi = (octave + 1) * 12 + noteValue;

  // Apply accidentals
  if (accidental === '^') midi++;  // Sharp
  if (accidental === '_') midi--;  // Flat

  // Clamp to valid MIDI range
  return Math.max(0, Math.min(127, midi));
}

/**
 * Parse ABC duration to midi-writer-js duration string
 * ABC default length is usually 1/8
 *
 * ABC durations:
 * - No number = default length (L:1/8 means eighth note)
 * - 2 = double the default
 * - /2 or / = half the default
 * - 3/2 = 1.5x the default
 */
export function abcDurationToMidi(
  durationStr: string,
  defaultLength: string = '1/8'
): string {
  // Parse default length (e.g., "1/8" -> 0.125)
  const defaultMatch = defaultLength.match(/(\d+)\/(\d+)/);
  let defaultValue = 0.125; // 1/8 note
  if (defaultMatch) {
    defaultValue = parseInt(defaultMatch[1]) / parseInt(defaultMatch[2]);
  }

  // Parse ABC duration modifier
  let multiplier = 1;

  if (durationStr) {
    if (durationStr.includes('/')) {
      // Fractional: /2, /4, 3/2
      const fracMatch = durationStr.match(/(\d*)\/(\d+)/);
      if (fracMatch) {
        const num = fracMatch[1] ? parseInt(fracMatch[1]) : 1;
        const den = parseInt(fracMatch[2]);
        multiplier = num / den;
      } else if (durationStr === '/') {
        multiplier = 0.5;
      }
    } else {
      // Integer multiplier: 2, 3, 4
      const intMatch = durationStr.match(/(\d+)/);
      if (intMatch) {
        multiplier = parseInt(intMatch[1]);
      }
    }
  }

  // Calculate actual duration
  const actualDuration = defaultValue * multiplier;

  // Map to midi-writer-js duration strings
  // Supported: 1, 2, d2, 4, d4, 8, d8, 16, d16, 32, T8, T16, etc.
  // d = dotted (1.5x), T = triplet (2/3x)
  if (actualDuration >= 1) return '1';          // whole
  if (actualDuration >= 0.75) return 'd2';      // dotted half
  if (actualDuration >= 0.5) return '2';        // half
  if (actualDuration >= 0.375) return 'd4';     // dotted quarter
  if (actualDuration >= 0.25) return '4';       // quarter
  if (actualDuration >= 0.1875) return 'd8';    // dotted eighth
  if (actualDuration >= 0.125) return '8';      // eighth
  if (actualDuration >= 0.09375) return 'd16';  // dotted sixteenth
  if (actualDuration >= 0.0625) return '16';    // sixteenth
  if (actualDuration >= 0.03125) return '32';   // thirty-second

  return '8'; // Default to eighth note
}

/**
 * Extract notes from ABC music content
 * Returns array of { pitch, duration } objects
 */
export function extractNotesFromAbc(
  content: string,
  defaultLength: string = '1/8'
): Array<{ pitch: string; duration: string; rest: boolean }> {
  const notes: Array<{ pitch: string; duration: string; rest: boolean }> = [];

  // Remove comments, decorations, lyrics
  const cleaned = content
    .replace(/%.*$/gm, '')           // Comments
    .replace(/"[^"]*"/g, '')         // Text annotations
    .replace(/![^!]*!/g, '')         // Decorations
    .replace(/w:.*$/gm, '');         // Lyrics

  // Note pattern: [accidental][note][octave][duration]
  // Also match rests: z or Z with optional duration
  const notePattern = /([_^=]?[A-Ga-gz])([',]*)(\d*\/?[\d]*)/g;

  let match;
  while ((match = notePattern.exec(cleaned)) !== null) {
    const [, note, octaveMod, duration] = match;

    if (note.toLowerCase() === 'z') {
      // Rest
      notes.push({
        pitch: 'rest',
        duration: abcDurationToMidi(duration, defaultLength),
        rest: true
      });
    } else {
      // Note
      const fullNote = note + octaveMod;
      const midiNote = abcNoteToMidi(fullNote);

      if (midiNote !== null) {
        notes.push({
          pitch: midiNoteToPitch(midiNote),
          duration: abcDurationToMidi(duration, defaultLength),
          rest: false
        });
      }
    }
  }

  return notes;
}

/**
 * Convert MIDI note number to pitch string for midi-writer-js
 * e.g., 60 -> "C4" (midi-writer-js uses standard C4 = middle C)
 */
function midiNoteToPitch(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  return noteNames[noteIndex] + octave;
}

// =============================================================================
// Tempo Parsing
// =============================================================================

/**
 * Parse ABC tempo field (Q:) to BPM
 * Formats:
 * - Q:120 (BPM directly)
 * - Q:1/4=120 (quarter note = 120 BPM)
 * - Q:1/8=160 (eighth note = 160, so quarter = 80 BPM)
 */
export function parseAbcTempo(tempoStr?: string): number {
  if (!tempoStr) return 120; // Default BPM

  // Direct BPM: Q:120
  if (/^\d+$/.test(tempoStr)) {
    return parseInt(tempoStr);
  }

  // Note = BPM: Q:1/4=120
  const match = tempoStr.match(/(\d+)\/(\d+)\s*=\s*(\d+)/);
  if (match) {
    const noteNum = parseInt(match[1]);
    const noteDen = parseInt(match[2]);
    const bpm = parseInt(match[3]);

    // Convert to quarter note BPM
    // If 1/8=160, then 1/4=80
    const noteValue = noteNum / noteDen;
    return Math.round(bpm * noteValue / 0.25);
  }

  return 120;
}

// =============================================================================
// Main Converter
// =============================================================================

/**
 * Convert ABC file to MIDI
 */
export async function convertAbcFileToMidi(
  inputPath: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  // Parse ABC file
  const parseResult = parseAbcFile(inputPath);

  if (parseResult.error) {
    return { success: false, error: parseResult.error };
  }

  return convertAbcToMidi(parseResult, inputPath, options);
}

/**
 * Convert ABC content string to MIDI
 */
export async function convertAbcContentToMidi(
  content: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const parseResult = parseAbcContent(content);

  if (parseResult.error) {
    return { success: false, error: parseResult.error };
  }

  return convertAbcToMidi(parseResult, 'output.mid', options);
}

/**
 * Convert parsed ABC to MIDI
 */
async function convertAbcToMidi(
  parseResult: AbcParseResult,
  sourcePath: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const { metadata, voices } = parseResult;

  if (!voices || voices.length === 0) {
    return { success: false, error: 'No music content found in ABC' };
  }

  // Determine BPM
  const bpm = options.bpm || parseAbcTempo(metadata?.tempo);

  // Determine default note length
  const defaultLength = metadata?.defaultLength || '1/8';

  // Create MIDI tracks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracks: any[] = [];
  let totalNotes = 0;

  for (const voice of voices) {
    const track = new MidiWriter.Track();

    // Set track name
    track.addTrackName(voice.name || voice.id);

    // Set tempo (only on first track)
    if (tracks.length === 0) {
      track.setTempo(bpm);
    }

    // Extract and add notes
    const notes = extractNotesFromAbc(voice.content, defaultLength);

    for (const note of notes) {
      if (note.rest) {
        // Add rest (wait event)
        track.addEvent(new MidiWriter.NoteEvent({
          pitch: ['C4'],
          duration: note.duration,
          velocity: 0  // Silent note = rest
        }));
      } else {
        // Apply transpose if specified
        let pitch = note.pitch;
        if (options.transpose) {
          const midiNum = pitchToMidiNote(pitch);
          if (midiNum !== null) {
            pitch = midiNoteToPitch(midiNum + options.transpose);
          }
        }

        track.addEvent(new MidiWriter.NoteEvent({
          pitch: [pitch],
          duration: note.duration,
          velocity: options.velocity || 80,
          channel: options.channel || 1
        }));

        totalNotes++;
      }
    }

    tracks.push(track);
  }

  // Create MIDI file
  const writer = new MidiWriter.Writer(tracks);

  // Determine output path
  let outputPath = options.outputPath;
  if (!outputPath) {
    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const dir = path.dirname(sourcePath);
    outputPath = path.join(dir, baseName + '.mid');
  }

  // Write to file
  try {
    const midiData = writer.buildFile();
    fs.writeFileSync(outputPath, Buffer.from(midiData));

    return {
      success: true,
      outputPath,
      trackCount: tracks.length,
      noteCount: totalNotes,
      durationBars: parseResult.barCount
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to write MIDI file: ${err}`
    };
  }
}

/**
 * Convert pitch string back to MIDI note number
 */
function pitchToMidiNote(pitch: string): number | null {
  const match = pitch.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;

  const [, noteName, octaveStr] = match;
  const octave = parseInt(octaveStr);

  const noteValues: Record<string, number> = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };

  const noteValue = noteValues[noteName];
  if (noteValue === undefined) return null;

  return (octave + 1) * 12 + noteValue;
}

// =============================================================================
// Batch Conversion
// =============================================================================

/**
 * Convert all ABC files in a directory to MIDI
 */
export async function convertAbcDirectory(
  dirPath: string,
  options: ConversionOptions & { outputDir?: string } = {}
): Promise<{
  success: boolean;
  results: Record<string, ConversionResult>;
  totalFiles: number;
  successCount: number;
  failCount: number;
}> {
  if (!fs.existsSync(dirPath)) {
    return {
      success: false,
      results: {},
      totalFiles: 0,
      successCount: 0,
      failCount: 1
    };
  }

  const entries = fs.readdirSync(dirPath);
  const abcFiles = entries.filter(e => e.endsWith('.abc'));

  if (abcFiles.length === 0) {
    return {
      success: false,
      results: {},
      totalFiles: 0,
      successCount: 0,
      failCount: 0
    };
  }

  const results: Record<string, ConversionResult> = {};
  let successCount = 0;
  let failCount = 0;

  for (const file of abcFiles) {
    const inputPath = path.join(dirPath, file);
    const baseName = path.basename(file, '.abc');

    // Determine output path
    let outputPath: string;
    if (options.outputDir) {
      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
      }
      outputPath = path.join(options.outputDir, baseName + '.mid');
    } else {
      outputPath = path.join(dirPath, baseName + '.mid');
    }

    const result = await convertAbcFileToMidi(inputPath, {
      ...options,
      outputPath
    });

    results[file] = result;

    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  return {
    success: failCount === 0,
    results,
    totalFiles: abcFiles.length,
    successCount,
    failCount
  };
}
