
const state = { rules: { soft17: 'H17' } };
function cardValue(rank) {
  if (rank === 'A') return 11;
  if (['10','J','Q','K'].includes(rank)) return 10;
  return Number(rank) || 0;
}
function handInfo(hand) {
  let total = hand.reduce((sum, card) => sum + cardValue(card.rank), 0);
  let aces = hand.filter(card => card.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return {
    total,
    soft: aces > 0,
    pairValue: hand.length === 2 && cardValue(hand[0].rank) === cardValue(hand[1].rank) ? cardValue(hand[0].rank) : null,
    blackjack: hand.length === 2 && total === 21
  };
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

function h(...ranks){ return ranks.map(rank => ({rank})); }
const tests = [
  ['16v10 TC+1', h('10','6'), 10, 1, 6, 'STAND'],
  ['16v10 TC-1', h('10','6'), 10, -1, -6, 'SURRENDER'],
  ['12v3 TC+2', h('10','2'), 3, 2, 10, 'STAND'],
  ['12v3 TC+1', h('10','2'), 3, 1, 5, 'HIT'],
  ['12v2 TC+3', h('10','2'), 2, 3, 15, 'STAND'],
  ['13v2 TC-2', h('10','3'), 2, -2, -10, 'HIT'],
  ['10v10 TC+4', h('6','4'), 10, 4, 20, 'DOUBLE DOWN'],
  ['9v7 TC+3', h('5','4'), 7, 3, 15, 'DOUBLE DOWN'],
  ['TTv6 TC+4', h('10','K'), 6, 4, 20, 'SPLIT'],
  ['14v10 TC+3', h('10','4'), 10, 3, 15, 'SURRENDER']
];
let failed = 0;
for (const [name, hand, dealer, tc, rc, expected] of tests) {
  const got = recommendMove(hand, dealer, tc, rc).action;
  console.log(name, got, got === expected ? 'PASS' : `FAIL expected ${expected}`);
  if (got !== expected) failed++;
}
process.exitCode = failed ? 1 : 0;
