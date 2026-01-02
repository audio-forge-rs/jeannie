# Jeannie Instrument Knowledge Base

## MIDI Note Conventions

### Bitwig Studio Octave Offset

**CRITICAL: Bitwig uses C3 = Middle C (MIDI note 60)**

This is different from some other standards:
- **Bitwig Studio**: C3 = Middle C (262 Hz, MIDI note 60)
- **Yamaha/Roland (varies)**: C3 or C4 = Middle C
- **International Scientific Pitch**: C4 = Middle C
- **FL Studio**: Middle C shown as C5

**Practical Impact**:
- When FL Studio exports a MIDI file with C4, Bitwig imports it as C2
- Bitwig's lowest note is C-2 (MIDI note 0)
- Bitwig's range: C-2 to G8

**Conversion Formula**:
```
Bitwig Note = Standard MIDI Note Name - 1 octave (typically)
Example: "Standard" C4 → Bitwig C3
```

### Kontakt Keyboard Color Convention

- **Blue keys**: Playable zones (instrument range)
- **Red keys**: Keyswitches (articulation/preset control)
- **Green keys**: Custom/user keyswitches
- **Yellow/Teal**: Library-specific (often keyswitches or extended range)

**No Standard Keyswitch Mapping**: Each library defines its own keyswitch locations.
Common patterns:
- C-2 to B-1 (very low)
- C0 to B0
- C1 to B1
- Keys outside playable range

---

## Instrument Library Details

### GForce M-Tron Pro IV

**Type**: Mellotron Emulation (Tape-based keyboard)
**Plugin**: VST3/AU/AAX
**Requires**: Standalone or DAW

**Keyboard Layout**:
- 35 individually sampled notes (standard)
- +7 semitones in extended keyboard mode (42 notes total)
- Dual-layer and split-keyboard operation supported

**MIDI Features**:
- MIDI Learn for all parameters
- Deep polyphonic aftertouch support
- Velocity controls
- CC automation via MIDI CC Button interface
- Layer A (Red), Layer B (Green) assignable

**Tape Collections Installed**:
- ChamberTron
- OptiTron
- The Streetly Tapes M300
- Alex Ball Artist Expansion
- And more (3,814 patches total)

**Genre Suitability**:
| Genre | Score | Notes |
|-------|-------|-------|
| Progressive Rock | 95 | Iconic Mellotron sound |
| Ambient | 85 | Lush string/choir pads |
| Psychedelic | 90 | Classic 60s/70s vibe |
| Cinematic | 80 | Orchestral textures |
| Pop | 60 | Specific use cases |
| Electronic | 50 | Vintage texture element |

