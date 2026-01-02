/**
 * Shared types for Jeannie Bitwig Controller
 * Version: 0.2.0
 */

// =============================================================================
// MIDI Types
// =============================================================================

/**
 * Bitwig uses C3 = Middle C (MIDI note 60)
 * Note names follow Bitwig convention: C-2 to G8
 */
export type BitwigNote = string; // e.g., 'C3', 'D#4', 'Bb2'

export interface MidiRange {
  low: BitwigNote;
  high: BitwigNote;
}

export interface KeyswitchMapping {
  range: MidiRange;
  articulations: Record<BitwigNote, string>; // e.g., { 'C0': 'Sustain', 'D0': 'Staccato' }
}

export interface MidiSpec {
  playableRange: MidiRange;
  keyswitches?: KeyswitchMapping;
  ccMappings?: Record<number, string>; // e.g., { 1: 'Expression', 11: 'Vibrato' }
}

// =============================================================================
// Playing Modes
// =============================================================================

export type PlayingMode = 'poly' | 'mono' | 'legato';
export type ModeSwitchMethod = 'keyswitch' | 'cc' | 'gui';
export type StrumBehaviorType = 'manual' | 'auto-strum' | 'pattern' | 'phrase';

export interface PlayingModeSpec {
  available: PlayingMode[];
  default: PlayingMode;
  switchMethod?: ModeSwitchMethod;
  switchNote?: BitwigNote;
  switchCC?: number;
}

export interface StrumBehavior {
  type: StrumBehaviorType;
  description: string;
}

// =============================================================================
// Genre & Quality Ratings
// =============================================================================

/**
 * Genre suitability scores: 0-100
 * Only include genres with score > 0
 */
export type GenreScores = Record<string, number>;

/**
 * Standard genre taxonomy for Jeannie
 */
export const GENRE_TAXONOMY = [
  'cinematic',
  'jazz',
  'rock',
  'pop',
  'electronic',
  'classical',
  'ambient',
  'folk',
  'blues',
  'country',
  'soul',
  'hiphop',
  'latin',
  'world',
  'experimental',
  'trailer',
  'game',
  'children'
] as const;

export type Genre = typeof GENRE_TAXONOMY[number];

export interface QualityRatings {
  trustworthiness: number;  // 0-100: Sample reliability, no glitches
  professionalism: number;  // 0-100: Production quality
  generalAppeal: number;    // 0-100: Broad usability
}

export type VibeTag =
  | 'warm' | 'cold' | 'vintage' | 'modern'
  | 'aggressive' | 'gentle' | 'ethereal' | 'gritty'
  | 'bright' | 'dark' | 'organic' | 'synthetic'
  | 'intimate' | 'epic' | 'quirky' | 'classic';

// =============================================================================
// Content Items
// =============================================================================

/**
 * Base content item (compatible with existing scanner)
 */
export interface ContentItem {
  index: number;
  contentType: 'Device' | 'Preset';
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

/**
 * Enhanced content item with full metadata
 */
export interface EnhancedContentItem extends ContentItem {
  // Quality ratings
  quality?: QualityRatings;

  // Character/vibe tags
  vibe?: VibeTag[];

  // Genre suitability (0-100, omit if 0)
  genres?: GenreScores;

  // MIDI specification
  midi?: MidiSpec;

  // Playing mode specification
  playingModes?: PlayingModeSpec;

  // Strum/pattern behavior
  strumBehavior?: StrumBehavior;
}

/**
 * Library-level metadata (applied to all items from a library)
 */
export interface LibraryMetadata {
  name: string;
  vendor: string;
  plugin: string;

  // Default quality (can be overridden per-item)
  quality: QualityRatings;

  // Default vibe
  vibe: VibeTag[];

  // Genre suitability
  genres: GenreScores;

  // Default MIDI spec (can be overridden per-item)
  midi?: MidiSpec;

  // Default playing modes
  playingModes?: PlayingModeSpec;

  // Strum behavior
  strumBehavior?: StrumBehavior;

  // Pattern matching for items
  matchPatterns?: string[];
}

// =============================================================================
// Content Index
// =============================================================================

export interface ContentIndex {
  version: string;
  scanDate: string;
  bitwigVersion: string;
  scanDurationMs: number;
  contentTypes: string[];
  totals: {
    total: number;
    [key: string]: number;
  };
  content: EnhancedContentItem[];
  stats: {
    byContentType: Record<string, number>;
    byGenre?: Record<string, number>;
    byVibe?: Record<string, number>;
    [key: string]: any;
  };
}

// =============================================================================
// Existing Types (unchanged)
// =============================================================================

export interface JeannieConfig {
  version: string;
  roger?: RogerInfo;
  controller?: ControllerConfig;
  lastUpdated: string;
}

export interface RogerInfo {
  name: string;
  version: string;
  timestamp: string;
}

export interface ControllerConfig {
  name: string;
  enabled: boolean;
  settings?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  uptime: number;
  configFile: string;
  configLoaded: boolean;
}

export interface RogerCommand {
  action: string;
  payload?: Record<string, unknown>;
}
