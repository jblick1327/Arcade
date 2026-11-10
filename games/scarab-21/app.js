(function () {
  'use strict';

  const { newGame, play, preview, total } = window.Scarab21;
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
  let game;
  let badge;

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
    window.ScarabAudio?.play(cue);
  }

  const lanes = Array.from({ length: 5 }, (_, index) => {
    const lane = element('div', 'lane');
    const button = element('button', 'place');
    const forecast = element('span', 'preview');
    const pile = element('div', 'pile');
    const sum = element('div', 'sum');
    button.type = 'button';
    button.addEventListener('click', () => place(index));
    button.append(element('span', 'place-key', `▾ ${index + 1}`), forecast);
    lane.append(button, pile, sum);
    columns.append(lane);
    return { lane, button, forecast, pile, sum };
  });

  function render() {
    score.textContent = game.score;
    remaining.textContent = game.deck.length;
    current.replaceChildren(cardFace(game.card));
    for (const [index, { button, forecast, pile, sum }] of lanes.entries()) {
      const cards = game.columns[index];
      const value = total(cards);
      const { value: next, legal, clear } = preview(game, index);
      button.disabled = game.over || !legal;
      button.dataset.result = !legal ? 'bust' : clear || 'fits';
      forecast.textContent = !legal ? 'Would bust' : clear === 'board' ? 'Board clears'
        : clear === 'column' ? `${next} · clears` : `${value} → ${next}`;
      const description = !legal ? 'would bust' : clear === 'board' ? 'would clear the board'
        : `would total ${next}${clear === 'column' ? ' and clear' : ''}`;
      button.setAttribute('aria-label', `Column ${index + 1}, total ${value}, ${description}`);
      pile.replaceChildren(...cards.map(cardFace));
      sum.textContent = value || '–';
    }
    again.hidden = !game.over;
  }

  function showClear(index, clear, message) {
    badge?.remove();
    if (reducedMotion.matches) return;
    const wholeBoard = clear === 'board';
    const nextBadge = element('span', wholeBoard ? 'clear-award board-award' : 'clear-award', message);
    nextBadge.setAttribute('aria-hidden', 'true');
    (wholeBoard ? board : lanes[index].lane).append(nextBadge);
    nextBadge.addEventListener('animationend', () => nextBadge.remove(), { once: true });
    badge = nextBadge;
  }

  async function submit(finishedGame) {
    const result = await window.Arcade?.submitScore(finishedGame.score);
    if (game !== finishedGame) return;
    if (result?.ok && !result.offline) status.textContent = 'Score saved.';
    else if (result?.reason === 'guest') status.textContent = 'Log in to save scores.';
    else if (!result || result.offline) status.textContent = 'Offline play.';
    else status.textContent = 'Could not save score.';
  }

  function place(index) {
    const clear = preview(game, index)?.clear;
    const awards = play(game, index);
    if (!awards) return;

    const messages = awards.map(([label, points]) => `${label} +${points}`);
    render();
    award.textContent = messages.join(' · ') || (game.over ? '' : 'Choose a column for the draw.');
    if (clear) showClear(index, clear, messages[0]);
    sound(game.over ? 'end' : clear || 'place');

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
    badge?.remove();
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
  soundToggle.addEventListener('click', () => {
    const muted = window.ScarabAudio?.toggleMute();
    soundToggle.textContent = muted ? 'Unmute sound' : 'Mute sound';
  });

  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || !/^[1-5]$/.test(event.key)) return;
    place(Number(event.key) - 1);
  });

  start();
})();
