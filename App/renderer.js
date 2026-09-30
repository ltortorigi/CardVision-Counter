const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const suits = ['♥','♦','♣','♠','?'];

const state = {
  decks: 6,
  history: [],
  dealer: [],
  dealerHistory: [],
  players: Array.from({ length: 7 }, () => []),
  target: 'player1',
  mySeat: 1,
  pendingRank: null,
  stream: null,
  scanning: false,
  scanTimer: null,
  scanBusy: false,
  emptyScans: 0,
  seenByHand: new Map(),
  rules: { soft17: 'H17' }
};

const $ = id => document.getElementById(id);
const video = $('screenVideo');
const overlay = $('overlayCanvas');
const capture = $('captureCanvas');

function hilo(rank) {
  // Hi-Lo tags:
  // 2–6 = +1, 7–9 = 0, 10/J/Q/K/A = -1
  if (['2','3','4','5','6'].includes(rank)) return 1;
  if (['7','8','9'].includes(rank)) return 0;
  if (['10','J','Q','K','A'].includes(rank)) return -1;
  return 0;
}

function cardValue(rank) {
  if (rank === 'A') return 11;
  if (['10','J','Q','K'].includes(rank)) return 10;
  return Number(rank) || 0;
}

function handInfo(hand) {
  let total = hand.reduce((sum, card) => sum + cardValue(card.rank), 0);
  let aces = hand.filter(card => card.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return {
    total,
    soft: aces > 0,
    pairValue: hand.length === 2 && cardValue(hand[0].rank) === cardValue(hand[1].rank)
      ? cardValue(hand[0].rank)
      : null,
    blackjack: hand.length === 2 && total === 21
  };
}

function targetArray() {
  if (state.target === 'dealer') return state.dealer;
  return state.players[Number(state.target.replace('player','')) - 1];
}

function cardKey(card) {
  return card.rank;
}

function renderCard(card, tiny = false) {
  const cls = ['♥','♦'].includes(card.suit)
    ? 'red'
    : ['♣','♠'].includes(card.suit)
      ? 'black'
      : 'unknown';

  return `<div class="play-card ${cls}${tiny ? ' tiny' : ''}" title="${card.source || 'detected'}">
    <div class="rank">${card.rank}${card.suit === '?' ? '' : card.suit}</div>
    <div class="suit">${card.suit}</div>
    <div class="mini">${card.rank}</div>
  </div>`;
}

function cardsLabel(hand) {
  return hand.length
    ? hand.map(card => `${card.rank}${card.suit === '?' ? '' : card.suit}`).join(' ')
    : '—';
}

function dealerUpValue() {
  return state.dealer.length ? cardValue(state.dealer[0].rank) : null;
}

function baseRecommendation(hand, dealerValue) {
  if (!hand.length || !dealerValue) {
    return { action: 'WAITING', reason: 'Need your hand and the dealer up-card.' };
  }

  const info = handInfo(hand);
  const twoCards = hand.length === 2;
  const h17 = state.rules.soft17 === 'H17';

  if (info.blackjack) return { action: 'STAND', reason: 'Blackjack.' };
  if (info.total > 21) return { action: 'BUST', reason: `Hand total is ${info.total}.` };
  if (info.total === 21) return { action: 'STAND', reason: 'You already have 21.' };

  if (twoCards && info.pairValue !== null) {
    const pair = info.pairValue;

    if (pair === 11) return { action: 'SPLIT', reason: 'Always split Aces.' };
    if (pair === 8) {
      if (h17 && dealerValue === 11) return { action: 'SURRENDER', reason: 'H17 late-surrender exception: 8,8 vs Ace.' };
      return { action: 'SPLIT', reason: 'Always split 8s.' };
    }
    if (pair === 10) return { action: 'STAND', reason: 'Basic strategy: keep 20 together.' };
    if (pair === 9) return { action: [2,3,4,5,6,8,9].includes(dealerValue) ? 'SPLIT' : 'STAND', reason: 'Basic pair strategy for 9s.' };
    if (pair === 7) return { action: dealerValue >= 2 && dealerValue <= 7 ? 'SPLIT' : 'HIT', reason: 'Basic pair strategy for 7s.' };
    if (pair === 6) return { action: dealerValue >= 2 && dealerValue <= 6 ? 'SPLIT' : 'HIT', reason: 'DAS basic pair strategy for 6s.' };
    if (pair === 4) return { action: [5,6].includes(dealerValue) ? 'SPLIT' : 'HIT', reason: 'DAS basic pair strategy for 4s.' };
    if (pair === 3 || pair === 2) return { action: dealerValue >= 2 && dealerValue <= 7 ? 'SPLIT' : 'HIT', reason: 'DAS basic pair strategy for small pairs.' };
  }

  if (twoCards) {
    if (h17 && dealerValue === 11 && (info.total === 15 || info.total === 17)) {
      return { action: 'SURRENDER', reason: `H17 basic strategy: surrender ${info.total} vs Ace.` };
    }
    if (info.total === 16 && [9,10,11].includes(dealerValue)) {
      return { action: 'SURRENDER', reason: 'Basic strategy: surrender hard 16 vs 9, 10, or Ace.' };
    }
    if (info.total === 15 && dealerValue === 10) {
      return { action: 'SURRENDER', reason: 'Basic strategy: surrender hard 15 vs 10.' };
    }
  }

  if (info.soft) {
    if (info.total >= 20) return { action: 'STAND', reason: `Stand on soft ${info.total}.` };

    if (info.total === 19) {
      if (h17 && dealerValue === 6 && twoCards) return { action: 'DOUBLE DOWN', reason: 'H17 basic strategy: double soft 19 vs 6.' };
      return { action: 'STAND', reason: 'Stand on soft 19.' };
    }

    if (info.total === 18) {
      if (h17 && dealerValue === 2 && twoCards) return { action: 'DOUBLE DOWN', reason: 'H17 basic strategy: double soft 18 vs 2.' };
      if ([3,4,5,6].includes(dealerValue)) {
        return { action: twoCards ? 'DOUBLE DOWN' : 'STAND', reason: 'Soft 18 basic strategy vs 3–6.' };
      }
      if ([2,7,8].includes(dealerValue)) return { action: 'STAND', reason: 'Stand on soft 18 here.' };
      return { action: 'HIT', reason: 'Hit soft 18 vs 9, 10, or Ace.' };
    }

    if (info.total === 17) return { action: [3,4,5,6].includes(dealerValue) && twoCards ? 'DOUBLE DOWN' : 'HIT', reason: 'Soft 17 basic strategy.' };
    if ([15,16].includes(info.total)) return { action: [4,5,6].includes(dealerValue) && twoCards ? 'DOUBLE DOWN' : 'HIT', reason: `Soft ${info.total} basic strategy.` };
    if ([13,14].includes(info.total)) return { action: [5,6].includes(dealerValue) && twoCards ? 'DOUBLE DOWN' : 'HIT', reason: `Soft ${info.total} basic strategy.` };

    return { action: 'HIT', reason: `Hit soft ${info.total}.` };
  }

  if (info.total >= 17) return { action: 'STAND', reason: `Stand on hard ${info.total}.` };
  if (info.total >= 13) return { action: dealerValue >= 2 && dealerValue <= 6 ? 'STAND' : 'HIT', reason: `Hard ${info.total} basic strategy.` };
  if (info.total === 12) return { action: [4,5,6].includes(dealerValue) ? 'STAND' : 'HIT', reason: 'Hard 12 basic strategy.' };

  if (info.total === 11) {
    if (dealerValue === 11 && !h17) return { action: 'HIT', reason: 'S17 basic strategy: hit 11 vs Ace.' };
    return { action: twoCards ? 'DOUBLE DOWN' : 'HIT', reason: 'Hard 11 basic strategy.' };
  }

  if (info.total === 10) return { action: dealerValue <= 9 && twoCards ? 'DOUBLE DOWN' : 'HIT', reason: 'Hard 10 basic strategy.' };
  if (info.total === 9) return { action: [3,4,5,6].includes(dealerValue) && twoCards ? 'DOUBLE DOWN' : 'HIT', reason: 'Hard 9 basic strategy.' };

  return { action: 'HIT', reason: `Hit hard ${info.total}.` };
}

function applyHiLoDeviation(hand, dealerValue, trueCount, runningCount, base) {
  const info = handInfo(hand);
  const twoCards = hand.length === 2;
  const h17 = state.rules.soft17 === 'H17';

  const dev = (action, indexText, detail) => ({
    action,
    reason: `Count deviation (${indexText}): ${detail}`,
    adjusted: true,
    baseAction: base.action
  });

  // ----- Pair deviations -----
  // 10,10: split only at high positive true counts.
  if (twoCards && info.pairValue === 10) {
    if (dealerValue === 4 && trueCount >= 6) return dev('SPLIT', 'TC ≥ +6', 'split 10s vs 4.');
    if (dealerValue === 5 && trueCount >= 5) return dev('SPLIT', 'TC ≥ +5', 'split 10s vs 5.');
    if (dealerValue === 6 && trueCount >= 4) return dev('SPLIT', 'TC ≥ +4', 'split 10s vs 6.');
  }

  // ----- Soft-total deviations -----
  if (info.soft && twoCards && info.total === 19) {
    // A,8
    if (dealerValue === 4 && trueCount >= 3) return dev('DOUBLE DOWN', 'TC ≥ +3', 'double A,8 vs 4.');
    if (dealerValue === 5 && trueCount >= 1) return dev('DOUBLE DOWN', 'TC ≥ +1', 'double A,8 vs 5.');

    if (dealerValue === 6) {
      if (h17) {
        // H17 chart uses 0-: at a negative running count, stand instead of doubling.
        if (runningCount < 0) return dev('STAND', 'negative running count', 'stand A,8 vs 6 instead of doubling.');
      } else if (trueCount >= 1) {
        return dev('DOUBLE DOWN', 'TC ≥ +1', 'double A,8 vs 6 in S17.');
      }
    }
  }

  if (info.soft && twoCards && info.total === 17 && dealerValue === 2 && trueCount >= 1) {
    return dev('DOUBLE DOWN', 'TC ≥ +1', 'double A,6 vs 2.');
  }

  // ----- Hard-total deviations -----
  if (!info.soft) {
    // Illustrious-18 / high-value Hi-Lo deviations.
    if (info.total === 16 && dealerValue === 10 && trueCount >= 0) {
      return dev('STAND', 'TC ≥ 0', 'stand hard 16 vs 10.');
    }
    if (info.total === 16 && dealerValue === 9 && trueCount >= 4) {
      return dev('STAND', 'TC ≥ +4', 'stand hard 16 vs 9.');
    }
    if (info.total === 16 && dealerValue === 11 && h17 && trueCount >= 3) {
      return dev('STAND', 'TC ≥ +3', 'stand hard 16 vs Ace in H17.');
    }
    if (info.total === 15 && dealerValue === 10 && trueCount >= 4) {
      return dev('STAND', 'TC ≥ +4', 'stand hard 15 vs 10 when not surrendering.');
    }
    if (info.total === 15 && dealerValue === 11 && h17 && trueCount >= 5) {
      return dev('STAND', 'TC ≥ +5', 'stand hard 15 vs Ace in H17 when not surrendering.');
    }

    if (info.total === 13 && dealerValue === 2 && trueCount <= -1) {
      return dev('HIT', 'TC ≤ -1', 'hit hard 13 vs 2.');
    }

    if (info.total === 12 && dealerValue === 2 && trueCount >= 3) {
      return dev('STAND', 'TC ≥ +3', 'stand hard 12 vs 2.');
    }
    if (info.total === 12 && dealerValue === 3 && trueCount >= 2) {
      return dev('STAND', 'TC ≥ +2', 'stand hard 12 vs 3.');
    }
    if (info.total === 12 && dealerValue === 4 && runningCount < 0) {
      return dev('HIT', 'negative running count', 'hit hard 12 vs 4.');
    }
    if (info.total === 12 && dealerValue === 5 && trueCount <= -2) {
      return dev('HIT', 'TC ≤ -2', 'hit hard 12 vs 5.');
    }
    if (info.total === 12 && dealerValue === 6 && trueCount <= -1) {
      return dev('HIT', 'TC ≤ -1', 'hit hard 12 vs 6.');
    }

    if (info.total === 11 && dealerValue === 11 && !h17 && twoCards && trueCount >= 1) {
      return dev('DOUBLE DOWN', 'TC ≥ +1', 'double hard 11 vs Ace in S17.');
    }

    if (info.total === 10 && dealerValue === 10 && twoCards && trueCount >= 4) {
      return dev('DOUBLE DOWN', 'TC ≥ +4', 'double hard 10 vs 10.');
    }
    if (info.total === 10 && dealerValue === 11 && twoCards) {
      const threshold = h17 ? 3 : 4;
      if (trueCount >= threshold) {
        return dev('DOUBLE DOWN', `TC ≥ +${threshold}`, `double hard 10 vs Ace in ${h17 ? 'H17' : 'S17'}.`);
      }
    }

    if (info.total === 9 && dealerValue === 2 && twoCards && trueCount >= 1) {
      return dev('DOUBLE DOWN', 'TC ≥ +1', 'double hard 9 vs 2.');
    }
    if (info.total === 9 && dealerValue === 7 && twoCards && trueCount >= 3) {
      return dev('DOUBLE DOWN', 'TC ≥ +3', 'double hard 9 vs 7.');
    }
    if (info.total === 8 && dealerValue === 6 && twoCards && trueCount >= 2) {
      return dev('DOUBLE DOWN', 'TC ≥ +2', 'double hard 8 vs 6.');
    }
  }

  // ----- Fab-4 surrender deviations -----
  // Apply these before accepting the basic-strategy result when the count crosses the index.
  if (!info.soft && twoCards) {
    if (info.total === 14 && dealerValue === 10 && trueCount >= 3) {
      return dev('SURRENDER', 'TC ≥ +3', 'surrender hard 14 vs 10.');
    }
    if (info.total === 15 && dealerValue === 10) {
      if (trueCount >= 0) return dev('SURRENDER', 'TC ≥ 0', 'surrender hard 15 vs 10.');
      if (base.action === 'SURRENDER') return dev('HIT', 'TC < 0', 'hit hard 15 vs 10 below the surrender index.');
    }
    if (info.total === 15 && dealerValue === 9 && trueCount >= 2) {
      return dev('SURRENDER', 'TC ≥ +2', 'surrender hard 15 vs 9.');
    }
    if (info.total === 15 && dealerValue === 11 && trueCount >= 1) {
      return dev('SURRENDER', 'TC ≥ +1', 'surrender hard 15 vs Ace.');
    }
  }

  return {
    action: base.action,
    reason: base.reason,
    adjusted: false,
    baseAction: base.action
  };
}

function recommendMove(hand, dealerValue, trueCount, runningCount) {
  const base = baseRecommendation(hand, dealerValue);
  if (base.action === 'WAITING' || base.action === 'BUST') {
    return { ...base, adjusted: false, baseAction: base.action };
  }
  return applyHiLoDeviation(hand, dealerValue, trueCount, runningCount, base);
}


function dealerHandSignature(hand) {
  return hand.map(card => `${card.rank}${card.suit || '?'}`).join('|');
}

function dealerOutcomeLabel(hand) {
  const info = handInfo(hand);
  if (!hand.length) return '';
  if (info.blackjack) return 'Blackjack';
  if (info.total > 21) return `Bust ${info.total}`;
  return `Total ${info.total}`;
}

function saveDealerHandToHistory() {
  if (!state.dealer.length) return;

  const snapshot = state.dealer.map(card => ({
    rank: card.rank,
    suit: card.suit || '?',
    source: card.source || 'screen'
  }));

  const signature = dealerHandSignature(snapshot);
  const newest = state.dealerHistory[0];

  // Avoid recording the exact same finished dealer hand more than once.
  if (newest && newest.signature === signature) return;

  state.dealerHistory.unshift({
    signature,
    cards: snapshot,
    total: handInfo(snapshot).total,
    outcome: dealerOutcomeLabel(snapshot),
    time: Date.now()
  });

  // Keep enough history to be useful while preserving the no-scroll layout.
  state.dealerHistory = state.dealerHistory.slice(0, 12);
}

function renderDealerHistory() {
  const list = $('dealerHistoryList');
  if (!list) return;

  if (!state.dealerHistory.length) {
    list.innerHTML = '<span class="empty">No completed dealer hands yet</span>';
    return;
  }

  list.innerHTML = state.dealerHistory.slice(0, 8).map((entry, index) => {
    const hand = entry.cards
      .map(card => `${card.rank}${card.suit === '?' ? '' : card.suit}`)
      .join(' ');

    return `<div class="dealer-history-item" title="${hand}">
      <div class="round"><span>${index === 0 ? 'Latest' : `-${index}`}</span><b>${entry.total}</b></div>
      <div class="history-hand">${hand}</div>
      <div class="history-result">${entry.outcome}</div>
    </div>`;
  }).join('');
}

function render() {
  const running = state.history.reduce((sum, card) => sum + hilo(card.rank), 0);
  const decksLeft = Math.max(0.25, state.decks - state.history.length / 52);
  const trueCount = running / decksLeft;
  const bet = betRecommendation(trueCount);

  $('runningCount').textContent = running > 0 ? `+${running}` : String(running);
  $('trueCount').textContent = `${trueCount > 0 ? '+' : ''}${trueCount.toFixed(1)}`;
  $('cardsSeen').textContent = state.history.length;
  $('decksLeft').textContent = decksLeft.toFixed(1);

  if ($('betSignal')) {
    $('betSignal').textContent = bet.signal;
    $('betAdvice').textContent = bet.label;
    $('betUnits').textContent = `${bet.units} ${bet.units === 1 ? 'unit' : 'units'}`;
    $('betReason').textContent = `${bet.reason} Use this before the next hand.`;
    const betStat = $('betStat');
    betStat.classList.remove('bet-more', 'bet-max');
    if (bet.units >= 6) betStat.classList.add('bet-max');
    else if (bet.units >= 2) betStat.classList.add('bet-more');
  }

  $('dealerCards').innerHTML = state.dealer.length
    ? state.dealer.map(card => renderCard(card, true)).join('')
    : '<span class="empty">No dealer card</span>';
  $('dealerTotal').textContent = handInfo(state.dealer).total;
  if ($('youSeatLabel')) $('youSeatLabel').textContent = `Player ${state.mySeat}`;
  renderDealerHistory();

  $('playersGrid').innerHTML = state.players.map((hand, index) => {
    const player = index + 1;
    return `<div class="player-row ${state.mySeat === player ? 'you' : ''}" data-player="${player}">
      <div>
        <div class="player-name">Player ${player}</div>
        <div class="player-total">${hand.length ? `Total ${handInfo(hand).total}` : 'Empty'}</div>
      </div>
      <div class="cards compact">${hand.length ? hand.map(card => renderCard(card, true)).join('') : '<span class="empty">—</span>'}</div>
    </div>`;
  }).join('');

  document.querySelectorAll('.player-row').forEach(row => {
    row.addEventListener('click', () => {
      state.mySeat = Number(row.dataset.player);
      $('mySeat').value = String(state.mySeat);
      state.target = `player${state.mySeat}`;
      $('targetSelect').value = state.target;
      render();
    });
  });

  const rankTotals = new Map(ranks.map(rank => [rank, 0]));
  state.history.forEach(card => rankTotals.set(card.rank, (rankTotals.get(card.rank) || 0) + 1));
  $('rankCounts').innerHTML = ranks.map(rank => `<span>${rank}: ${rankTotals.get(rank)}</span>`).join('');

  const recent = state.history.slice(-22).reverse();
  $('historyCards').innerHTML = recent.length
    ? recent.map(card => renderCard(card, true)).join('')
    : '<span class="empty">No cards counted yet</span>';

  $('activeTargetLabel').textContent = `Target: ${state.target === 'dealer' ? 'Dealer' : state.target.replace('player','Player ')}`;

  const myHand = state.players[state.mySeat - 1];
  const moveResult = recommendMove(myHand, dealerUpValue(), trueCount, running);
  $('recommendedMove').textContent = moveResult.action;
  $('recommendationReason').textContent = moveResult.reason;
  $('strategyHand').textContent = cardsLabel(myHand);
  $('strategyDealer').textContent = state.dealer.length ? `${state.dealer[0].rank}${state.dealer[0].suit === '?' ? '' : state.dealer[0].suit}` : '—';
  document.querySelector('.move-panel').dataset.action = moveResult.action;

  const mode = $('strategyMode');
  if (mode) {
    mode.textContent = moveResult.adjusted
      ? `Count-adjusted • basic was ${moveResult.baseAction}`
      : 'Basic strategy • no count deviation';
    mode.classList.toggle('count-adjusted', Boolean(moveResult.adjusted));
  }
}

function resetRoundTracking() {
  state.seenByHand = new Map();
  state.emptyScans = 0;
}

function countRanks(hand) {
  const map = new Map();
  hand.forEach(card => map.set(card.rank, (map.get(card.rank) || 0) + 1));
  return map;
}

function addFreshCardsFromHand(handKey, currentHand) {
  const current = countRanks(currentHand);
  const previous = state.seenByHand.get(handKey) || new Map();

  for (const [rank, count] of current.entries()) {
    const seen = previous.get(rank) || 0;
    const freshCount = Math.max(0, count - seen);

    for (let i = 0; i < freshCount; i += 1) {
      const candidates = currentHand.filter(card => card.rank === rank);
      const sourceCard = candidates[Math.min(seen + i, candidates.length - 1)] || { rank, suit: '?' };
      state.history.push({ ...sourceCard, source: 'screen', time: Date.now() });
    }

    previous.set(rank, Math.max(seen, count));
  }

  state.seenByHand.set(handKey, previous);
}

function normalizeOcrRank(text, holes) {
  let cleaned = String(text || '').toUpperCase().replace(/[^0-9AJQK]/g, '');
  if (!cleaned) return null;

  if (cleaned.includes('10')) return '10';
  let rank = cleaned[0];

  if (rank === '1' && cleaned.length >= 2 && cleaned[1] === '0') rank = '10';
  if (rank === '6' && holes >= 2) rank = '8';
  if (rank === '8' && holes === 1) rank = '6';

  return ranks.includes(rank) ? rank : null;
}

function inferSuitFromRegion(ctx, x, y, w, h) {
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  w = Math.max(2, Math.floor(w));
  h = Math.max(2, Math.floor(h));

  const image = ctx.getImageData(x, y, w, h);
  const { data } = image;
  const mask = new Uint8Array(w * h);
  let redPixels = 0;
  let inkPixels = 0;

  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const i = (py * w + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const red = r > 120 && r > g * 1.25 && r > b * 1.25;
      const dark = r < 170 && g < 170 && b < 170;

      if (red || dark) {
        mask[py * w + px] = 1;
        inkPixels += 1;
        if (red) redPixels += 1;
      }
    }
  }

  if (inkPixels < 8) return '?';

  const comps = smallComponents(mask, w, h)
    .filter(c => c.area >= 4 && c.h >= 4 && c.w >= 3 && c.w / c.h < 3)
    .sort((a, b) => b.area - a.area);

  if (!comps.length) return '?';

  const c = comps[0];
  const normalizedRows = new Array(32).fill(0);

  for (let ny = 0; ny < 32; ny += 1) {
    const sy = Math.min(c.h - 1, Math.floor(ny * c.h / 32));
    let count = 0;

    for (let nx = 0; nx < 32; nx += 1) {
      const sx = Math.min(c.w - 1, Math.floor(nx * c.w / 32));
      const srcX = c.x + sx;
      const srcY = c.y + sy;
      if (mask[srcY * w + srcX]) count += 1;
    }

    normalizedRows[ny] = count;
  }

  const avg = arr => arr.reduce((sum, n) => sum + n, 0) / Math.max(1, arr.length);
  const redRatio = redPixels / inkPixels;

  if (redRatio > 0.5) {
    const firstEight = avg(normalizedRows.slice(0, 8));
    return firstEight > 12 ? '♥' : '♦';
  }

  const topHalfMax = Math.max(...normalizedRows.slice(0, 16));
  return topHalfMax >= 27 ? '♠' : '♣';
}

