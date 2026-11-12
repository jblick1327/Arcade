# CROWNS & BONES

## Reassessment of the Table Edition

The previous pass made a real but incomplete structural change: it moved the players around the board and removed the permanent sidebar. It retained the dashboard's hierarchy and component repetition. Describing it as a complete change of design philosophy was overstated.

| Previous choice | What it actually did | Current revision |
| --- | --- | --- |
| Large branded masthead | Kept a web-product header above the game | Small title; the printed board carries the main identity |
| Four elaborate player plaques | Moved the statistic cards without changing their contents | Compact names, cash and turn indication; detailed holdings in a ruled register |
| Brass selector keys | Restyled four equal software tabs | Estate board remains on the table; chess and rules open as separate objects |
| Turn ledger | Put a wide control panel below a very tall composition | Unboxed dice actions beside a directly playable domino rack |
| Cabinet drawers | Turned the sidebar into a horizontal expanding widget | Loose folios with a clear return to the table |
| Frames, textures and repeated ornament | Gave every component comparable visual weight | Flat printed board; restrained framing; material changes reserved for distinct objects |
| Removing the visible tagline | Missed the opening log and other generated text | Opening event, saved-log migration, prompts and rules reviewed together |

The saved desktop preview also showed large empty felt margins, oversized plaques and multiple nested frames. These made the table look monumental while keeping ordinary actions far from the board. The mobile layout returned to paired player blocks and substantially reduced the board labels. Moving objects around did not, by itself, resolve the composition.

## Direction

An early twentieth-century printed game with a few loose implements: ink on buff board, restrained oxblood, faded house pigments, bone dominoes, a small chessboard, a paper rulebook and a ruled register. The objects should have different proportions because they serve different purposes.

The visual character comes from the composition, typography and pieces. Texture and ornament support those choices. Age should not mean low contrast, microscopic text, or decoration on every edge.

## Composition

- The estate board is the permanent centre of play. Its spaces read as part of one printed board, without individual card shadows.
- Nameplates show identity, cash and whose turn it is. Holdings, political relations and secondary statistics belong in the court register.
- Dice actions and the current hand stay close together below the board. Playing a domino does not require changing views.
- Chess opens a separate playing board. Rules open a paper booklet. Deeds, Jokers and records open readable folios.
- The main title stays quiet. Do not repeat large branding above and inside the board.
- Avoid equal-sized navigation buttons, repeated bordered containers, dashboard status tiles, fake drawers and ornamental frames without a physical purpose.

## Copy

The brief, factual progress caption “Work in progress — player feedback welcome.” appears in Arcade’s listing and the game header. It communicates the current state of the game and invites feedback.

Use names, rules, choices and factual events. Do not write advertising, a narrator's voice, competitive slogans, ominous predictions, punchlines, or prose that tells the player how to feel.

Examples of the intended register: “Game begun. Crimson Court to play.” “Buy price.” “Return to table.” “Gilded Crown won Brass St for $100.”

Keep the distinctive game and piece names. Explain the unusual mechanics directly. A dramatic game does not require dramatic interface sentences. Save and browser terminology is acceptable where it explains actual saving behavior.

## Materials and typography

- Board: buff paper `#e5d5b1`, ink `#342d24`; narrow printed rules.
- Table: muted green `#28352d`, dark brown surroundings `#221d18`.
- Details: old brass `#b49a6a`; sparing oxblood and faded house colours.
- Dominoes: ivory surfaces, black pips, subtle depth; upright tiles in the hand.
- Reading: Georgia / Palatino-family serif. Display: restrained book typography. Small capitals for short labels, ordinary sentence case for instructions.
- No remote fonts, stock textures, decorative emoji, neon, glowing status indicators, pill controls or full-page grain patterns.

## Interaction and practical limits

The estate board supports an enlarged, scrollable view so small-screen players need not rely only on tiny overview labels. Chess retains a scrollable board. Folios have explicit close controls, Escape handling, focus containment, and an inert background. Joker effects are printed on the card faces and remain available on touch devices.

Retain the existing rules, legacy save keys and saved-state structure. On loading an old save, replace the former slogan in the opening log with the factual opening event; retain other game history.

## Verification

Execution and generated-markup checks cover the on-table domino hand, momentum, dice, turn changes, chess movement, all folios, deed inspection, court selection, enlargement state, property auctions, Joker replacement, save migration, bankruptcy/revival and fairy-piece deployment. Generated views are checked for balanced HTML and nested buttons.

The new layout has **not** been visually verified in a live browser: the environment blocked the local preview. Responsive CSS and interaction logic have been reviewed, but the result needs a visual check on desktop and mobile. Do not claim that layout quality, touch ergonomics or the aesthetic goal has been conclusively demonstrated by the execution checks.
