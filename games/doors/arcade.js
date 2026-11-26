// arcade.js - connects Doors to Arcade scores and per-user saves
// Author: Reachnid Group
// Centennial College - Fall 2026

// arcade's SDK owns score storage; progress stays in account-scoped browser storage

(function (global) {
  'use strict';

  //=============================================================
  //                          CONNECT
  //=============================================================

  // connect to the Arcade SDK (when present). Resolves an adapter with:
  //   progressKey(base)  localStorage key for this user's (or the guest's) progress
  //   walkedThrough(n)   report passing a door that started at `n`; submits only new highs
  async function connect(sdk = global.Arcade) {
    let context = null;
    if (sdk) {
      try {
        context = await sdk.ready();
      } catch (_) {
        /* Standalone play still works. */
      }
    }
    const user = context && context.user;
    let highest = null;
    let submissions = Promise.resolve();
    return {
      progressKey(base) {
        if (!sdk) return base;
        return base + (user ? ':arcade:user:' + user.id : ':arcade:guest');
      },
      walkedThrough(startingNumber) {
        const value = BigInt(startingNumber);
        if (value < 0n || (highest !== null && value <= highest)) return submissions;
        highest = value;
        if (!sdk) return submissions;
        const exact = String(value);
        const number = Number(value);
        // Arcade accepts finite Numbers. Keep the exact decimal in metadata when it fits
        const score = Number.isFinite(number) ? number : Number.MAX_VALUE;
        const meta =
          exact.length <= 512 ? { highestDoorStart: exact } : { decimalDigits: exact.length };
        submissions = submissions.then(async () => {
          try {
            return await sdk.submitScore(score, meta);
          } catch (_) {
            return { ok: false, reason: 'unavailable' };
          }
        });
        return submissions;
      },
    };
  }

  //=============================================================
  //                          EXPORTS
  //=============================================================

  global.DoorArcade = { connect };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.DoorArcade;
})(globalThis);