function smallComponents(mask, w, h) {
  const components = [];
  const queue = new Int32Array(w * h);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const start = y * w + x;
      if (mask[start] !== 1) continue;

      let head = 0, tail = 0;
      queue[tail++] = start;
      mask[start] = 2;

      let minX = x, maxX = x, minY = y, maxY = y, area = 0;

      while (head < tail) {
        const idx = queue[head++];
        const px = idx % w;
        const py = Math.floor(idx / w);
        area += 1;

        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);

        const neighbors = [idx - 1, idx + 1, idx - w, idx + w];
        for (const next of neighbors) {
          if (next < 0 || next >= mask.length || mask[next] !== 1) continue;
          const nx = next % w;
          const ny = Math.floor(next / w);
          if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) continue;
          mask[next] = 2;
          queue[tail++] = next;
        }
      }

      components.push({
        x: minX, y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        area
      });
    }
  }

  return components;
}

function detectWhiteCardGroups(ctx, w, h) {
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const mask = new Uint8Array(w * h);

  // Tuned from the SportsBetting screenshots supplied by the user.
  //
  // IMPORTANT:
  // The enlarged "Seat #" card display on the LEFT SIDEBAR is a duplicate
  // of a player's real cards and MUST NOT be counted.
  //
  // We therefore scan only:
  //   1) the central table area where the seven real player hands appear
  //   2) the lower-left Dealer panel where the dealer's up-card is shown
  //
  // This intentionally ignores the upper-left Seat panel.
  const playerZone = {
    minX: 0.275,
    maxX: 0.690,
    minY: 0.485,
    maxY: 0.735
  };

  const dealerZone = {
    minX: 0.195,
    maxX: 0.265,
    minY: 0.665,
    maxY: 0.800
  };

  function inAllowedZone(nx, ny) {
    const inPlayers =
      nx >= playerZone.minX && nx <= playerZone.maxX &&
      ny >= playerZone.minY && ny <= playerZone.maxY;

    const inDealer =
      nx >= dealerZone.minX && nx <= dealerZone.maxX &&
      ny >= dealerZone.minY && ny <= dealerZone.maxY;

    return inPlayers || inDealer;
  }

  const minX = Math.floor(w * 0.17);
  const maxX = Math.floor(w * 0.72);
  const minY = Math.floor(h * 0.45);
  const maxY = Math.floor(h * 0.82);

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      const nx = x / w;
      const ny = y / h;
      if (!inAllowedZone(nx, ny)) continue;

      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const neutralWhite = r > 205 && g > 205 && b > 205 &&
        Math.max(r, g, b) - Math.min(r, g, b) < 45;

      if (neutralWhite) mask[y * w + x] = 1;
    }
  }

  return smallComponents(mask, w, h).filter(c => {
    const density = c.area / (c.w * c.h);
    const cx = (c.x + c.w / 2) / w;
    const cy = (c.y + c.h / 2) / h;

    if (!inAllowedZone(cx, cy)) return false;

    return c.w >= w * 0.020 &&
      c.w <= w * 0.085 &&
      c.h >= h * 0.040 &&
      c.h <= h * 0.145 &&
      c.area > w * h * 0.00045 &&
      density > 0.68;
  });
}

