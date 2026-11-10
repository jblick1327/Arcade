(function () {
  'use strict';

  const { canPlay, newGame, play, total } = window.Scarab21;
  const symbols = { spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' };
  const faces = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
  const score = document.getElementById('score');
  const remaining = document.getElementById('remaining');
  const current = document.getElementById('current');
  const award = document.getElementById('award');
  const result = document.getElementById('result');
  const status = document.getElementById('status');
  const again = document.getElementById('again');
  const board = document.getElementById('board');
  const columns = document.getElementById('columns');
  const soundToggle = document.getElementById('sound');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let game, soundPlayer;
  let resolving = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function cardName({ rank, suit }) {
    return `${faces[rank] || rank} of ${suit}`;
  }

  function cardFace(card) {
    const { rank, suit } = card;
    const red = suit === 'hearts' || suit === 'diamonds';
    const node = element('span', red ? 'card red' : 'card');
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', cardName(card));
    node.append(
      element('span', 'card-corner', `${rank} ${symbols[suit]}`),
      element('span', 'card-suit', symbols[suit]),
    );
    return node;
  }

  function sound(cue) {
    if (!soundToggle.checked) return;
    soundPlayer ??= new Audio();
    soundPlayer.src = `sounds/${cue}.wav`;
    soundPlayer.play().catch(() => {});
  }

  const lanes = Array.from({ length: 5 }, (_, index) => {
    const lane = element('div', 'lane');
    const button = element('button', 'place');
    const preview = element('span', 'preview');
    const pile = element('div', 'pile');
    const sum = element('div', 'sum');
    button.type = 'button';
    button.addEventListener('click', () => place(index));
    button.append(element('span', 'place-key', `▾ ${index + 1}`), preview);
    lane.append(button, pile, sum);
    columns.append(lane);
    return { lane, button, preview, pile, sum };
  });

  function render() {
    score.textContent = game.score;
    remaining.textContent = game.deck.length;
    current.replaceChildren(cardFace(game.card));
    for (const [index, { button, preview, pile, sum }] of lanes.entries()) {
      const cards = game.columns[index];
      const value = total(cards);
      const fits = canPlay(cards, game.card);
      const nextTotal = total([...cards, game.card]);
      const clears = fits && (nextTotal === 21 || cards.length === 4);
      button.disabled = game.over || !fits;
      button.dataset.result = !fits ? 'bust' : clears ? 'clear' : 'fits';
      preview.textContent = !fits ? 'Would bust' : clears ? `${nextTotal} · clears` : `${value} → ${nextTotal}`;
      const forecast = fits ? `would total ${nextTotal}${clears ? ' and clear' : ''}` : 'would bust';
      button.setAttribute('aria-label', `Column ${index + 1}, total ${value}, ${forecast}`);
      pile.replaceChildren(...cards.map(cardFace));
      sum.textContent = value || '–';
    }
    again.hidden = !game.over;
  }

  async function showClear(index, wholeBoard, drawn, message) {
    const { lane, pile } = lanes[index];
    const badge = element('span', wholeBoard ? 'clear-award board-award' : 'clear-award', message);
    badge.setAttribute('aria-hidden', 'true');
    pile.append(cardFace(drawn));
    (wholeBoard ? board : lane).append(badge);

    const animation = wholeBoard
      ? columns.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.45)' }, { opacity: 0.25 }], { duration: 430 })
      : pile.animate([{ opacity: 1 }, { opacity: 0.25, transform: 'translateY(-6px)' }], { duration: 320, easing: 'ease-out' });
    await animation.finished.catch(() => {});
    badge.remove();
  }

  async function submit(finishedGame) {
    const result = await window.Arcade?.submitScore(finishedGame.score);
    if (game !== finishedGame) return;
    if (result?.ok && !result.offline) status.textContent = 'Score saved.';
    else if (result?.reason === 'guest') status.textContent = 'Log in to save scores.';
    else if (!result || result.offline) status.textContent = 'Offline play.';
    else status.textContent = 'Could not save score.';
  }

  async function place(index) {
    if (resolving) return;
    const drawn = game.card;
    const hadOtherCards = game.columns.some((pile, lane) => lane !== index && pile.length > 0);
    const awards = play(game, index);
    if (!awards) return;

    const messages = awards.map(([label, points]) => `${label} +${points}`);
    const cleared = game.columns[index].length === 0;
    const wholeBoard = cleared && hadOtherCards && game.columns.every((pile) => pile.length === 0);
    sound(wholeBoard ? 'board-clear' : cleared ? 'column-clear' : 'place');
    if (cleared && !reducedMotion.matches) {
      resolving = true;
      board.setAttribute('aria-busy', 'true');
      await showClear(index, wholeBoard, drawn, messages[0]);
      board.removeAttribute('aria-busy');
      resolving = false;
    }
    render();
    award.textContent = messages.join(' · ') || (game.over ? '' : 'Choose a column for the draw.');

    if (game.over) {
      result.textContent = `Final score ${game.score}. No column can take the ${cardName(game.card)}.`;
      result.hidden = false;
      status.textContent = 'Saving score…';
      again.focus();
      submit(game);
    } else {
      status.textContent = `Draw: ${cardName(game.card)}.`;
      if (document.activeElement === document.body) lanes.find(({ button }) => !button.disabled).button.focus();
    }
  }

  function start() {
    game = newGame();
    render();
    result.hidden = true;
    award.textContent = 'Choose a column for the draw.';
    status.textContent = `Draw: ${cardName(game.card)}.`;
  }

  again.addEventListener('click', () => {
    start();
    lanes[0].button.focus();
  });
  soundToggle.addEventListener('change', () => {
    if (soundToggle.checked) sound('place');
    else soundPlayer?.pause();
  });

  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || !/^[1-5]$/.test(event.key)) return;
    place(Number(event.key) - 1);
  });

  start();
})();
