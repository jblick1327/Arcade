# Doors

Wait through Fibonacci countdowns and pass through endless doors. Press A, Z or
Space, or tap the game. The game is shown at a larger integer pixel scale in a
wider Arcade frame. Open the **Palettes** drawer below the screen to choose from
37 color schemes: 28 still tints followed by nine animated options, separated
by a thin rule (no visible section labels). Animated swatches preview their
motion while the drawer is open. The five new animations add independent
interference, breathing luminance, stepped signal colors, and subtle spatial
warping on selected effects. When reduced motion is preferred, every palette
stays fixed and distortion is disabled. The selected palette is saved locally.
Audio starts on the first game input.

The leaderboard score is the starting number of the highest door actually
passed through. The initial free door starts at 0. Opening animation completion
and entry into the hallway finish a round; unlocking alone earns no score.
Only a newly higher completed door is submitted, so repeated 1 doors are not
duplicate writes. Scores go exclusively through Arcade.submitScore.

The existing Arcade Number contract is unchanged. Extremely large scores round
to a finite JavaScript Number (saturating only beyond Number.MAX_VALUE), with
the exact decimal in metadata when it fits. Game countdowns remain BigInts.

Progress is browser-local and keyed by Arcade user ID, with a separate guest
save. No cross-device/cloud progress storage or platform API changes are added.
Save data is never submitted as a score merely by loading it. The leaderboard
remains owned by Arcade; no local leaderboard or score cache is maintained.

Run npm test and npm run build from the repository root. Focused game tests:

```sh
node --test games/doors/tests/*.cjs
```

For offline SDK testing, serve the repository root using a static file server
and open /games/doors/. The SDK prints completed-round scores to the console.
No framework, dependencies, build step, emulator or ROM is used by this game.

Original graphics and tracker arrangements were extracted from the supplied
Game Boy cartridge. Countdown overflow and the extra zero tick are fixed.
The five alternate tunings share one arrangement and use
f(k)=116.51*[1+k*(R-1)/4], k=0,1,3,4,5,7,
R=2,3/2,5/3,8/5,phi. Alternate 4 k1 is corrected to 135.928333333 Hz.
Physical sound-chip/filter/trigger quirks and post-SFX channel state are modeled,
not verified against hardware. Live browser QA was blocked by Windows IPC
permissions in the source workspace; logic, asset, tuning and mocked-mount
checks passed there. The original ROM and reverse-engineering tools are not
part of this folder.