function countHoles(mask, w, h) {
  const background = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i += 1) background[i] = mask[i] ? 0 : 1;

  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;

  function enqueue(index) {
    if (index >= 0 && index < background.length && background[index] === 1) {
      background[index] = 2;
      queue[tail++] = index;
    }
  }

  for (let x = 0; x < w; x += 1) {
    enqueue(x);
    enqueue((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    enqueue(y * w);
    enqueue(y * w + (w - 1));
  }

  while (head < tail) {
    const idx = queue[head++];
    const px = idx % w;
    const py = Math.floor(idx / w);
    const neighbors = [idx - 1, idx + 1, idx - w, idx + w];

    for (const next of neighbors) {
      if (next < 0 || next >= background.length || background[next] !== 1) continue;
      const nx = next % w;
      const ny = Math.floor(next / w);
      if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) continue;
      background[next] = 2;
      queue[tail++] = next;
    }
  }

  let holes = 0;
  for (let i = 0; i < background.length; i += 1) {
    if (background[i] !== 1) continue;
    holes += 1;
    head = 0; tail = 0;
    background[i] = 3;
    queue[tail++] = i;

    while (head < tail) {
      const idx = queue[head++];
      const px = idx % w;
      const py = Math.floor(idx / w);
      const neighbors = [idx - 1, idx + 1, idx - w, idx + w];

      for (const next of neighbors) {
        if (next < 0 || next >= background.length || background[next] !== 1) continue;
        const nx = next % w;
        const ny = Math.floor(next / w);
        if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) continue;
        background[next] = 3;
        queue[tail++] = next;
      }
    }
  }

  return holes;
}

