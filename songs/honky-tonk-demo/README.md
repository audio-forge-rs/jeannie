# Honky Tonk Demo

## How This Song Was Made

This song was composed entirely through conversation with an AI agent (Claude) using the Jeannie framework. No DAW was opened until the final step of loading the generated content.

### The Prompt

> "Create a world-class honky tonk song. Make it dynamite."

### What the AI Did

1. **Chose the key and tempo**: G major at 120 BPM - classic honky tonk territory
2. **Designed the song structure**: 32 bars with intro (4) → verse (12) → chorus (8) → outro (8)
3. **Selected instrumentation** by searching the user's sample library:
   - Piano (stride/boogie pattern)
   - Upright bass (walking root-fifth)
   - Acoustic guitar (boom-chick rhythm)
   - Pedal steel (crying fills)
   - Hammond organ (gospel pads)
   - Drums (kick, snare, hi-hat as separate tracks)

4. **Wrote the music** in ABC notation - a text-based format the AI can generate and reason about
5. **Converted to MIDI** using the jeannie CLI
6. **Loaded into Bitwig** via API calls to the Jeannie controller
7. **Searched for and assigned specific instruments** from Kontakt and M-Tron libraries

### The Instruments

The AI searched the content database and selected these specific presets:

| Track | Preset | Plugin | Why |
|-------|--------|--------|-----|
| piano | Another Joanna | M-Tron Pro IV | Vintage mellotron character |
| bass | Bass | Kontakt (Spitfire Solo Strings) | Warm upright tone |
| guitar | Picked Acoustic | Kontakt (Session Guitarist) | Authentic country picking |
| steel_guitar | Pedal Steel | Kontakt | Essential honky tonk weep |
| organ | Hammond C3 Clean Basic | M-Tron Pro IV | Gospel B3 swells |
| kick | Bass Drum | Kontakt (Spitfire Percussion) | Deep thump |
| snare | Chad kit (Snare 1) | Kontakt (Spitfire The Grange) | Tight crack |
| hihat | Andy - Hihat brush | Kontakt (Spitfire The Grange) | Shuffle feel |

### The Music Itself

Each `.abc` file contains human-readable music notation:

```abc
X:1
T:Honky Tonk Piano
M:4/4
L:1/16
K:G
Q:1/4=120
|: G,2B,2 D2G2 B2d2 g2f2 | ...
```

The AI wrote:
- **Piano**: Left-hand stride with right-hand fills (226 notes)
- **Bass**: Root-fifth walking pattern with chromatic approaches (123 notes)
- **Guitar**: Boom-chick alternating bass/chord (245 notes)
- **Steel Guitar**: Melodic fills in the gaps, bends implied (94 notes)
- **Organ**: Sustained pad chords, whole-bar holds (96 notes)
- **Drums**: Classic two-step - kick on 1&3, snare on 2&4, hi-hat 8ths

### What a Human Still Does

1. **Load presets** - The plugins are inserted but presets must be loaded manually
2. **Drag clips to arranger** - MIDI is in clip launcher, needs arranging
3. **Mix** - Levels, panning, EQ, compression, reverb
4. **Polish** - Adjust velocities, add expression, humanize timing
5. **Judge** - Does it groove? Does it feel right?

### The Philosophy

This isn't about replacing musicians. It's about:

- **Rapid prototyping** - Get an arrangement down in minutes, not hours
- **Exploration** - Try genres, keys, tempos without the friction
- **Collaboration** - AI as a bandmate who knows every style
- **Accessibility** - Music creation for those who hear it but can't play it

The AI doesn't know if this song is good. It knows the theory, the conventions, the patterns. Whether it *moves* you - that's still your call.

### Files

```
honky-tonk-demo/
├── song.yaml           # Metadata (tempo, key, structure)
├── piano.abc           # ABC notation source
├── bass.abc
├── guitar.abc
├── steel_guitar.abc
├── organ.abc
├── kick.abc
├── snare.abc
├── hihat.abc
└── midi/               # Generated MIDI files
    ├── piano.mid
    ├── bass.mid
    └── ...
```

### Reproducing This

```bash
# Validate the ABC files
jeannie validate ./songs/honky-tonk-demo/

# Convert to MIDI
jeannie convert ./songs/honky-tonk-demo/

# Load into Bitwig (creates tracks, loads clips)
jeannie load ./songs/honky-tonk-demo/midi/

# Add instruments to each track
jeannie track device "Another Joanna" piano
jeannie track device "Pedal Steel" steel_guitar
# ... etc
```

---

*"The goal of art is not to make something perfect. It's to make something true."*

This song is a conversation between human intent and machine capability. The truth is in what you do with it next.
