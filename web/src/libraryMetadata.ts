/**
 * Library Metadata
 * Version: 0.1.0
 *
 * Curated metadata for instrument libraries.
 * Applied during filesystem scan to enrich content items.
 *
 * Based on research in INSTRUMENTS.md
 */

// =============================================================================
// Types (mirror of shared/src/types.ts for standalone use)
// =============================================================================

type BitwigNote = string;

interface MidiRange {
  low: BitwigNote;
  high: BitwigNote;
}

interface KeyswitchMapping {
  range: MidiRange;
  articulations: Record<BitwigNote, string>;
}

interface MidiSpec {
  playableRange: MidiRange;
  keyswitches?: KeyswitchMapping;
  ccMappings?: Record<number, string>;
}

type PlayingMode = 'poly' | 'mono' | 'legato';
type ModeSwitchMethod = 'keyswitch' | 'cc' | 'gui';
type StrumBehaviorType = 'manual' | 'auto-strum' | 'pattern' | 'phrase';

interface PlayingModeSpec {
  available: PlayingMode[];
  default: PlayingMode;
  switchMethod?: ModeSwitchMethod;
  switchNote?: BitwigNote;
  switchCC?: number;
}

interface StrumBehavior {
  type: StrumBehaviorType;
  description: string;
}

type GenreScores = Record<string, number>;

interface QualityRatings {
  trustworthiness: number;
  professionalism: number;
  generalAppeal: number;
}

type VibeTag =
  | 'warm' | 'cold' | 'vintage' | 'modern'
  | 'aggressive' | 'gentle' | 'ethereal' | 'gritty'
  | 'bright' | 'dark' | 'organic' | 'synthetic'
  | 'intimate' | 'epic' | 'quirky' | 'classic';

interface LibraryMetadata {
  name: string;
  vendor: string;
  plugin: string;
  quality: QualityRatings;
  vibe: VibeTag[];
  genres: GenreScores;
  midi?: MidiSpec;
  playingModes?: PlayingModeSpec;
  strumBehavior?: StrumBehavior;
  matchPatterns?: string[];
}

// Export types for use in other modules
export type {
  LibraryMetadata,
  QualityRatings,
  VibeTag,
  GenreScores,
  MidiSpec,
  PlayingModeSpec,
  StrumBehavior,
};

// =============================================================================
// Library Metadata Registry
// =============================================================================