function makeGlyphDataUrl(ctx, rect) {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const w = Math.max(3, Math.floor(rect.w));
  const h = Math.max(3, Math.floor(rect.h));

  const image = ctx.getImageData(x, y, w, h);
  const data = image.data;
  const mask = new Uint8Array(w * h);

  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const i = (py * w + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const red = r > 115 && r > g * 1.20 && r > b * 1.20;
      const dark = r < 185 && g < 185 && b < 185;
      if (red || dark) mask[py * w + px] = 1;
    }
  }

  const components = smallComponents(mask.slice(), w, h)
    .filter(c => c.area >= 3 && c.h >= Math.max(4, h * 0.25) && c.w >= 1 && c.w / c.h < 3.5);

  if (!components.length) return null;

  const minX = Math.min(...components.map(c => c.x));
  const minY = Math.min(...components.map(c => c.y));
  const maxX = Math.max(...components.map(c => c.x + c.w));
  const maxY = Math.max(...components.map(c => c.y + c.h));

  const glyphW = Math.max(1, maxX - minX);
  const glyphH = Math.max(1, maxY - minY);
  const padded = document.createElement('canvas');
  padded.width = 120;
  padded.height = 120;
  const pctx = padded.getContext('2d');
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, 120, 120);

  const source = document.createElement('canvas');
  source.width = w;
  source.height = h;
  source.getContext('2d').putImageData(image, 0, 0);

  const scale = Math.min(75 / glyphW, 90 / glyphH);
  const drawW = glyphW * scale;
  const drawH = glyphH * scale;

  pctx.imageSmoothingEnabled = true;
  pctx.drawImage(
    source,
    minX, minY, glyphW, glyphH,
    (120 - drawW) / 2, (120 - drawH) / 2, drawW, drawH
  );

  const tightMask = new Uint8Array(glyphW * glyphH);
  for (let py = 0; py < glyphH; py += 1) {
    for (let px = 0; px < glyphW; px += 1) {
      tightMask[py * glyphW + px] = mask[(minY + py) * w + (minX + px)];
    }
  }

  return {
    dataUrl: padded.toDataURL('image/png'),
    holes: countHoles(tightMask, glyphW, glyphH)
  };
}

