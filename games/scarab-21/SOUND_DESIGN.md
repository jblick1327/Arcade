# Scarab 21 sound design

Scarab's sound should feel like ivory cards on green felt, with a restrained
golden score flourish rather than a casino slot machine. It must be comfortable
over repeated, quick keyboard placements.

## Cue hierarchy

| Event | Primary cue | Additional accent |
| --- | --- | --- |
| Normal placement | 75 ms place sample | None |
| Ordinary 21 or five-card clear | 220 ms column-clear sample | None |
| Blackjack, Large 21, 7-7-7, 6-7-8 | Same column-clear | Single short rising highlight |
| Super / Double Blackjack, Full House | Same column-clear | Two gentle ascending notes |
| Straight / 5 of a Kind board clear | 370 ms board-clear sample | None (already distinctive) |
| Deck exhausted and recycled | Keep its original physical cue | Delayed two-note bonus |
| Run ends | Keep the current physical cue | Delayed two-note descending finish |

Only one physical sample is played for each card placement. Multiple awards
may coexist (e.g. column clear + deck recycle). The event's main sample is
never doubled; bonuses are separate, delayed accents.

## Gain staging

- Samples are the original local 22.05 kHz 16-bit mono files.
- Their original lengths are roughly 75 ms (place), 220 ms (column clear)
  and 370 ms (board clear).
- Per-event sample gains are 0.43, 0.50 and 0.54 respectively. The existing
  source sample peaks are about -17.3, -17.2 and -16.0 dBFS.
- Mild random playback-rate variation (+/-2%) reduces repetitive tapping.
- Synthesized accents use low-level triangle tones (0.02–0.03 gain) and
  are delayed until after the physical attack.
- A direct 0.85-ceiling master gain plus 70% initial slider setting leaves
  sufficient digital headroom. No dynamics compressor or ducking buses.
- Web Audio buffer sources allow concurrent short one-shots without one
  clip cutting off another. While WAV decoding is pending, a quiet transient
  fallback prevents the first click from becoming silent.
- Audio is optional, off by default and locally controlled in Quick Rules;
  the effects-volume slider stays in the nested Sound settings disclosure.

## Frequency and decision rationale

In a 10,000-run random legal-placement simulation matching the rules,
about 92% of placements were ordinary placements, about 8% produced
a column or board clear, and 18.5 placements occurred per run on average.
This is not a human strategy distribution. It suggests simple taps must
remain unobtrusive and noticeable score events should be occasional
rather than triggering a fanfare every turn.

## QA checklist

1. Enable audio, place 20+ cards with clicks and the 1–5 shortcuts:
   ordinary placements must stay light and not cut each other off.
2. Clear a column at 21 and with five cards under 21; neither should play
   two complete clear samples.
3. Compare a plain 21 with Blackjack and Full House. Higher-value awards
   should feel more special through melodic shape, not drastically greater
   loudness.
4. Test Straight and 5 of a Kind: these clear all columns and should use the
   distinct board-clear sample, not the column-clear sample.
5. End a run on a placement or clear: the descending game-over notes
   should follow the main event.
6. Test Deck Clear occurring on a scoring move: the deck bonus must add an
   accent without triggering a duplicate card-placement sound.
7. Repeat with reduced motion, sound off, then on again, and headphones
   and laptop speakers. No sound depends on an animation completing.

The signal analysis, cue structure and node-level tests are technical checks,
not a substitute for listening to the finished game in a browser.

## Mix stress check

An offline sample-level simulation combined the actual three WAVs with
the synthesized accent envelopes at the shipped gains, including a
worst-case board clear, deck recycle, and game-over on one placement:

| Event | Peak (dBFS) |
| --- | ---: |
| Ordinary placement | -29.2 |
| Standard column clear | -27.8 |
| Blackjack column clear | -27.8 |
| Full House column clear | -27.8 |
| Board clear | -25.9 |
| Board + deck-clear bonus | -25.9 |
| Board + deck-clear + game over | -25.9 |

All cases have very substantial peak headroom, so compression is unnecessary.
The 220–370 ms reward samples have a stronger sustained impression than the
75 ms placement sample, even when peaks are close. These are offline modeled
levels and do not constitute an evaluated perceptual mix.
