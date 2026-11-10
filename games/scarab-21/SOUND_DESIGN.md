# Scarab 21 audio notes

Direction: quiet card-on-felt rustle for the frequently repeated action, a
stronger column clear for scoring, and the existing board-clear sound for rare
large bonuses. Keep audio optional and off by default.

| Event | Cue |
| --- | --- |
| Place | 130 ms soft filtered-noise rustle, one sample |
| Column clear | Existing 220 ms clear |
| Blackjack / special 21 | Column clear plus short highlight |
| Rare high-value hand | Column clear plus rising two-note flourish |
| Board clear | Existing 370 ms board clear |
| Deck recycle | Delayed bonus flourish |
| Game over | Gentle descending ending |

A single physical sample plays per placement, even when multiple awards occur.
Per-event gains are .44 (place), .50 (column), .54 (board). Slight playback-rate
randomization reduces repetition. A single master gain supplies effects volume;
no compressor, ducking, or placement-only filter is needed.

The old 75 ms placement had approximately 54% of spectral energy above
2.5 kHz and 60% of its energy within the first 10 ms; it sounded snare-like
even when filtered. The replacement 130 ms asset has a gradual ~18 ms onset
and ~75 ms release, with ~1.5% of its energy in the first 10 ms.
These are signal properties, not a browser listening test.

QA: repeat 20 fast placements, confirm no sharp clicks; check ordinary 21,
high-value hands, full-board clears, deck recycling, and end-of-run overlapping
awards. Check sound off, sound on and effects-volume controls.
