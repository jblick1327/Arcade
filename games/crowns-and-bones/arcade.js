/* Four-player Arcade transport. Game rules and presentation stay in index.html. */
(function () {
  'use strict';
  let game, match = null, ready = false, saving = false, applying = false, uncertain = false;
  let acknowledged = '', error = '', version = -1;
  const readActions = new Set(['closeFolio', 'boardSize', 'dismissWinner', 'reloadMatch']);
  const localActions = new Set(['saveGame', 'loadGame', 'resetGame']);
  const clone = value => JSON.parse(JSON.stringify(value));

  // Selection, open apparatus and dismissed notices belong to each browser, not the match.
  function snapshot(state) {
    const copy = clone(state);
    copy.selectedTab = 'monopoly';
    copy.selectedTile = copy.selectedPiece = copy.deploy = null;
    copy.winnerSeen = false;
    delete copy.modal;
    delete copy.deployingIndex;
    return copy;
  }
  function actor(state) { return state.auction ? state.auction.actor : state.turnIndex; }
  function canAct() {
    return ready && !saving && !uncertain && (!match ||
      (match.status === 'active' && !!match.state && match.you !== null && match.turn === match.you));
  }
  function allowed(action) {
    if (readActions.has(action)) return true;
    if (localActions.has(action)) return ready && !match;
    return canAct();
  }
  function status() {
    if (!ready) return 'Connecting to Arcade…';
    if (error) return error;
    if (!match) return 'Local play · Four players sharing this device';
    if (match.status === 'waiting') return `Waiting for players · ${match.players.length}/4 joined`;
    if (!match.state) return 'Waiting for the first player to set the board.';
    const seat = match.you === null ? 'Spectating' : `You: ${game.state.players[match.you].name}`;
    if (match.status === 'done') return `${seat} · Match finished`;
    if (saving) return `${seat} · Saving move…`;
    const name = game.state.players[match.turn]?.name || 'Player';
    const action = game.state.auction
      ? (match.you === match.turn ? 'Your bid' : name + ' to bid')
      : (match.you === match.turn ? 'Your turn' : name + ' to play');
    return `${seat} · ${action}`;
  }
  function decorate() {
    const node = document.querySelector('#arcade-status');
    if (node) node.textContent = status();
    for (const el of document.querySelectorAll('[data-act]')) {
      if (!allowed(el.dataset.act)) el.disabled = true;
    }
    if (!canAct()) {
      for (const el of document.querySelectorAll('[data-domino], [data-square]')) el.disabled = true;
    }
  }
  function accept(incoming, force = false) {
    if (!incoming || (!force && incoming.version <= version)) return;
    if (incoming.version < version) return;
    match = clone(incoming); version = incoming.version;
    if (match.state) {
      acknowledged = JSON.stringify(snapshot(match.state));
      applying = true;
      game.replace(clone(match.state));
      applying = false;
    } else game.render();
  }
  async function publish(next) {
    const before = version;
    let result;
    try {
      const patch = { state: next, turn: actor(next) };
      if (next.winner !== null) patch.result = { winner: next.winner };
      result = await window.Arcade.match.update(patch);
    } catch { result = { ok: false, reason: 'network' }; }
    saving = false;
    if (result.match) {
      error = result.ok ? '' : 'The match changed. The current position has been restored.';
      uncertain = false;
      const latest = window.Arcade.match.get();
      accept(latest && latest.version > result.match.version ? latest : result.match, true);
    } else if (version > before) {
      // A newer polled position resolves an ambiguous update response.
      error = ''; uncertain = false;
      accept(match, true);
    } else {
      error = 'Move not confirmed. Reload the match before continuing.';
      uncertain = true;
      if (acknowledged) {
        applying = true; game.replace(JSON.parse(acknowledged)); applying = false;
      }
      game.render();
    }
  }
  function changed() {
    if (!ready || !match || applying || saving || uncertain || match.status !== 'active') return;
    if (match.you === null || match.turn !== match.you) return;
    const next = snapshot(game.state), encoded = JSON.stringify(next);
    if (encoded === acknowledged) return;
    if (encoded.length > 64000) {
      error = 'This position exceeds the match size limit. Reload the match.';
      uncertain = true; return;
    }
    saving = true;
    queueMicrotask(() => publish(next));
  }
  async function bind(engine) {
    game = engine;
    if (!window.Arcade) {
      ready = true;
      if (window.parent !== window) {
        uncertain = true; error = 'Arcade could not load. Reload the game to reconnect.';
      }
      game.render(); return;
    }
    let context;
    try { context = await window.Arcade.ready(); }
    catch { context = { offline: true }; }
    ready = true;
    if (!context.match) {
      // An embedded shell that cannot initialize must not pretend to be a local match.
      if (context.offline && window.parent !== window) {
        uncertain = true; error = 'Arcade could not connect. Reload the game to reconnect.';
      }
      game.render(); return;
    }
    match = clone(context.match); version = match.version;
    window.Arcade.match.onChange(incoming => {
      if (incoming.version <= version) return;
      uncertain = false; error = '';
      accept(incoming);
      startBoard();
    });
    if (match.state) accept(match, true);
    else { game.fresh(); startBoard(); }
    game.render();
  }
  function startBoard() {
    if (!match || match.state || match.status !== 'active' || match.you !== 0 || saving) return;
    acknowledged = ''; game.fresh(); changed(); decorate();
  }
  function playerForView(state) {
    return match ? (match.you === null ? null : state.players[match.you]) : state.players[state.turnIndex];
  }
  function playerName(seat) { return match?.players[seat]?.name || ''; }
  function openAuction(auction, state) {
    auction.passed = [];
    const eligible = state.players.filter(p => p.id !== auction.seller && !p.bankrupt);
    auction.actor = eligible.find(p => p.id >= state.turnIndex)?.id ?? eligible[0]?.id ?? null;
  }
  function advanceAuction(auction, state) {
    const available = state.players.filter(p => p.id !== auction.seller && !p.bankrupt &&
      !auction.passed.includes(p.id) && p.id !== auction.bidder);
    const next = [1, 2, 3, 4].map(n => (auction.actor + n) % 4).find(id => available.some(p => p.id === id));
    auction.actor = next ?? null;
  }
  window.CrownsArcade = {
    bind, changed, decorate, canAct, allowed, snapshot, actor, playerForView, playerName,
    openAuction, advanceAuction,
    get online() { return !!match; },
    get connecting() { return !ready; },
    get failed() { return uncertain; }
  };
})();
