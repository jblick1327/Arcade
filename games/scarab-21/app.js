(function () {
  'use strict';

  const { canPlay, newGame, play, total } = window.Scarab21;
  const symbols = { spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' };
  const faces = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
  const score = document.getElementById('score');
  const remaining = document.getElementById('remaining');
  const current = document.getElementById('current');
  const award = document.getElementById('award');
  const status = document.getElementById('status');
  const again = document.getElementById('again');
  const columns = document.getElementById('columns');
  let game;

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

  const lanes = Array.from({ length: 5 }, (_, index) => {
    const lane = element('div', 'lane');
    const button = element('button', 'place', `▾ ${index + 1}`);
    const pile = element('div', 'pile');
    const sum = element('div', 'sum');
    button.type = 'button';
    button.addEventListener('click', () => place(index));
    lane.append(button, pile, sum);
    columns.append(lane);
    return { button, pile, sum };
  });

  function render() {
    score.textContent = game.score;
    remaining.textContent = game.deck.length;
    current.replaceChildren(cardFace(game.card));
    for (const [index, { button, pile, sum }] of lanes.entries()) {
      const cards = game.columns[index];
      const value = total(cards);
      button.disabled = game.over || !canPlay(cards, game.card);
      button.setAttribute('aria-label', `Place in column ${index + 1}, total ${value}`);
      pile.replaceChildren(...cards.map(cardFace));
      sum.textContent = value || '–';
    }
    again.hidden = !game.over;
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
    const awards = play(game, index);
    if (!awards) return;

    render();
    const messages = awards.map(([label, points]) => `${label} +${points}`);
    if (game.over) messages.push('No moves.');
    award.textContent = messages.join(' · ') || 'Place the draw.';

    if (game.over) {
      status.textContent = 'Game over.';
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
    award.textContent = 'Place the draw.';
    status.textContent = `Draw: ${cardName(game.card)}.`;
  }

  again.addEventListener('click', () => {
    start();
    lanes[0].button.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || !/^[1-5]$/.test(event.key)) return;
    place(Number(event.key) - 1);
  });

  start();
})();