function groupToRankItems(ctx, group, w, h, groupId) {
  const baseW = w * 0.0265;
  const baseH = h * 0.0756;
  const overlapX = w * 0.0145;
  const overlapY = h * 0.0218;

  const horizontal = group.w > group.h * 1.05;
  const estimated = horizontal
    ? 1 + Math.round(Math.max(0, group.w - baseW) / overlapX)
    : 1 + Math.round(Math.max(0, group.h - baseH) / overlapY);
  const count = Math.max(1, Math.min(6, estimated));

  const items = [];

  if (horizontal) {
    const step = count > 1 ? Math.max(1, (group.w - baseW) / (count - 1)) : 0;

    for (let i = 0; i < count; i += 1) {
      const offset = step * i;
      const glyph = makeGlyphDataUrl(ctx, {
        x: group.x + offset,
        y: group.y,
        w: baseW * 0.65,
        h: baseH * 0.39
      });

      if (!glyph) continue;

      const suit = inferSuitFromRegion(
        ctx,
        group.x + offset + baseW * 0.05,
        group.y + baseH * 0.23,
        baseW * 0.65,
        baseH * 0.48
      );

      items.push({
        id: `${groupId}:${i}`,
        groupId,
        cardIndex: i,
        suit,
        dataUrl: glyph.dataUrl,
        holes: glyph.holes
      });
    }
  } else {
    const topGlyph = makeGlyphDataUrl(ctx, {
      x: group.x,
      y: group.y,
      w: baseW * 0.68,
      h: baseH * 0.40
    });

    if (topGlyph) {
      const suit = inferSuitFromRegion(
        ctx,
        group.x + baseW * 0.05,
        group.y + baseH * 0.23,
        baseW * 0.65,
        baseH * 0.48
      );

      items.push({
        id: `${groupId}:0`,
        groupId,
        cardIndex: 0,
        suit,
        dataUrl: topGlyph.dataUrl,
        holes: topGlyph.holes
      });
    }

    for (let i = 1; i < count; i += 1) {
      const stripY = group.y + group.h - overlapY * (count - i);
      const glyph = makeGlyphDataUrl(ctx, {
        x: group.x,
        y: stripY,
        w: group.w,
        h: Math.min(overlapY * 1.05, group.y + group.h - stripY)
      });

      if (!glyph) continue;

      items.push({
        id: `${groupId}:${i}`,
        groupId,
        cardIndex: i,
        suit: '?',
        dataUrl: glyph.dataUrl,
        holes: glyph.holes
      });
    }
  }

  return items;
}

