/**
 * Jeannie Compose
 * Version: 0.1.0
 *
 * ABC notation to MIDI to Bitwig composition pipeline.
 *
 * This is the single entrypoint for music composition in Jeannie.
 * Use the CLI (jeannie-compose) or import these modules directly.
 */

export * from './abc';
export * from './midi';

// Re-export key types for convenience
export {
  AbcMetadata,
  AbcVoice,
  AbcParseResult,
  parseAbcFile,
  parseAbcContent,
  abcNoteToMidi,
  midiToAbcNote
} from './abc/parser';

export {
  ValidationOptions,
  ValidationResult,
  validateAbcFile,
  validateAbcContent,
  validateAbcDirectory
} from './abc/validator';

export {
  MidiNote,
  MidiTrack,
  MidiFile,
  MidiValidationResult,
  abcToMidi,
  validateMidiData
} from './midi';
