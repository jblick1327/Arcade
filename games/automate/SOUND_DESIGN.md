# Automate sound direction

The board should feel like a quiet, tactile chess set inside a retro desktop window.
Sound conveys **what happened** rather than which chess piece moved. Avoid loud,
long, or highly melodic cues during ordinary engine play.

## Cue map

| Event | Sound | Priority |
| --- | --- | --- |
| Draft placement | Light, slightly higher wooden tap | Background |
| Draft erase | Quieter, lower tap | Background |
| Lock army | Short, soft two-note acknowledgement | Medium |
| Quiet move | Short wooden tap; tiny pitch variation | Background |
| Capture | Fuller wooden knock (uses the original capture sample) | Medium |
| Castle | Two lower-intensity taps, 75 ms apart | Medium |
| Check | Piece/capture impact plus one short alert accent | High |
| Promotion | Piece/capture impact plus a rising two-note flourish | High |
| Checkmate | Piece/capture impact plus a restrained three-note resolution | Highest |
| Draw | Softer impact plus gentle descending two-note ending | High |

One classified cue per move. Priority is checkmate > draw > promotion > check
> castling > capture > quiet. A capture that gives check keeps the capture's
tactile layer but adds the check accent instead of playing two entire cues.

## Levels, assets, and mixing

- The existing 22.05 kHz, mono PCM samples are short (piece ~90 ms,
  capture ~150 ms), with no substantial silence before the attack.
- Sample event gains are .35 for quiet moves and .48 for captures,
  with subtle +/-1-2% playback-rate variation. The original files differ
  in loudness, so combined nominal capture RMS is approximately 5-6 dB
  above an ordinary move, rather than the prior approximately 14 dB gap.
  These are signal estimates, **not** calibrated perceived loudness.
- Draft edits are quieter, while castling is two soft taps, not two
  full-volume captures.
- The movement and synthesized accent voices connect directly to a single
  master gain (70% slider default, capped at .85 internally for headroom).
  There is no compressor or automatic ducking: signal tests found the
  compressor's -22 dBFS threshold was not reached in plausible event mixes,
  and ducking softened the initial impact of check and mate moves.
- Existing per-event gains provide the intended loudness contrast without
  processing a sustained bed that does not exist in Automate.
- Separate Web Audio one-shots allow samples and accents to overlap
  without one move cutting off the previous sound. Rapid quiet moves
  are capped at one per 75 ms to avoid chattering at very high speeds.
- The original WAVs remain local to the game; accents are synthesized
  in-browser and introduce no external asset/license dependencies.
- Audio remains **off by default**. The sound checkbox enables the
  AudioContext through a user gesture to respect browser autoplay policies.
  An effects-volume slider lives in collapsed Settings.

## Listen-through checklist

1. In Settings, enable Sound effects at 70% and play a 0.1 s think-time
   game for at least 25 moves. Quiet taps should form a gentle rhythm,
   not a stack of clicks. Repeat at 2.5 s think time; no sound should feel
   suspiciously delayed.
2. Listen to a normal capture, then a capture giving check: the latter
   should sound alert but not twice as loud.
3. Confirm castling is recognizable as two connected movements, not
   as a double-click UI error.
4. Play until checkmate, promotion, stalemate, and repetition/draw
   when available. They should have contrasting *contours*, not
   massive differences in volume. Mate should feel decisive even if
   the final move is not a capture.
5. Repeat with sound disabled, then re-enabled mid-battle. No audio
   should leak while disabled.
6. Test the online runner and spectator. Reconnecting to a match should
   **not** play the full historical move list, but new moves should
   play their corresponding cues.
7. Compare laptop speakers and headphones at an ordinary listening
   level; if the alert tones are tiring, lower accent gains before
   making the tactile movement samples even quieter.

## Technical reading

- [MDN: Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN: Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
- [Game Developer: Game Audio Theory: Ducking](https://www.gamedeveloper.com/audio/game-audio-theory-ducking)
- [Game Audio Learning: Mixing and QA](https://www.gameaudiolearning.com/knowledgebase/how-to-mix-and-qa-test-your-game)

## Dynamics simplification check

A dry-mix simulation using the actual source WAV samples (mono 22.05 kHz),
the event gains in `audio.js`, and synthesized triangular accent envelopes
produced peaks of approximately -29.9 dBFS (ordinary moves every 100 ms),
-25.6 dBFS (capture followed by move), -25.7 dBFS (capture plus check),
and -25.6 dBFS (capture checkmate). None crossed the previous compressor's
-22 dBFS threshold. A contrived five-voice pileup peaked at -22.7 dBFS.
The compressor had a soft knee, so these results don't mean absolutely no
attenuation, but they establish that dynamic range control is not necessary.
A captured checking move's peak was reduced from about -25.7 to -27.3 dBFS
by ducking. Removing the dip preserves the impact instead. These are modeled
signal metrics, not measured browser output or a substitute for listening.