function assignGroup(group, w, h) {
  const cx = (group.x + group.w / 2) / w;
  const cy = (group.y + group.h / 2) / h;

  // Dealer up-card is in the lower-left Dealer panel.
  if (
    cx >= 0.195 && cx <= 0.265 &&
    cy >= 0.665 && cy <= 0.800
  ) {
    return { type: 'dealer', slot: 0 };
  }

  // SportsBetting seat numbering runs RIGHT -> LEFT across the table.
  //
  // Approximate normalized seat centers from the supplied screenshot:
  // Seat 1 = far right, Seat 7 = far left.
  //
  // Array index 0 is Player 1, index 6 is Player 7.
  const centers = [
    0.655, // Player / Seat 1
    0.590, // Player / Seat 2
    0.525, // Player / Seat 3
    0.460, // Player / Seat 4
    0.395, // Player / Seat 5
    0.335, // Player / Seat 6
    0.275  // Player / Seat 7
  ];

  let best = 0;
  let bestDistance = Infinity;

  centers.forEach((center, index) => {
    const distance = Math.abs(cx - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });

  return { type: 'player', slot: best };
}

function drawDetectionBoxes(groups, w, h) {
  const ctx = overlay.getContext('2d');
  const rect = video.getBoundingClientRect();
  overlay.width = Math.max(1, Math.round(rect.width * devicePixelRatio));
  overlay.height = Math.max(1, Math.round(rect.height * devicePixelRatio));

  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const videoAspect = w / h;
  const boxAspect = rect.width / rect.height;
  let drawW, drawH, offsetX, offsetY;

  if (videoAspect > boxAspect) {
    drawW = rect.width;
    drawH = rect.width / videoAspect;
    offsetX = 0;
    offsetY = (rect.height - drawH) / 2;
  } else {
    drawH = rect.height;
    drawW = rect.height * videoAspect;
    offsetX = (rect.width - drawW) / 2;
    offsetY = 0;
  }

  groups.forEach((group, index) => {
    const assigned = assignGroup(group, w, h);
    const x = offsetX + group.x / w * drawW;
    const y = offsetY + group.y / h * drawH;
    const gw = group.w / w * drawW;
    const gh = group.h / h * drawH;

    ctx.strokeStyle = assigned.type === 'dealer' ? '#f3c45f' : '#4ce29b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, gw, gh);
    ctx.fillStyle = assigned.type === 'dealer' ? '#f3c45f' : '#4ce29b';
    ctx.font = '11px sans-serif';
    ctx.fillText(assigned.type === 'dealer' ? 'Dealer' : `P${assigned.slot + 1}`, x, Math.max(11, y - 3));
  });
}

async function scanOnce() {
  if (!state.scanning || state.scanBusy || !video.videoWidth || !video.videoHeight) return;

  state.scanBusy = true;
  const started = performance.now();

  try {
    const analysisW = 960;
    const analysisH = Math.round(video.videoHeight * analysisW / video.videoWidth);
    capture.width = analysisW;
    capture.height = analysisH;

    const ctx = capture.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, analysisW, analysisH);

    $('detectorState').textContent = 'finding cards';
    const groups = detectWhiteCardGroups(ctx, analysisW, analysisH);
    drawDetectionBoxes(groups, analysisW, analysisH);
    $('detectedHands').textContent = groups.length;

    if (!groups.length) {
      state.emptyScans += 1;
      if (state.emptyScans >= 2) {
        saveDealerHandToHistory();
        state.dealer = [];
        state.players = Array.from({ length: 7 }, () => []);
        resetRoundTracking();
        render();
      }
      $('detectorState').textContent = 'waiting';
      return;
    }

    state.emptyScans = 0;

    const meta = [];
    groups.forEach((group, index) => {
      const assigned = assignGroup(group, analysisW, analysisH);
      const groupId = `g${index}`;
      const items = groupToRankItems(ctx, group, analysisW, analysisH, groupId);

      meta.push({ groupId, group, assigned, items });
    });

    const allItems = meta.flatMap(group => group.items);
    $('ocrState').textContent = allItems.length ? 'reading' : 'no ranks';

    const ocrResults = allItems.length ? await window.cardvision.ocrRanks(allItems) : [];
    const resultMap = new Map(ocrResults.map(result => [result.id, result]));

    const nextDealer = [];
    const nextPlayers = Array.from({ length: 7 }, () => []);

    meta.forEach(groupMeta => {
      const hand = groupMeta.items
        .map(item => {
          const result = resultMap.get(item.id);
          const rank = normalizeOcrRank(result?.text, result?.holes ?? item.holes);
          return rank ? {
            rank,
            suit: item.suit,
            confidence: result?.confidence || 0,
            source: 'screen'
          } : null;
        })
        .filter(Boolean);

      if (!hand.length) return;

      if (groupMeta.assigned.type === 'dealer') {
        nextDealer.push(...hand);
      } else {
        nextPlayers[groupMeta.assigned.slot].push(...hand);
      }
    });

    state.dealer = nextDealer;
    state.players = nextPlayers;

    addFreshCardsFromHand('dealer', state.dealer);
    state.players.forEach((hand, index) => addFreshCardsFromHand(`player${index + 1}`, hand));

    $('ocrState').textContent = 'ready';
    $('detectorState').textContent = 'locked';
    render();
  } catch (error) {
    $('detectorState').textContent = 'error';
    $('ocrState').textContent = 'error';
    $('appNotice').textContent = `Recognition error: ${String(error?.message || error)}`;
  } finally {
    $('lastScan').textContent = `${Math.round(performance.now() - started)} ms`;
    state.scanBusy = false;
  }
}

