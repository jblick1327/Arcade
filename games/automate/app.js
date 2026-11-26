// app.js - Automate user interface, Stockfish engine control and online play
// Author: Reachnid Group
// Centennial College - Fall 2026

// two humans take turns drafting armies; Stockfish then plays the resulting position against
// itself while both players watch.
//
// local play: both players share this browser.
// online play (an Arcade match is attached): each player drafts on their own turn, and the player
// who completes the draft becomes the "runner" whose browser runs Stockfish and publishes every
// move to the server. The other player just replays the published moves.
//
// depends on window.ArmySetup (setup.js), window.ChessRules (rules.js) and, optionally,
// window.AutomateAudio (audio.js) and window.Arcade (the SDK).

(() => {
  'use strict';

  //=============================================================
  //                           SETUP
  //=============================================================

  const Army = window.ArmySetup;
  const Chess = window.ChessRules;
  const $ = (id) => document.getElementById(id);

  const ICON = {
    w: { P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔' },
    b: { P: '♟︎', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' },
  };
  const PIECE = { P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King' };

  const ENGINE_INIT_TIMEOUT_MS = 45000;
  const PUBLISH_RETRY_MS = 1500;

  //=============================================================
  //                           STATE
  //=============================================================

  let draft = Army.create();
  let phase = 'draft'; // 'draft' | 'battle'
  let brush = 'K'; // piece letter the player is about to place

  // the battle in progress (see newBattle), or null during the draft
  let game = null;

  // Stockfish web worker
  let worker = null;
  let ready = false; // engine answered 'readyok'
  let searching = false; // a 'go' command is in flight
  let discard = false; // ignore the next bestmove (the search was stopped by Pause/Step)
  let timeout = null; // engine start-up timer
  let engineId = 0; // bumped on every restart so callbacks from an old worker are ignored

  // online (Arcade match) state. Everything below is inert when no match is attached
  let online = false;
  let match = null; // latest match object from the SDK
  let you = null; // our seat: 0 = White, 1 = Black, null = spectator
  let busy = false; // a draft write is in flight
  let engineStarted = false; // this browser has started the engine for the online battle
  let publishing = false; // a battle move write is in flight

  const colorOf = (p) => (p === p.toUpperCase() ? 'w' : 'b');
  const myColor = () => (you === 0 ? 'w' : you === 1 ? 'b' : null);

  // replace the draft and pick a sensible default brush (king first, then pawns)
  function setDraft(next) {
    draft = next;
    brush = Army.countKing(draft.armies[draft.turn]) ? 'P' : 'K';
  }

  // fresh battle bookkeeping starting from `start`
  function newBattle(start) {
    return {
      history: [start], // every position so far
      moves: [], // SAN strings for the move list
      uci: [], // UCI strings, as stored on the server
      last: null, // details of the last move, for highlighting and sound
      paused: false,
      finished: false,
      drawClaim: '', // set when the game ended on a claimable draw
      pendingStep: false, // Step was pressed: play exactly one move while paused
      thinkMs: Number($('thinkMs').value),
    };
  }

  // true when this browser may place a piece right now
  function canAct() {
    return (
      !online ||
      (!busy &&
        match &&
        match.status === 'active' &&
        !match.state?.restartRequired &&
        you !== null &&
        match.turn === you &&
        phase === 'draft' &&
        draft.turn === myColor())
    );
  }

  // true when this browser runs the engine for an online battle
  function amRunner() {
    return (
      online &&
      phase === 'battle' &&
      match &&
      match.state &&
      you !== null &&
      match.state.runner === you
    );
  }

  //=============================================================
  //                      SMALL UI HELPERS
  //=============================================================

  function info(text, error = false) {
    $('message').textContent = text;
    $('message').classList.toggle('error', error);
  }

  function engineInfo(text) {
    $('engineStatus').textContent = text;
  }

  function sound(cue, options) {
    window.AutomateAudio?.play(cue, options);
  }

  // update text only when it changed, so screen readers do not re-announce it
  function setStatus(id, text) {
    const node = $(id);
    if (node.textContent !== text) node.textContent = text;
  }

  //=============================================================
  //                         RENDERING
  //=============================================================

  // 64 squares (a8..h1) of piece letters or null, from the draft or the current battle
  function boardPieces() {
    if (phase === 'battle') {
      const position = game.history.at(-1);
      // convert the 0x88 board (16 columns per row) to 8x8
      return Array.from({ length: 64 }, (_, i) => position.b[Math.floor(i / 8) * 16 + (i % 8)]);
    }
    const pieces = Array(64).fill(null);
    for (const color of ['w', 'b']) {
      for (let i = 0; i < 64; i++) {
        const piece = draft.armies[color][i];
        if (piece) pieces[i] = color === 'w' ? piece : piece.toLowerCase();
      }
    }
    return pieces;
  }

  // small corner label (rank number or file letter) inside a square
  function coordLabel(kind, text) {
    const label = document.createElement('span');
    label.className = 'coord ' + kind;
    label.textContent = text;
    return label;
  }

  function renderBoard() {
    const pieces = boardPieces();
    const board = $('board');
    const focused = document.activeElement?.dataset.index;
    const drafting = phase === 'draft' && canAct();
    board.replaceChildren();

    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8);
      const c = i % 8;
      const p = pieces[i];
      const square = Army.square(i);

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.index = i;
      button.className = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
      button.disabled = !drafting;

      const legal = drafting && !Army.placementError(draft, brush, i);
      if (legal) button.classList.add('deploy');
      if (
        phase === 'battle' &&
        game.last &&
        (game.last.from === square || game.last.to === square)
      ) {
        button.classList.add('last');
      }

      const occupant = p ? Army.names[colorOf(p)] + ' ' + PIECE[p.toUpperCase()] : 'empty';
      const action = 'can place ' + PIECE[brush];
      button.setAttribute('aria-label', square + ', ' + occupant + (legal ? ', ' + action : ''));

      if (p) {
        const span = document.createElement('span');
        span.className = 'piece ' + colorOf(p);
        span.textContent = ICON[colorOf(p)][p.toUpperCase()];
        button.append(span);
      }
      if (c === 0) button.append(coordLabel('rank', 8 - r));
      if (r === 7) button.append(coordLabel('file', 'abcdefgh'[c]));
      board.append(button);
    }

    // re-rendering replaces the buttons; keep keyboard focus on the same square
    if (drafting && focused !== undefined) board.children[focused]?.focus({ preventScroll: true });
  }

  // the row of piece buttons used to choose what to place
  function renderTools() {
    const tools = $('pieceTools');
    tools.replaceChildren();
    for (const p of ['P', 'N', 'B', 'R', 'Q', 'K']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool';
      button.setAttribute('aria-pressed', String(brush === p));
      button.disabled = !canAct();

      const symbol = document.createElement('span');
      symbol.className = 'symbol';
      symbol.textContent = ICON[draft.turn][p];
      symbol.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'cost';
      label.textContent = PIECE[p] + ' · ' + Army.COST[p];
      button.append(symbol, label);

      button.addEventListener('click', () => {
        brush = p;
        for (const tool of tools.children)
          tool.setAttribute('aria-pressed', String(tool === button));
        info('');
        renderDraftHint();
        renderBoard();
      });
      tools.append(button);
    }
  }

  function renderDraftHint() {
    let tip = '';
    if (canAct()) {
      const army = draft.armies[draft.turn];
      if (!Army.countKing(army)) tip = 'Place your king first.';
      else if (Army.COST[brush] > Army.BUDGET - Army.points(army)) {
        tip = 'That piece costs more points than you have left.';
      } else if (brush === 'K') tip = 'Your king is already on the board.';
      else tip = 'Choose a piece and select an outlined square. Placements are final.';
    }
    $('draftHint').textContent = tip;
  }

  function renderDraftPanel() {
    const side = Army.names[draft.turn];
    let turn = side + ' is drafting';
    if (online) {
      if (match.status === 'waiting') turn = 'Waiting for opponent';
      else if (match.state?.restartRequired) turn = 'This saved draft needs a new match';
      else if (busy) turn = 'Saving your draft…';
      else if (canAct()) turn = 'Your turn · ' + side;
    }
    setStatus('turn', turn);
    renderDraftHint();
    renderTools();
  }

  function renderBattlePanel() {
    const state = Chess.status(game.history);
    const engineVisible = ready || (online && !amRunner()); // spectators never load the engine
    const label = game.finished && game.drawClaim ? 'Draw by ' + game.drawClaim + '.' : state.text;
    setStatus(
      'gameStatus',
      engineVisible || game.finished
        ? label + (game.paused && !game.finished ? ' · Paused' : '')
        : 'Loading Stockfish…',
    );
    $('gameStatus').classList.toggle('finished', game.finished);
    setStatus('battleResult', game.finished ? label : '');
    $('playBtn').disabled = !ready || game.finished;
    $('playBtn').textContent = game.paused ? 'Resume' : 'Pause';
    $('stepBtn').disabled = !ready || game.finished;

    const list = $('moves');
    list.replaceChildren();
    game.moves.forEach((move, i) => {
      const div = document.createElement('div');
      div.textContent = Math.floor(i / 2) + 1 + (i % 2 ? '... ' : '. ') + move;
      list.append(div);
    });
    list.scrollTop = list.scrollHeight;
  }

  // redraw everything from the current state
  function render() {
    $('whitePoints').textContent = Army.BUDGET - Army.points(draft.armies.w) + ' points left';
    $('blackPoints').textContent = Army.BUDGET - Army.points(draft.armies.b) + ' points left';
    const bothKings = Army.countKing(draft.armies.w) && Army.countKing(draft.armies.b);
    $('whiteComplete').hidden = !bothKings || !draft.done.w;
    $('blackComplete').hidden = !bothKings || !draft.done.b;
    $('setupPanel').hidden = phase !== 'draft';
    $('battlePanel').hidden = phase !== 'battle';
    if (phase === 'draft') renderDraftPanel();
    else renderBattlePanel();
    renderBoard();
    if (online) onlineChrome();
  }

  //=============================================================
  //                          DRAFTING
  //=============================================================

  $('board').addEventListener('click', (e) => {
    const button = e.target.closest('button.sq');
    if (!button || phase !== 'draft' || !canAct()) return;
    const { state, error } = Army.perform(draft, brush, Number(button.dataset.index));
    if (error) {
      info(error, true);
      return;
    }
    sound('draft');
    if (online) {
      submitPlacement(state);
      return;
    }
    setDraft(state);
    info('');
    if (Army.complete(state)) startBattle(Army.battlePosition(state));
    else render();
  });

  function startBattle(start) {
    phase = 'battle';
    game = newBattle(start);
    render();
    startEngine();
  }

  //=============================================================
  //                      STOCKFISH ENGINE
  //=============================================================

  // send one UCI command to the engine
  function send(cmd) {
    if (worker) worker.postMessage(cmd);
  }

  function killEngine() {
    engineId++;
    clearTimeout(timeout);
    if (worker) {
      worker.terminate();
      worker = null;
    }
    ready = false;
    searching = false;
    discard = false;
  }

  // stop the engine and show the error in the status bar
  function engineFailed(error) {
    console.error('[Automate engine]', error);
    killEngine();
    if (game) game.paused = true;
    const msg = (error?.message || String(error)).replace(/\s+/g, ' ').slice(0, 230);
    engineInfo('ERROR: ' + msg);
    if (phase === 'battle') {
      $('gameStatus').textContent = 'ENGINE ERROR';
      $('moves').title = msg;
      renderBoard();
      $('playBtn').disabled = true;
      $('stepBtn').disabled = true;
    }
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // check the engine files are reachable before starting the worker, so a missing file gives a
  // clear message instead of a silent worker failure. Returns false if a newer start superseded us.
  async function checkEngine(id) {
    if (location.protocol === 'file:') {
      throw Error('Open this game through the site, not as a file.');
    }
    for (const name of ['stockfish.js', 'stockfish.wasm']) {
      if (id !== engineId) return false;
      let response;
      try {
        response = await fetch('./engine/' + name, { method: 'HEAD', cache: 'no-store' });
      } catch (e) {
        throw Error('Cannot read engine files: ' + e.message);
      }
      if (!response.ok) {
        throw Error(
          `${name} missing (HTTP ${response.status}). Reload the page, or tell the site owner.`,
        );
      }
    }
    return id === engineId;
  }

  // (Re)start Stockfish and begin playing once it reports ready
  async function startEngine() {
    killEngine();
    const id = engineId;
    engineInfo('LOADING STOCKFISH...');
    try {
      if (!(await checkEngine(id))) return;
      if (id !== engineId) return;
      worker = new Worker('./engine/stockfish.js');
    } catch (e) {
      if (id === engineId) engineFailed(e);
      return;
    }

    worker.onerror = (e) => {
      if (id === engineId) {
        engineFailed(new Error(e.message || 'Worker failed. Check the browser console.'));
      }
    };
    worker.onmessageerror = () => {
      if (id === engineId) engineFailed(new Error('Unreadable engine message.'));
    };
    // UCI handshake: uci -> uciok, set options, isready -> readyok, then go/bestmove per move
    worker.onmessage = (e) => {
      if (id !== engineId) return;
      for (const raw of String(e.data).split(/\r?\n/)) {
        const line = raw.trim();
        if (line === 'uciok') {
          send('setoption name MultiPV value 1');
          send('setoption name Hash value 32');
          send('isready');
        } else if (line === 'readyok') {
          clearTimeout(timeout);
          ready = true;
          engineInfo('STOCKFISH 11');
          render();
          requestMove();
        } else if (line.startsWith('bestmove ')) {
          bestMove(/^bestmove\s+(\S+)/.exec(line)?.[1]);
        }
      }
    };
    send('uci');
    timeout = setTimeout(() => {
      if (id === engineId && !ready) {
        engineFailed(new Error('Engine initialization timed out. Check WASM and browser console.'));
      }
    }, ENGINE_INIT_TIMEOUT_MS);
  }

  // mark the game finished when the rules say it is over (or a draw can be claimed).
  // returns true when there is nothing more to play.
  function doneIfFinished() {
    if (phase !== 'battle' || !game) return true;
    const status = Chess.status(game.history);
    if (status.done || status.claim) {
      game.finished = true;
      game.paused = true;
      game.pendingStep = false;
      game.drawClaim = status.claim || '';
      return true;
    }
    return false;
  }

  // ask the engine for the next move, unless paused, busy, or the game is over
  function requestMove() {
    if (
      phase !== 'battle' ||
      !ready ||
      searching ||
      publishing ||
      game.finished ||
      (game.paused && !game.pendingStep)
    ) {
      return;
    }
    if (doneIfFinished()) {
      render();
      return;
    }
    searching = true;
    send('position fen ' + Chess.toFen(game.history.at(-1)));
    send('go movetime ' + game.thinkMs);
  }

  // append `move` (played from position `before`) to battle `g`
  function recordMove(g, before, move, uci) {
    const [from, to, promotion, flag] = move;
    g.uci.push(uci);
    g.moves.push(Chess.san(before, move));
    g.last = {
      from: Chess.sq(from),
      to: Chess.sq(to),
      target: (to >> 4) * 8 + (to & 7), // destination as a 0-63 board button index
      capture: flag === 'ep' || before.b[to] !== '.',
      castle: flag === 'castle',
      promotion: Boolean(promotion),
    };
    g.history.push(Chess.apply(before, move));
  }

  // which sound to play for the last move
  function cueForLastMove() {
    const { capture, castle, promotion } = game.last;
    if (game.finished) return game.moves.at(-1).endsWith('#') ? 'checkmate' : 'draw';
    if (promotion) return 'promotion';
    if (castle) return 'castle';
    if (capture) return 'capture';
    return 'move';
  }

  // flash the captured square and play the sound for the last move
  function moveFeedback() {
    if (!game?.last) return;
    const { capture, target } = game.last;
    if (capture) $('board').children[target].classList.add('capture');
    sound(cueForLastMove(), { capture });
  }

  // handle the engine's 'bestmove' reply
  function bestMove(best) {
    if (!searching) return;
    searching = false;
    if (discard) {
      discard = false;
      requestMove();
      return;
    }
    if (phase !== 'battle' || game.finished || (game.paused && !game.pendingStep)) return;

    const before = game.history.at(-1);
    const move = best && best !== '(none)' ? Chess.fromUci(before, best) : null;
    if (!move) {
      if (doneIfFinished()) render();
      else engineFailed(new Error('Illegal move from engine: ' + best));
      return;
    }
    recordMove(game, before, move, Chess.key(move));
    game.pendingStep = false;
    doneIfFinished();
    render();
    moveFeedback();
    if (online)
      publishMove(); // publishMove asks for the next move once the write lands
    else requestMove();
  }

  //=============================================================
  //                      BATTLE CONTROLS
  //=============================================================

  // abandon the current search; its result will be discarded
  function stopSearch() {
    if (searching) {
      discard = true;
      send('stop');
    }
  }

  $('playBtn').addEventListener('click', () => {
    if (phase !== 'battle' || !ready || game.finished) return;
    game.pendingStep = false;
    if (game.paused) {
      game.paused = false;
      render();
      requestMove();
    } else {
      game.paused = true;
      stopSearch();
      render();
    }
  });

  $('stepBtn').addEventListener('click', () => {
    if (phase !== 'battle' || !ready || game.finished) return;
    game.paused = true;
    game.pendingStep = true;
    if (searching) stopSearch();
    else requestMove();
    render();
  });

  $('thinkMs').addEventListener('change', (e) => {
    if (game) game.thinkMs = Number(e.target.value);
  });

  $('sound').addEventListener('click', (e) => {
    const muted = window.AutomateAudio?.toggleMute();
    e.currentTarget.textContent = muted ? 'Unmute sound' : 'Mute sound';
  });

  $('rematchBtn').addEventListener('click', () => {
    killEngine();
    startBattle(Army.battlePosition(draft));
  });

  $('newBtn').addEventListener('click', () => {
    killEngine();
    phase = 'draft';
    setDraft(Army.create());
    game = null;
    engineInfo('');
    info('');
    render();
  });

  render();
  engineInfo('');

  //=============================================================
  //                  ONLINE PLAY (ARCADE SDK)
  //=============================================================

  // hide local-only controls; only the runner gets the engine controls
  function onlineChrome() {
    const runner = amRunner();
    $('rematchBtn').hidden = true;
    $('newBtn').hidden = true;
    $('playBtn').hidden = !runner;
    $('stepBtn').hidden = !runner;
    $('settings').hidden = !runner;
  }

  // rebuild the battle from saved state `s`, keeping the pause state of `previous` if any
  function replay(s, previous) {
    let position = Chess.parseFen(Army.fen(s.draft));
    const g = newBattle(position);
    if (previous) g.paused = previous.paused;
    for (const uci of s.moves) {
      const move = Chess.fromUci(position, uci);
      if (!move) break;
      recordMove(g, position, move, uci);
      position = g.history.at(-1);
    }
    return g;
  }

  // winning seat after checkmate (White = 0, Black = 1), or null for a draw
  function winnerOf() {
    const position = game.history.at(-1);
    const mated = Chess.legal(position).length === 0 && Chess.checked(position);
    return mated ? (position.t === 1 ? 1 : 0) : null;
  }

  // bring the local view in line with match `m` from the server
  function applyMatch(m) {
    if (!m) return;
    const previousMoves = game?.uci.length ?? (match ? 0 : undefined);
    match = m;
    you = m.you;
    const s = m.state || {
      phase: 'draft',
      draft: Army.snapshot(Army.create()),
      runner: null,
      moves: [],
    };
    setDraft(s.draft);

    if (s.phase === 'battle') {
      const runner = you !== null && s.runner === you;
      // the runner's own in-progress battle is the source of truth; never replace it mid-game
      if (!(runner && game && engineStarted && m.status !== 'done')) {
        phase = 'battle';
        game = replay(s, game);
        doneIfFinished();
        if (!runner) {
          const runnerPlayer = m.players[s.runner];
          engineInfo(runnerPlayer ? runnerPlayer.name + "'s browser is running the engine" : '');
        }
        if (runner && m.status === 'active' && !engineStarted) {
          engineStarted = true;
          if (game.finished) publishMove();
          else startEngine();
        }
      }
    } else {
      phase = 'draft';
      game = null;
    }

    render();
    // spectators hear each newly published move
    if (
      phase === 'battle' &&
      !amRunner() &&
      previousMoves !== undefined &&
      game.uci.length > previousMoves
    ) {
      moveFeedback();
    }
  }

  // save one draft placement. The placement that completes the draft also starts the battle,
  // making this player the engine runner.
  async function submitPlacement(next) {
    setDraft(next);
    info('');
    busy = true;
    render();
    const complete = Army.complete(next);
    const r = await Arcade.match.update(
      complete
        ? {
            state: { phase: 'battle', draft: Army.snapshot(next), runner: you, moves: [] },
            turn: you,
          }
        : {
            state: { phase: 'draft', draft: Army.snapshot(next), runner: null, moves: [] },
            turn: next.turn === 'w' ? 0 : 1,
          },
    );
    busy = false;
    if (r.ok) {
      applyMatch(r.match);
      return;
    }
    applyMatch(r.match || Arcade.match.get());
    info(
      r.reason === 'conflict' ? 'Out of date — refreshed.' : 'Could not save — refreshed.',
      true,
    );
  }

  // publish the battle so far (and the result, once finished). Retries network failures, and keeps
  // only one write in flight, including when the runner presses Step during a save.
  async function publishMove() {
    const body = {
      state: { phase: 'battle', draft: Army.snapshot(draft), runner: you, moves: game.uci.slice() },
      turn: you,
    };
    if (game.finished) body.result = { winner: winnerOf() };
    publishing = true;
    try {
      for (;;) {
        const r = await Arcade.match.update(body);
        if (r.ok) break;
        const current = r.match || Arcade.match.get();
        // our earlier write may have landed even though the reply was lost
        const saved = current?.state?.moves;
        if (
          saved?.length === body.state.moves.length &&
          saved.every((move, i) => move === body.state.moves[i]) &&
          (!body.result || current.status === 'done')
        ) {
          break;
        }
        if (r.reason === 'conflict' || r.reason === 'invalid-automate-update') {
          engineFailed(new Error('Out of sync with the server. Reload the page.'));
          return;
        }
        await sleep(PUBLISH_RETRY_MS);
      }
    } finally {
      publishing = false;
    }
    requestMove();
  }

  if (window.Arcade) {
    Arcade.ready().then(({ match: m }) => {
      if (!m) return; // local mode: nothing changes
      online = true;
      Arcade.match.onChange(applyMatch);
      applyMatch(m);
    });
  }
})();
