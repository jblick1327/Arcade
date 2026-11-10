# Automate audio notes

Direction: restrained chessboard taps rather than an arcade soundtrack.
The quiet move should be comfortable during fast engine playback; important
outcomes have a distinctive, short melodic cue.

| Event | Cue |
| --- | --- |
| Draft / erase | Quiet wooden tap variations |
| Lock army | Two-note confirmation |
| Ordinary move | Short wooden tap, subtle pitch variation |
| Capture | Slightly stronger and deeper tap |
| Castle | Two quiet taps |
| Check | Move impact plus brief warning |
| Promotion | Rising two-note flourish |
| Checkmate | Three-note resolution |
| Draw | Descending two-note ending |

Single event classification per move: mate > draw > promotion > check >
castle > capture > quiet. Capturing checks get a capture impact and check
accent, not two full independent sounds. Effects are off by default, with
a volume control under Settings.

Offline checks using the original WAVs found the normal and capture sample
peaks were well below the former compressor threshold (-22 dBFS); ducking
also softened the attacks that should feel satisfying. A direct master gain
plus per-event levels is simpler. Keep short overlapping Web Audio voices,
but no compressor or ducking.

QA: listen at short and long Stockfish think times, especially checks,
captures, castling, promotions and game-end cues; repeat on headphones and
laptop speakers, including online runner/spectator playback.