async function refreshSources() {
  const sources = await window.cardvision.getSources();
  const preferred = sources.find(source => /chrome|sports|blackjack/i.test(source.name)) || sources[0];

  $('sourceSelect').innerHTML = sources.map(source =>
    `<option value="${source.id}" ${source.id === preferred?.id ? 'selected' : ''}>${source.name}</option>`
  ).join('');

  $('scanStatus').textContent = sources.length
    ? 'Choose the Chrome/game window, then Connect.'
    : 'No windows were found.';
}

async function connectScreen() {
  try {
    if (state.stream) state.stream.getTracks().forEach(track => track.stop());

    const sourceId = $('sourceSelect').value;
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: 900,
          maxWidth: 2560,
          minHeight: 500,
          maxHeight: 1600,
          maxFrameRate: 15
        }
      }
    });

    video.srcObject = state.stream;
    $('screenPlaceholder').style.display = 'none';
    $('autoScanBtn').disabled = false;
    $('scanStatus').textContent = 'Connected. Start Scan when the blackjack table is visible.';

    state.stream.getVideoTracks()[0].onended = () => stopScanning();
  } catch {
    $('scanStatus').textContent = 'Could not capture that window. Check screen-recording permission.';
  }
}

function startScanning() {
  if (state.scanning) {
    stopScanning();
    return;
  }

  state.scanning = true;
  $('autoScanBtn').textContent = 'Pause Scan';
  $('scanStatus').textContent = 'Scanning the center-table hands + Dealer panel. The enlarged Seat panel is ignored.';
  scanOnce();
  state.scanTimer = setInterval(scanOnce, 850);
}

