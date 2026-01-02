/**
 * ABC Notation Parser
 * Version: 0.1.0
 *
 * Parses ABC notation files into structured data.
 * ABC is a text-based music notation format, ideal for LLM music generation.
 *
 * ABC Format Reference:
 * - X: Reference number
 * - T: Title
 * - C: Composer
 * - M: Meter (time signature) e.g., 4/4, 3/4, 6/8
 * - L: Default note length e.g., 1/8
 * - Q: Tempo e.g., 1/4=120
 * - K: Key signature e.g., C, G, Am, Bb
 * - V: Voice definition
 *
 * Bitwig MIDI Convention:
 * - C3 = Middle C (MIDI note 60)
 * - Range: C-2 to G8
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

export interface AbcMetadata {
  referenceNumber?: number;
  title?: string;
  composer?: string;
  meter?: string;
  defaultLength?: string;
  tempo?: string;
  key?: string;
}

export interface AbcVoice {
  id: string;
  name?: string;
  clef?: string;
  content: string;
  barCount: number;
}

export interface AbcParseResult {
  metadata?: AbcMetadata;
  voices?: AbcVoice[];
  rawContent?: string;
  barCount?: number;
  error?: string;
}

// =============================================================================
// Parser Functions
// =============================================================================

/**
 * Parse an ABC file and return structured data
 */
export function parseAbcFile(filePath: string): AbcParseResult {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: `File not found: ${filePath}` };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return parseAbcContent(content);
  } catch (err) {
    return { error: `Failed to read file: ${err}` };
  }
}

/**
 * Parse ABC content string
 */
export function parseAbcContent(content: string): AbcParseResult {
  const lines = content.split('\n');
  const metadata: AbcMetadata = {};
  const voices: AbcVoice[] = [];
  let currentVoice: AbcVoice | null = null;
  let globalContent = '';
  let inHeader = true;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('%')) {
      continue;
    }

    // Parse header fields
    if (trimmed.match(/^[A-Z]:/)) {
      const field = trimmed[0];
      const value = trimmed.slice(2).trim();

      switch (field) {
        case 'X':
          metadata.referenceNumber = parseInt(value);
          break;
        case 'T':
          metadata.title = value;
          break;
        case 'C':
          metadata.composer = value;
          break;
        case 'M':
          metadata.meter = value;
          break;
        case 'L':
          metadata.defaultLength = value;
          break;
        case 'Q':
          metadata.tempo = value;
          break;
        case 'K':
          metadata.key = value;
          inHeader = false; // K: marks end of header
          break;
        case 'V':
          // Voice definition: V:id name="Name" clef=treble
          const voiceMatch = trimmed.match(/^V:\s*(\S+)(?:\s+name="([^"]*)")?(?:\s+clef=(\S+))?/);
          if (voiceMatch) {
            if (currentVoice) {
              currentVoice.barCount = countBars(currentVoice.content);
              voices.push(currentVoice);
            }
            currentVoice = {
              id: voiceMatch[1],
              name: voiceMatch[2],
              clef: voiceMatch[3],
              content: '',
              barCount: 0
            };
          }
          break;
      }
    } else if (!inHeader) {
      // Music content
      if (currentVoice) {
        currentVoice.content += trimmed + '\n';
      } else {
        globalContent += trimmed + '\n';
      }
    }
  }

  // Finalize last voice
  if (currentVoice) {
    currentVoice.barCount = countBars(currentVoice.content);
    voices.push(currentVoice);
  }

  // If no voices defined, treat all content as single voice
  if (voices.length === 0 && globalContent.trim()) {
    voices.push({
      id: 'default',
      content: globalContent,
      barCount: countBars(globalContent)
    });
  }

  // Calculate total bar count (should be same for all voices)
  const barCount = voices.length > 0 ? voices[0].barCount : countBars(globalContent);

  return {
    metadata,
    voices,
    rawContent: content,
    barCount
  };
}

/**
 * Count the number of bars in ABC content
 * Bars are separated by | or |] or || or :|
 */
export function countBars(content: string): number {
  // Remove annotations, decorations, and comments
  const cleaned = content
    .replace(/"[^"]*"/g, '') // Remove text annotations
    .replace(/![^!]*!/g, '') // Remove decorations
    .replace(/%.*$/gm, '');  // Remove comments

  // Count bar lines
  // | = regular bar
  // |] = end bar
  // || = double bar
  // :| = repeat end
  // |: = repeat start
  // |1 |2 = volta
  const barMatches = cleaned.match(/\|[\]|:]?|\|[12]/g);

  return barMatches ? barMatches.length : 0;
}

/**
 * Extract notes from ABC content
 * Returns array of note names in ABC notation
 */
export function extractNotes(content: string): string[] {
  const notes: string[] = [];

  // ABC note pattern:
  // [^_=]? - accidental (^ sharp, _ flat, = natural)
  // [A-Ga-g] - note name (uppercase = lower octave, lowercase = higher)
  // [',]* - octave modifiers (' up, , down)
  // [0-9/]* - duration
  const notePattern = /[_^=]?[A-Ga-g][',]*[0-9/]*/g;

  const matches = content.match(notePattern);
  if (matches) {
    notes.push(...matches);
  }

  return notes;
}

/**
 * Convert ABC note to MIDI note number (Bitwig convention: C3 = 60)
 */
export function abcNoteToMidi(abcNote: string): number | null {
  // Parse the ABC note
  const match = abcNote.match(/^([_^=]?)([A-Ga-g])([',]*)/);
  if (!match) return null;

  const [, accidental, noteName, octaveMod] = match;

  // Base MIDI values for notes (C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, B = 11)
  const noteValues: Record<string, number> = {
    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
    'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11
  };

  const noteValue = noteValues[noteName];
  if (noteValue === undefined) return null;

  // Determine octave
  // In ABC: C-B is octave below middle C, c-b is middle C octave
  // Bitwig: C3 = middle C = MIDI 60
  let octave = noteName === noteName.toUpperCase() ? 3 : 4;

  // Apply octave modifiers
  for (const mod of octaveMod) {
    if (mod === "'") octave++;
    if (mod === ",") octave--;
  }

  // Calculate MIDI note
  let midi = (octave + 1) * 12 + noteValue;

  // Apply accidentals
  if (accidental === '^') midi++; // Sharp
  if (accidental === '_') midi--; // Flat

  return midi;
}

/**
 * Convert MIDI note number to ABC notation (Bitwig convention)
 */
export function midiToAbcNote(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  const noteName = noteNames[noteIndex];

  // Determine case and octave modifiers
  // Bitwig C3 = MIDI 60 = ABC c (lowercase, no modifier)
  let abcNote = '';
  let abcOctave = '';

  if (octave <= 3) {
    // Use uppercase
    abcNote = noteName[0].toUpperCase();
    if (noteName.length > 1) abcNote = '^' + abcNote; // Sharp as accidental
    // Add commas for lower octaves
    for (let i = 3; i > octave; i--) {
      abcOctave += ',';
    }
  } else {
    // Use lowercase
    abcNote = noteName[0].toLowerCase();
    if (noteName.length > 1) abcNote = '^' + abcNote; // Sharp as accidental
    // Add apostrophes for higher octaves
    for (let i = 4; i < octave; i++) {
      abcOctave += "'";
    }
  }

  return abcNote + abcOctave;
}