**Sources**:
- [GForce M-Tron Pro IV](https://www.gforcesoftware.com/products/m-tron-pro-iv/)
- [Sound on Sound Review](https://www.soundonsound.com/reviews/gforce-m-tron-pro-iv)

---

### Native Instruments Kontakt 8

**Type**: Sampler Platform
**Plugin**: VST3/AU/AAX/Standalone
**Requires**: Full version for most third-party libraries

**Installed Versions**: Kontakt 8, Kontakt 7

**Keyswitch Display**:
- Enable: Options > "Show mapping and keyswitches on keyboard"
- Blue = playable zones
- Red = keyswitches

**MIDI Learn**:
1. Right-click any knob/slider
2. Select "Learn MIDI CC# Automation"
3. Move hardware controller
4. Multiple CCs can map to same control

**UACC Switching** (Universal Articulation CC):
- CC32 is default for articulation switching
- Alternative to keyswitches
- Customizable via right-click > Learn MIDI CC#

**Player vs Full Detection**:
- `.nicnt` file present = Player Library (works in free Kontakt Player)
- No `.nicnt` file = Full Library (requires purchased Kontakt)

**Sources**:
- [Kontakt 8 Manual (PDF)](https://www.native-instruments.com/fileadmin/ni_media/downloads/manuals/KONTAKT_5_6_8_Manual_English.pdf)
- [KSP Reference Manual](https://www.native-instruments.com/fileadmin/ni_media/downloads/manuals/kontakt/Kontakt_8_KSP_Reference_Manual-en_260924.pdf)

---

### 8DIO Libraries (Kontakt)

**Installed Libraries**:
- 8DIO Songwriting Guitar v2
- 8Dio Misfit Synths v1
- 8Dio Misfit Toy Instruments
- 8Dio Misfit Toys n' Baby
- 8Dio Postapocalyptic Guitar
- 8Dio Mandolin / Mandolin Strummer
- 8Dio Misfit Piano Toy
- Misfit 1 & 3 Stringed Diddley Bow
- Misfit Banjo, Bicycle, Bucket Bass
- Misfit Concertina, Fiddle, Harmonica
- Misfit Jawharp, Stompbox, Trombone
- Misfit Trumpet, Washboard, Whistling

**Common 8DIO Features**:
- **Intelligent Strum Detection**: Multi-note triggers strumming effects
- **True Legato & Glissando**: Realistic transitions
- **Chaos FX System**: Dual delay, convolution reverb, arpeggiator
- **Microphone Positions**: Close, Mid, Room

**Keyswitch Pattern** (varies by library):
- Each library has own manual in download folder
- Red keys in Kontakt indicate keyswitches
- Some use "brake" keyswitches to stop sounds

**Genre Suitability** (Misfit Series):
| Genre | Score | Notes |
|-------|-------|-------|
| Americana/Folk | 95 | Authentic imperfect instruments |
| Blues | 90 | Raw, gritty character |
| Indie | 85 | Unique textures |
| Cinematic | 75 | Character instruments |
| Country | 80 | Banjo, fiddle, etc. |
| Children's Music | 85 | Toy instruments |

**Sources**:
- [8DIO Misfit Collection](https://8dio.com/collections/misfits)
- [8DIO FAQs](https://8dio.com/a/faqs)

---

### Realivox Ladies & Blue (Kontakt)

**Type**: Virtual Vocalist
**Plugin**: Kontakt instrument
**Requires**: Full Kontakt

**Keyboard Layout**:
- **Yellow keys (C0-A1)**: Keyswitches for articulations/phrases
- **B1**: Repeats last note
- **Blue keys**: Natural vocal range
- **Teal keys**: Stretched samples beyond normal range

**Articulation System**:
- Up to 8 syllables per phrase
- Vowels: Ah, Eh, Ee, Oh, Oo
- Ending consonants: f, k, m, r, s, sh
- Neighbor borrowing for sample variation

**Legato Modes** (switchable via keyswitch or CC):
- **Vowel Mode**: Sustains vowel on overlapping notes
- **Phrase Mode**: Plays through syllables
- **Poly Mode**: Legato on immediate note release

**MIDI CC Assignments**:
- Freely assignable CC# for legato mode switching
- Timber control (bright/dark)
- Additional articulation parameters

**Genre Suitability**:
| Genre | Score | Notes |
|-------|-------|-------|
| Cinematic | 95 | Emotional vocal textures |
| Pop | 80 | Background vocals |
| Electronic | 75 | Processed vocal layers |
| Ambient | 85 | Ethereal pads |
| Trailer Music | 90 | Epic choir sound |

**Sources**:
- [Realivox Ladies Manual (PDF)](https://realitone.net/realitone/uploads/pdf/RealivoxManual.pdf)
- [Realitone Downloads](https://realitone.com/pages/downloads)

---

### Spitfire Audio (Kontakt Libraries)

**Note**: LABS uses dedicated Spitfire plugin, NOT Kontakt.

**Installed**: Spitfire (directory on external drive - likely various Kontakt libraries)

**Articulation Switching Methods**:

1. **Traditional Keyswitches**:
   - Red keys on Kontakt keyboard = keyswitches
   - Blue keys = playable range
   - First keyswitch shown "held down" = current articulation

2. **UACC (CC32) Switching**:
   - CC32 default for articulation changes
   - Customizable via right-click > Learn MIDI CC#

3. **Custom Keyswitches**:
   - Use Articulation Locking menu to disable built-in
   - Custom keyswitches appear in green

4. **Shared Keyswitch Mode**:
   - For multi-palette integration
   - Multiple patches on same MIDI channel

**Typical Articulations** (orchestral):
- Sustains (Long)
- Staccato (Short)
- Spiccato
- Tremolo
- Pizzicato
- Legato
- Marcato
- Trills

**Genre Suitability**:
| Genre | Score | Notes |
|-------|-------|-------|
| Cinematic/Film | 95 | Industry standard |
| Classical | 90 | Authentic orchestral |
| Trailer | 95 | Epic sound design |
| Game Music | 90 | Versatile orchestral |
| Ambient | 70 | Textural elements |

**Sources**:
- [Spitfire Articulation Switching](https://support.spitfireaudio.com/en/articles/11816120-switching-articulations-in-spitfire-libraries)
- [Finding Keyswitches](https://spitfireaudio.zendesk.com/hc/en-us/articles/360033899153-Finding-and-moving-the-default-Key-Switches)

---

### MOJO 2: Horn Section (Vir2/Kontakt)

**Type**: Brass/Woodwind Section
**Plugin**: Kontakt instrument
**Requires**: Full Kontakt

**Core Instruments** (12):
Trumpet, Trombone, Trumpet Muted, Trombone Muted, Piccolo Trumpet, Bass Trombone, Soprano Sax, Alto Sax, Tenor Sax, Bari Sax, Clarinet, Flugelhorn

**Articulations** (13 per instrument):
- Sustains
- Staccato
- Stabs
- Bend Down
- Octave Run Down & Up
- Doits
- Rise To Hit
- Shakes
- Trills
- Swells
- Crescendos
- Falls

**Layers**: Up to 4 velocity layers, 3 round robins

**Keyswitch System**:
- Outside instrument's playable range
- Customizable via MIDI Learn button
- Release articulations also via keyswitch
- **Requires 88-key controller for full access**

**MIDI Control**:
- Player count (1-10)
- Mode: Polyphonic, Monophonic, Legato
- Remote CC control over virtually all parameters

**Genre Suitability**:
| Genre | Score | Notes |
|-------|-------|-------|
| Jazz | 95 | Authentic horn section |
| Funk | 95 | Punchy brass |
| Soul/R&B | 90 | Classic horn stabs |
| Pop | 80 | Horn arrangements |
| Big Band | 95 | Full section writing |
| Latin | 85 | Salsa brass |

**Sources**:
- [MOJO Horn Section](https://www.vir2.com/instruments/mojo-horn-section/)
- [MOJO 2 Horn Section](https://www.vir2.com/instruments/mojo-2-horn-section/)
- [MOJO Manual (PDF)](https://www3.vir2.com/support/downloads/MOJOManual.pdf)

---

### Soundiron Theremin+

**Type**: Theremin Emulation
**Plugin**: Kontakt instrument
**Requires**: Full Kontakt

**MIDI CC Assignments**:
| CC | Function |
|----|----------|
| CC1 (Mod Wheel) | Swell (volume antenna) |
| CC11 (Expression) | Vibrato amount |
| CC64 (Sustain) | Hold note |
| Pitch Wheel | +/- 24 semitones (2 octaves) |

**Features**:
- Bank preset loading with optional keyswitching
- Adaptive arpeggiation
- Built-in convolution reverb
- Attack, edge, release controls
- Filter resonance and cut
- Sublayer selection with separate volume/pitch

**Custom MIDI Learning**:
- Right-click (or Command-click on macOS)
- Select "Learn MIDI CC# Automation"
- Move hardware control

**Genre Suitability**:
| Genre | Score | Notes |
|-------|-------|-------|
| Sci-Fi/Horror | 95 | Classic theremin sound |
| Ambient | 85 | Eerie textures |
| Experimental | 90 | Unique sound design |
| Film Score | 80 | Specific use cases |

**Sources**:
- [Soundiron Theremin+](https://soundiron.com/products/theremin)
- [User Guide (PDF)](https://www.fullcompass.com/common/files/87091-ThereminUserGuide.pdf)

---

### Other Installed Kontakt Libraries

**Acou6tics** - Acoustic guitar/instrument library
**Pedal Steel** - Pedal steel guitar
**RealiBanjo** - Realistic banjo
**RealiDrums** - Drum kit
**RealiWhistle** - Whistle instrument
**The Fiddle** - Solo fiddle
**The Mandolin** - Solo mandolin
**The Resonator** - Resonator guitar
**SONGBIRD VIRTUOSO** - Bird-like instrument sounds
**WURL-e Studio** - Wurlitzer electric piano

---

## Enhanced Metadata System Plan

### Current Content Index Structure

```typescript
interface ContentItem {
  index: number;
  contentType: 'Device' | 'Preset';
  name: string;
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
}
```

---

## Instrument Playing Modes

### Polyphony Modes

Many instruments have different behaviors based on how notes are played:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Poly (Polyphonic)** | Multiple notes simultaneously | Chords, pads, harmonies |
| **Mono (Monophonic)** | Single note at a time, new note cuts previous | Leads, bass lines, solo instruments |
| **Legato** | Single note with smooth transitions | Expressive melodies, realistic solos |

**Important**: Some instruments sound significantly better in Mono/Legato mode when playing melodies. Set correctly before sending MIDI.

### Strum/Pattern Instruments

Some instruments handle their own rhythmic patterns:

| Instrument Type | Behavior | How to Use |
|-----------------|----------|------------|
| **Strummers** (8DIO guitars) | Auto-strum on chord input | Send sustained chords, instrument handles strum pattern |
| **Arpeggiators** | Generate patterns from held notes | Hold notes/chords, instrument creates arp |
| **Phrase Players** (Realivox) | Play through syllables/phrases | Trigger with keyswitches, holds play phrase |

**8DIO Intelligent Strum Detection**: When multiple notes are played simultaneously, strumming effects and x-noises are automatically added.

### Mode Switching

Modes are typically controlled via:
- **Keyswitches**: Specific notes trigger mode change
- **MIDI CC**: CC messages select mode
- **GUI Control**: Click mode button in plugin interface

**MOJO Horn Section Modes**:
- Player count (1-10 players)
- Polyphonic / Monophonic / Legato via first two knobs
- All controllable via MIDI CC

**Realivox Legato Modes** (keyswitch or CC controllable):
- **Vowel Mode**: Sustain vowel on overlapping notes
- **Phrase Mode**: Play through syllables
- **Poly Mode**: Legato on immediate release

---

### Proposed Enhanced Metadata

```typescript
interface EnhancedContentItem extends ContentItem {
  // Quality/Character Ratings (0-100)
  trustworthiness: number;      // Reliability of samples
  professionalism: number;      // Production quality
  generalAppeal: number;        // Broad usability

  // Character/Vibe Tags
  vibe: string[];               // ['warm', 'vintage', 'aggressive', 'ethereal']

  // Genre Suitability (0-100, omit if 0)
  genres: {
    [genre: string]: number;    // { 'jazz': 95, 'rock': 60 }
  };

  // MIDI Specification
  midi: {
    playableRange: {
      low: string;              // 'C1' (Bitwig notation)
      high: string;             // 'C6'
    };
    keyswitches?: {
      range: { low: string; high: string; };
      articulations: {
        [note: string]: string; // { 'C0': 'Sustain', 'D0': 'Staccato' }
      };
    };
    ccMappings?: {
      [cc: number]: string;     // { 1: 'Expression', 11: 'Vibrato' }
    };
  };

  // Playing Mode Specification
  playingModes: {
    available: ('poly' | 'mono' | 'legato')[];
    default: 'poly' | 'mono' | 'legato';
    switchMethod?: 'keyswitch' | 'cc' | 'gui';
    switchNote?: string;        // If keyswitch, which note
    switchCC?: number;          // If CC, which CC number
  };

  // Strum/Pattern Behavior
  strumBehavior?: {
    type: 'manual' | 'auto-strum' | 'pattern' | 'phrase';
    description: string;        // 'Send sustained chords, handles strum'
  };

  // Preset Information
  presets?: {
    name: string;
    category?: string;
    tags?: string[];
  }[];
}
```

### Genre Taxonomy

**Primary Genres**:
- Cinematic/Film
- Jazz
- Rock
- Pop
- Electronic
- Classical
- Ambient
- Folk/Americana
- Blues
- Country
- R&B/Soul
- Hip-Hop
- Latin
- World
- Experimental
- Trailer/Epic
- Game Music
- Children's

### Controller Track Creation Plan

**Future Implementation** (do not implement yet):

1. **Track Creation API**:
   ```typescript
   interface CreateTrackRequest {
     name: string;
     instrument: {
       plugin: string;      // 'Kontakt 8'
       preset?: string;     // 'Misfit Banjo'
       library?: string;
     };
     midiChannel?: number;
   }
   ```

2. **MIDI Note Validation**:
   - Validate notes against instrument's playable range
   - Warn if sending to keyswitch range
   - Auto-transpose out-of-range notes

3. **Bitwig API Requirements**:
   - `cursorTrack.createInstrumentTrack()`
   - `device.browseToInsertDevice()`
   - `noteInput.sendNote()`

4. **Workflow**:
   ```
   User: "Add a banjo track"
   Jeannie:
     1. Search content for "banjo"
     2. Find Misfit Banjo (Kontakt)
     3. Create instrument track named "Banjo"
     4. Insert Kontakt 8
     5. Load Misfit Banjo preset
     6. Configure MIDI range: C1-C5
     7. Store keyswitch range: C0-B0
   ```

---

## Document URLs & References

### Official Manuals

| Library | URL |
|---------|-----|
| Kontakt 8 Manual | https://www.native-instruments.com/fileadmin/ni_media/downloads/manuals/KONTAKT_5_6_8_Manual_English.pdf |
| Kontakt KSP Reference | https://www.native-instruments.com/fileadmin/ni_media/downloads/manuals/kontakt/Kontakt_8_KSP_Reference_Manual-en_260924.pdf |
| MOJO Manual | https://www3.vir2.com/support/downloads/MOJOManual.pdf |
| Theremin+ Guide | https://www.fullcompass.com/common/files/87091-ThereminUserGuide.pdf |

### Product Pages

| Library | URL |
|---------|-----|
| M-Tron Pro IV | https://www.gforcesoftware.com/products/m-tron-pro-iv/ |
| 8DIO Misfits | https://8dio.com/collections/misfits |
| Spitfire Support | https://support.spitfireaudio.com/ |
| Realitone Downloads | https://realitone.com/pages/downloads |
| Soundiron Theremin+ | https://soundiron.com/products/theremin |

---

## Version History

- **2026-01-02**: Initial creation with research on installed libraries
- Bitwig MIDI octave convention documented
- Genre suitability scores added
- Enhanced metadata system planned

---

**Last Updated**: 2026-01-02
**Maintainer**: Audio Forge RS / Jeannie Project