function stopScanning() {
  state.scanning = false;
  if (state.scanTimer) clearInterval(state.scanTimer);
  state.scanTimer = null;
  $('autoScanBtn').textContent = 'Start Scan';
  $('detectorState').textContent = 'paused';
}

function manualAdd(rank, suit) {
  const hand = targetArray();
  const card = { rank, suit, source: 'manual', time: Date.now() };
  hand.push(card);
  state.history.push(card);

  const key = state.target;
  const counts = state.seenByHand.get(key) || new Map();
  counts.set(rank, Math.max(counts.get(rank) || 0, hand.filter(c => c.rank === rank).length));
  state.seenByHand.set(key, counts);

  render();
}

function setupCorrectionButtons() {
  $('rankButtons').innerHTML = ranks.map(rank => `<button data-rank="${rank}">${rank}</button>`).join('');

  document.querySelectorAll('[data-rank]').forEach(button => {
    button.addEventListener('click', () => {
      state.pendingRank = button.dataset.rank;
      document.querySelectorAll('[data-rank]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
    });
  });

  document.querySelectorAll('[data-suit]').forEach(button => {
    button.addEventListener('click', () => {
      if (!state.pendingRank) {
        $('appNotice').textContent = 'Pick a rank first, then the suit.';
        return;
      }

      manualAdd(state.pendingRank, button.dataset.suit);
      state.pendingRank = null;
      document.querySelectorAll('[data-rank]').forEach(item => item.classList.remove('active'));
    });
  });
}

$('deckCount').addEventListener('change', event => {
  state.decks = Number(event.target.value);
  state.history = [];
  state.dealer = [];
  state.dealerHistory = [];
  state.players = Array.from({ length: 7 }, () => []);
  resetRoundTracking();
  render();
});

$('mySeat').addEventListener('change', event => {
  state.mySeat = Number(event.target.value);
  state.target = `player${state.mySeat}`;
  $('targetSelect').value = state.target;
  render();
});

$('soft17Rule').addEventListener('change', event => {
  state.rules.soft17 = event.target.value;
  render();
});

$('targetSelect').addEventListener('change', event => {
  state.target = event.target.value;
  render();
});

$('refreshSourcesBtn').addEventListener('click', refreshSources);
$('shareBtn').addEventListener('click', connectScreen);
$('autoScanBtn').addEventListener('click', startScanning);

$('undoBtn').addEventListener('click', () => {
  const hand = targetArray();
  const removed = hand.pop();

  if (removed) {
    for (let i = state.history.length - 1; i >= 0; i -= 1) {
      if (state.history[i].rank === removed.rank) {
        state.history.splice(i, 1);
        break;
      }
    }
  }

  render();
});

$('clearHandBtn').addEventListener('click', () => {
  if (state.target === 'dealer') state.dealer = [];
  else state.players[Number(state.target.replace('player','')) - 1] = [];
  render();
});

$('newShoeBtn').addEventListener('click', () => {
  if (!confirm('Clear the count and start a new shoe?')) return;

  state.history = [];
  state.dealer = [];
  state.dealerHistory = [];
  state.players = Array.from({ length: 7 }, () => []);
  resetRoundTracking();
  render();
});


if ($('clearDealerHistoryBtn')) {
  $('clearDealerHistoryBtn').addEventListener('click', () => {
    state.dealerHistory = [];
    renderDealerHistory();
  });
}

setupCorrectionButtons();
refreshSources();
render();

window.cardvision.warmOcr()
  .then(() => { $('ocrState').textContent = 'ready'; })
  .catch(() => { $('ocrState').textContent = 'load error'; });