export const LIBRARY_METADATA: LibraryMetadata[] = [
  // ---------------------------------------------------------------------------
  // M-Tron Pro IV
  // ---------------------------------------------------------------------------
  {
    name: 'M-Tron Pro IV',
    vendor: 'GForce Software',
    plugin: 'M-Tron Pro IV',
    quality: {
      trustworthiness: 95,
      professionalism: 90,
      generalAppeal: 75,
    },
    vibe: ['vintage', 'warm', 'organic', 'classic'],
    genres: {
      rock: 95,        // Iconic Mellotron sound
      ambient: 85,     // Lush string/choir pads
      experimental: 90, // Classic 60s/70s vibe
      cinematic: 80,   // Orchestral textures
      pop: 60,         // Specific use cases
      electronic: 50,  // Vintage texture element
    },
    midi: {
      playableRange: { low: 'G1', high: 'F4' }, // 35 notes, extends to 42 in extended mode
    },
    playingModes: {
      available: ['poly'],
      default: 'poly',
    },
    matchPatterns: ['M-Tron*', '*mtron*'],
  },

  // ---------------------------------------------------------------------------
  // 8DIO Misfit Series
  // ---------------------------------------------------------------------------
  {
    name: '8DIO Misfit Series',
    vendor: '8DIO',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 85,
      professionalism: 80,
      generalAppeal: 70,
    },
    vibe: ['quirky', 'organic', 'gritty', 'intimate'],
    genres: {
      folk: 95,        // Authentic imperfect instruments
      blues: 90,       // Raw, gritty character
      rock: 75,        // Indie textures
      cinematic: 75,   // Character instruments
      country: 80,     // Banjo, fiddle, etc.
      children: 85,    // Toy instruments
    },
    playingModes: {
      available: ['poly', 'mono'],
      default: 'poly',
      switchMethod: 'gui',
    },
    strumBehavior: {
      type: 'auto-strum',
      description: 'Multi-note triggers intelligent strumming and x-noises',
    },
    matchPatterns: ['*Misfit*', '*8dio*', '*8Dio*'],
  },

  // ---------------------------------------------------------------------------
  // 8DIO Songwriting Guitar
  // ---------------------------------------------------------------------------
  {
    name: '8DIO Songwriting Guitar',
    vendor: '8DIO',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 90,
      professionalism: 88,
      generalAppeal: 85,
    },
    vibe: ['warm', 'organic', 'intimate', 'classic'],
    genres: {
      folk: 95,
      pop: 85,
      rock: 80,
      country: 90,
      cinematic: 70,
    },
    midi: {
      playableRange: { low: 'E1', high: 'E5' }, // Standard guitar range
    },
    playingModes: {
      available: ['poly', 'mono', 'legato'],
      default: 'poly',
      switchMethod: 'keyswitch',
    },
    strumBehavior: {
      type: 'auto-strum',
      description: 'Chord detection with automatic strumming',
    },
    matchPatterns: ['*Songwriting Guitar*'],
  },

  // ---------------------------------------------------------------------------
  // 8DIO Mandolin
  // ---------------------------------------------------------------------------
  {
    name: '8DIO Mandolin',
    vendor: '8DIO',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 88,
      professionalism: 85,
      generalAppeal: 75,
    },
    vibe: ['bright', 'organic', 'vintage', 'intimate'],
    genres: {
      folk: 95,
      country: 90,
      bluegrass: 95,
      classical: 60,
      cinematic: 65,
    },
    midi: {
      playableRange: { low: 'G2', high: 'A5' }, // Mandolin range
    },
    playingModes: {
      available: ['poly', 'mono'],
      default: 'mono',
      switchMethod: 'keyswitch',
    },
    strumBehavior: {
      type: 'auto-strum',
      description: 'Tremolo picking and chord strumming',
    },
    matchPatterns: ['*Mandolin*'],
  },

  // ---------------------------------------------------------------------------
  // Realivox Ladies & Blue
  // ---------------------------------------------------------------------------
  {
    name: 'Realivox',
    vendor: 'Realitone',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 92,
      professionalism: 95,
      generalAppeal: 85,
    },
    vibe: ['ethereal', 'warm', 'epic', 'intimate'],
    genres: {
      cinematic: 95,   // Emotional vocal textures
      pop: 80,         // Background vocals
      electronic: 75,  // Processed vocal layers
      ambient: 85,     // Ethereal pads
      trailer: 90,     // Epic choir sound
    },
    midi: {
      playableRange: { low: 'C2', high: 'C5' }, // Vocal range
      keyswitches: {
        range: { low: 'C0', high: 'A1' },
        articulations: {
          'C0': 'Phrase 1',
          'C#0': 'Phrase 2',
          'D0': 'Phrase 3',
          'B1': 'Repeat Last',
        },
      },
    },
    playingModes: {
      available: ['poly', 'mono', 'legato'],
      default: 'legato',
      switchMethod: 'keyswitch',
    },
    strumBehavior: {
      type: 'phrase',
      description: 'Keyswitches trigger syllable phrases',
    },
    matchPatterns: ['*Realivox*', '*Ladies*', '*Blue*'],
  },

  // ---------------------------------------------------------------------------
  // MOJO 2 Horn Section
  // ---------------------------------------------------------------------------
  {
    name: 'MOJO Horn Section',
    vendor: 'Vir2',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 90,
      professionalism: 92,
      generalAppeal: 88,
    },
    vibe: ['bright', 'warm', 'classic', 'aggressive'],
    genres: {
      jazz: 95,        // Authentic horn section
      soul: 95,        // Punchy brass
      rock: 80,        // Classic horn stabs
      pop: 80,         // Horn arrangements
      latin: 85,       // Salsa brass
      hiphop: 75,      // Sample-style stabs
    },
    midi: {
      playableRange: { low: 'E1', high: 'C6' }, // Varies by instrument
      ccMappings: {
        1: 'Expression',
        11: 'Player Count',
      },
    },
    playingModes: {
      available: ['poly', 'mono', 'legato'],
      default: 'poly',
      switchMethod: 'cc',
    },
    matchPatterns: ['*MOJO*', '*Horn*Section*'],
  },

  // ---------------------------------------------------------------------------
  // Soundiron Theremin+
  // ---------------------------------------------------------------------------
  {
    name: 'Theremin+',
    vendor: 'Soundiron',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 88,
      professionalism: 85,
      generalAppeal: 50,
    },
    vibe: ['ethereal', 'dark', 'quirky', 'vintage'],
    genres: {
      cinematic: 90,     // Sci-fi/horror
      ambient: 85,       // Eerie textures
      experimental: 95,  // Unique sound design
      electronic: 70,    // Synth-like tones
    },
    midi: {
      playableRange: { low: 'C1', high: 'C6' },
      ccMappings: {
        1: 'Swell (volume antenna)',
        11: 'Vibrato amount',
        64: 'Sustain hold',
      },
    },
    playingModes: {
      available: ['mono', 'legato'],
      default: 'legato',
    },
    matchPatterns: ['*Theremin*'],
  },

  // ---------------------------------------------------------------------------
  // Spitfire Audio (Kontakt libraries)
  // ---------------------------------------------------------------------------
  {
    name: 'Spitfire Audio',
    vendor: 'Spitfire Audio',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 98,
      professionalism: 98,
      generalAppeal: 95,
    },
    vibe: ['epic', 'warm', 'classic', 'organic'],
    genres: {
      cinematic: 95,   // Industry standard
      classical: 90,   // Authentic orchestral
      trailer: 95,     // Epic sound design
      game: 90,        // Versatile orchestral
      ambient: 70,     // Textural elements
    },
    midi: {
      playableRange: { low: 'C0', high: 'C7' }, // Varies by instrument
      ccMappings: {
        1: 'Dynamics/Expression',
        32: 'UACC Articulation',
      },
    },
    playingModes: {
      available: ['poly', 'legato'],
      default: 'poly',
      switchMethod: 'keyswitch',
    },
    matchPatterns: ['*Spitfire*', '*BBCSO*', '*Albion*'],
  },

  // ---------------------------------------------------------------------------
  // Acou6tics (Acoustic Guitar)
  // ---------------------------------------------------------------------------
  {
    name: 'Acou6tics',
    vendor: 'Native Instruments',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 92,
      professionalism: 90,
      generalAppeal: 88,
    },
    vibe: ['warm', 'organic', 'intimate', 'bright'],
    genres: {
      folk: 90,
      pop: 85,
      rock: 75,
      country: 85,
      cinematic: 70,
    },
    midi: {
      playableRange: { low: 'E1', high: 'E5' },
    },
    playingModes: {
      available: ['poly', 'mono'],
      default: 'poly',
    },
    strumBehavior: {
      type: 'auto-strum',
      description: 'Pattern-based strumming engine',
    },
    matchPatterns: ['*Acou6tics*', '*Acoustic*Guitar*'],
  },

  // ---------------------------------------------------------------------------
  // RealiBanjo
  // ---------------------------------------------------------------------------
  {
    name: 'RealiBanjo',
    vendor: 'Realitone',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 90,
      professionalism: 88,
      generalAppeal: 70,
    },
    vibe: ['bright', 'organic', 'vintage', 'quirky'],
    genres: {
      country: 95,
      folk: 90,
      bluegrass: 98,
      rock: 50,
      cinematic: 60,
    },
    midi: {
      playableRange: { low: 'G2', high: 'D5' }, // Open G tuning range
    },
    playingModes: {
      available: ['poly', 'mono'],
      default: 'mono',
    },
    strumBehavior: {
      type: 'pattern',
      description: 'Clawhammer and three-finger picking patterns',
    },
    matchPatterns: ['*RealiBanjo*', '*Banjo*'],
  },

  // ---------------------------------------------------------------------------
  // WURL-e Studio (Wurlitzer)
  // ---------------------------------------------------------------------------
  {
    name: 'WURL-e Studio',
    vendor: 'Samplephonics',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 88,
      professionalism: 85,
      generalAppeal: 80,
    },
    vibe: ['warm', 'vintage', 'organic', 'intimate'],
    genres: {
      soul: 95,
      jazz: 85,
      pop: 80,
      rock: 75,
      blues: 85,
      hiphop: 70,
    },
    midi: {
      playableRange: { low: 'A0', high: 'C6' }, // Electric piano range
    },
    playingModes: {
      available: ['poly'],
      default: 'poly',
    },
    matchPatterns: ['*WURL*', '*Wurlitzer*'],
  },

  // ---------------------------------------------------------------------------
  // Pedal Steel
  // ---------------------------------------------------------------------------
  {
    name: 'Pedal Steel',
    vendor: 'Orange Tree Samples',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 90,
      professionalism: 88,
      generalAppeal: 65,
    },
    vibe: ['warm', 'organic', 'vintage', 'ethereal'],
    genres: {
      country: 98,
      folk: 80,
      ambient: 70,
      cinematic: 65,
    },
    midi: {
      playableRange: { low: 'E1', high: 'E5' },
    },
    playingModes: {
      available: ['poly', 'legato'],
      default: 'legato',
    },
    matchPatterns: ['*Pedal*Steel*'],
  },

  // ---------------------------------------------------------------------------
  // The Fiddle
  // ---------------------------------------------------------------------------
  {
    name: 'The Fiddle',
    vendor: 'Realitone',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 88,
      professionalism: 85,
      generalAppeal: 75,
    },
    vibe: ['bright', 'organic', 'vintage', 'intimate'],
    genres: {
      folk: 95,
      country: 90,
      bluegrass: 95,
      classical: 60,
      celtic: 90,
    },
    midi: {
      playableRange: { low: 'G2', high: 'E6' }, // Violin range
    },
    playingModes: {
      available: ['mono', 'legato'],
      default: 'legato',
    },
    matchPatterns: ['*Fiddle*', '*Violin*'],
  },

  // ---------------------------------------------------------------------------
  // RealiDrums
  // ---------------------------------------------------------------------------
  {
    name: 'RealiDrums',
    vendor: 'Realitone',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 90,
      professionalism: 88,
      generalAppeal: 85,
    },
    vibe: ['organic', 'warm', 'classic'],
    genres: {
      rock: 90,
      pop: 85,
      folk: 80,
      country: 85,
      jazz: 75,
    },
    midi: {
      playableRange: { low: 'C1', high: 'G3' }, // GM drum map area
    },
    playingModes: {
      available: ['poly'],
      default: 'poly',
    },
    matchPatterns: ['*RealiDrums*', '*Drums*'],
  },

  // ---------------------------------------------------------------------------
  // RealiWhistle
  // ---------------------------------------------------------------------------
  {
    name: 'RealiWhistle',
    vendor: 'Realitone',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 88,
      professionalism: 85,
      generalAppeal: 70,
    },
    vibe: ['bright', 'organic', 'intimate', 'quirky'],
    genres: {
      folk: 90,
      celtic: 95,
      cinematic: 70,
      pop: 60,
    },
    midi: {
      playableRange: { low: 'D4', high: 'D7' }, // Tin whistle range
    },
    playingModes: {
      available: ['mono', 'legato'],
      default: 'legato',
    },
    matchPatterns: ['*RealiWhistle*', '*Whistle*'],
  },

  // ---------------------------------------------------------------------------
  // The Resonator
  // ---------------------------------------------------------------------------
  {
    name: 'The Resonator',
    vendor: 'Realitone',
    plugin: 'Kontakt',
    quality: {
      trustworthiness: 88,
      professionalism: 85,
      generalAppeal: 70,
    },
    vibe: ['warm', 'gritty', 'vintage', 'organic'],
    genres: {
      blues: 95,
      folk: 85,
      country: 80,
      rock: 70,
    },
    midi: {
      playableRange: { low: 'E1', high: 'E5' },
    },
    playingModes: {
      available: ['poly', 'mono'],
      default: 'mono',
    },
    matchPatterns: ['*Resonator*', '*Dobro*'],
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find matching library metadata for a content item
 */
export function findLibraryMetadata(
  itemName: string,
  itemLibrary?: string,
  itemPlugin?: string
): LibraryMetadata | undefined {
  const searchTerms = [itemName, itemLibrary, itemPlugin]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const lib of LIBRARY_METADATA) {
    if (lib.matchPatterns) {
      for (const pattern of lib.matchPatterns) {
        const regex = new RegExp(
          pattern.replace(/\*/g, '.*').toLowerCase()
        );
        if (regex.test(searchTerms)) {
          return lib;
        }
      }
    }
  }

  return undefined;
}

