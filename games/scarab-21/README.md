# Scarab 21

Play one card at a time into five columns. Click an arrow or press 1–5. A column clears at 21 or after five legal cards. The run ends when the draw fits nowhere.

| Clear | Points |
| --- | ---: |
| 21 | 10 |
| Four or five cards totaling 21, 7-7-7, or 6-7-8 | 15 |
| Ace plus 10, J, Q, or K | 21 |
| Five cards under 21 | 5 |
| A♠ + J♠ | 50 |
| A♠ + Q♠ and A♥ + Q♥ on consecutive clears | 50 on the second clear |
| Five equal column totals from 16 to 20 | 100 |
| Column totals 16–20 in any order | 100 |
| 3-3-5-5-5, 3-3-3-6-6, or 9-9-A-A-A | 200 |
| Draw pile exhausted | 10 |

Board bonuses clear all columns. Reshuffles recycle cleared cards and keep the board in play. Arcade records the final run score.

Rules follow [Jellyneo](https://www.jellyneo.net/?go=scarab_21) and [The Daily Neopets](https://thedailyneopets.com/neopets-games/scarab-21) for the suited Double Blackjack. The [original game page](https://www.neopets.com/games/scarab21/index.phtml) was unavailable for live verification.

Run tests from the repository root with `node --test games/scarab-21/tests/rules.cjs`.
