# CROWNS & BONES

Work in progress — player feedback welcome.

A four-player game combining property, chess and dominoes. The last court still in play wins. Open **Rules** at the table for the complete rules.

## Playing

- **Local:** open the game without an online match. Four players share the device. The current player's dominoes appear below the estate board.
- **Online:** create a match in Arcade and have three other players join. Seats are assigned Crimson Court, Azure Syndicate, Gilded Crown and Verdant Order in joining order. The first player sets the board once all four seats are filled.
- On your turn, optionally play a domino and take your chess action, then roll to move or forge a domino. End your turn when the required rolls are used. A domino adds momentum to your next move.
- Select an estate space to read its deed. Open **Chess** to move your army. **Domino table** shows the shared chain and your own hand. Jokers, court accounts and the game record are available at the table.
- During an online auction, each eligible player bids or passes from their own seat. A pass withdraws that bidder. The last remaining highest bidder wins; then control returns to the court whose board turn was interrupted.

Online actions save through `Arcade.match.update`; other players receive the same position through `Arcade.match.onChange`. Waiting players and spectators cannot act. A stale write restores the current shared position. An unconfirmed network write pauses input until a reload or a newer match update resolves it. Finished matches report the winning seat once through the match result, which feeds Arcade's win leaderboard. Local games do not submit scores on behalf of the players sharing the device.

Local browser saves remain separate from online matches. The Game menu offers manual save/load and a new game only in local play. Online matches resume from Arcade's saved state.

As with Arcade's other generic match games, match data is public to the participants' browsers and rules are enforced by the game client. Hands are hidden from other seats in the interface, not by a private server-side deal.

## Development

Serve the repository root and open `/games/crowns-and-bones/`, or run `npm run dev` and use the Arcade game list. No new dependencies or server/client/SDK changes are required.

Run `node --test games/crowns-and-bones/tests/*.cjs`, `npm test`, and `npm run build` from the repository root. The integration tests simulate four SDK-connected clients, including turn changes, auctions, conflicts, failed saves, reconnects, spectators and match completion. Live account/database and visual checks remain separate from those simulations.

Please include what happened, what you expected, and the relevant game-record entry when reporting a problem.