/**
 * Apply library metadata to a content item
 */
export function applyLibraryMetadata<T extends { name: string; library?: string; plugin?: string }>(
  item: T,
  metadata?: LibraryMetadata
): T & {
  quality?: QualityRatings;
  vibe?: VibeTag[];
  genres?: GenreScores;
  midi?: MidiSpec;
  playingModes?: PlayingModeSpec;
  strumBehavior?: StrumBehavior;
} {
  const libMeta = metadata || findLibraryMetadata(item.name, item.library, item.plugin);

  if (!libMeta) {
    return item as any;
  }

  return {
    ...item,
    quality: libMeta.quality,
    vibe: libMeta.vibe,
    genres: libMeta.genres,
    midi: libMeta.midi,
    playingModes: libMeta.playingModes,
    strumBehavior: libMeta.strumBehavior,
  };
}

/**
 * Get all unique genres from library metadata
 */
export function getAllGenres(): string[] {
  const genres = new Set<string>();

  for (const lib of LIBRARY_METADATA) {
    if (lib.genres) {
      Object.keys(lib.genres).forEach(g => genres.add(g));
    }
  }

  return Array.from(genres).sort();
}

/**
 * Get all unique vibes from library metadata
 */
export function getAllVibes(): VibeTag[] {
  const vibes = new Set<VibeTag>();

  for (const lib of LIBRARY_METADATA) {
    if (lib.vibe) {
      lib.vibe.forEach(v => vibes.add(v));
    }
  }

  return Array.from(vibes).sort();
}
