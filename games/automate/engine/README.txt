stockfish.js and stockfish.wasm are Stockfish 11 compiled to WebAssembly (single thread, classic evaluation),
taken from the stockfish@11.0.0 npm package (src/).
Why 11 and not a newer one: Stockfish 18/19 refuse positions a real game could not reach (more than 8 pawns,
extra queens beyond promotions, ...) and then crash. Automate drafts armies freely, so it needs an engine that
accepts any position. Stockfish 11 does.
Stockfish.js by Chess.com / nmrugg, stockfish.wasm by Niklas Fiekas and Hiroshi Ogawa, Stockfish by the
Stockfish developers. GPLv3 (see COPYING.txt).
Upstream: https://github.com/nmrugg/stockfish.js
License and corresponding source: https://github.com/nmrugg/stockfish.js and https://github.com/official-stockfish/Stockfish
