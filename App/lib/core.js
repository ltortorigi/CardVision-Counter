(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.CV=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const ranks=['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
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

function baseRecommendation(hand, dealerValue, rules = {}) {
  if (!hand.length || !dealerValue) {
    return { action: 'WAITING', reason: 'Need your hand and the dealer up-card.' };
  }

  const info = handInfo(hand);
  const twoCards = hand.length === 2;
  const h17 = rules.soft17 === 'H17';

  if (info.blackjack) return { action: 'STAND', reason: rules.split?'21 after splitting.':'Blackjack.' };
  if (info.total > 21) return { action: 'BUST', reason: `Hand total is ${info.total}.` };
  if (info.total === 21) return { action: 'STAND', reason: 'You already have 21.' };

  if (twoCards && info.pairValue !== null) {
    const pair = info.pairValue;

    if (pair === 11) return { action: 'SPLIT', reason: 'Always split Aces.' };
    if (pair === 8) {
      if (rules.surrender && h17 && dealerValue === 11) return { action: 'SURRENDER', reason: 'H17 late-surrender exception: 8,8 vs Ace.' };
      return { action: 'SPLIT', reason: 'Always split 8s.' };
    }
    if (pair === 10) return { action: 'STAND', reason: 'Basic strategy: keep 20 together.' };
    if (pair === 9) return { action: [2,3,4,5,6,8,9].includes(dealerValue) ? 'SPLIT' : 'STAND', reason: 'Basic pair strategy for 9s.' };
    if (pair === 7) return { action: dealerValue >= 2 && dealerValue <= 7 ? 'SPLIT' : 'HIT', reason: 'Basic pair strategy for 7s.' };
    if (pair === 6) return { action: dealerValue >= 2 && dealerValue <= 6 ? 'SPLIT' : 'HIT', reason: 'DAS basic pair strategy for 6s.' };
    if (pair === 4) return { action: [5,6].includes(dealerValue) ? 'SPLIT' : 'HIT', reason: 'DAS basic pair strategy for 4s.' };
    if (pair === 3 || pair === 2) return { action: dealerValue >= 2 && dealerValue <= 7 ? 'SPLIT' : 'HIT', reason: 'DAS basic pair strategy for small pairs.' };
  }

  if (twoCards && !info.soft && rules.surrender) {
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

function applyHiLoDeviation(hand, dealerValue, trueCount, runningCount, base, rules = {}) {
  const info = handInfo(hand);
  const twoCards = hand.length === 2;
  const h17 = rules.soft17 === 'H17';

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
  if (!info.soft && info.pairValue !== 8) {
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
  if (rules.surrender && !info.soft && twoCards && info.pairValue !== 8) {
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

function recommendMove(hand, dealerValue, trueCount = 0, runningCount = 0, rules = {}) {
  const base = baseRecommendation(hand, dealerValue, rules);
  if(base.action==='SURRENDER' && handInfo(hand).total===15 && dealerValue===10 && trueCount<0)return {action:'HIT',reason:'Count deviation (TC < 0): hit hard 15 vs 10 below the surrender index.',adjusted:true,baseAction:base.action};
  if (base.action === 'WAITING' || base.action === 'BUST' || handInfo(hand).blackjack || base.action === 'SURRENDER') {
    return { ...base, adjusted: false, baseAction: base.action };
  }
  return applyHiLoDeviation(hand, dealerValue, trueCount, runningCount, base, rules);
}



const clone = x => JSON.parse(JSON.stringify(x));
const signature = cards => cards.map(c => c.rank).join(',');
function betRecommendation(tc) {
  return tc < 1 ? {signal:'MIN',label:'Minimum',units:1} : tc < 2 ? {signal:'NORMAL',label:'Normal',units:1} : tc < 4 ? {signal:'MORE',label:'Above normal',units:2} : {signal:'HIGH',label:'High positive count',units:4};
}
function probabilities(hand, history, decks) {
  const remaining = Object.fromEntries(ranks.map(r=>[r,decks*4]));
  history.forEach(c=>{if(c.rank in remaining)remaining[c.rank]--;});
  if(Object.values(remaining).some(n=>n<0))return null;
  let safe=0,helpful=0,bust=0,total=0;
  const before=handInfo(hand).total;
  for(const rank of ranks){
    const n=remaining[rank];total+=n;
    const after=handInfo([...hand,{rank}]).total;
    if(after>21)bust+=n;else {safe+=n;if(after>before && after>=17)helpful+=n;}
  }
  if(!total || !hand.length || before>=21)return null;
  return {safe:100*safe/total,helpful:100*helpful/total,bust:100*bust/total};
}
function dealerComplete(cards,rules={}){
  if(cards.length<2)return false;
  const i=handInfo(cards);return i.total>17 || (i.total===17 && !(i.soft && rules.soft17==='H17'));
}
function outcome(player,dealer,{split=false,surrender=false,complete=false}={}){
  if(surrender)return 'SURRENDER';
  if(!complete || player.length<2 || dealer.length<2)return 'UNKNOWN';
  const p=handInfo(player),d=handInfo(dealer);
  if(p.total>21)return 'LOSS';
  if(d.blackjack)return p.blackjack&&!split?'PUSH':'LOSS';
  if(p.blackjack&&!split)return 'WIN';
  if(d.total>21)return 'WIN';
  return p.total===d.total?'PUSH':p.total>d.total?'WIN':'LOSS';
}
function stats(results){
  const n=x=>results.filter(r=>r.result===x).length;
  const wins=n('WIN'),losses=n('LOSS');
  return {hands:results.length,wins,losses,pushes:n('PUSH'),surrenders:n('SURRENDER'),winPercent:wins+losses?100*wins/(wins+losses):null};
}
class Tracker {
  constructor(decks=6){this.decks=decks;this.round=1;this.ledger={};this.hands={};this.status={};this.pending={};this.events=[];this.undoStack=[];this.results=[];this.dealerHistory=[];this.high=0;this.low=0;this.manualLocks={};this.splits={};}
  get history(){return Object.values(this.ledger);}
  get running(){return this.history.reduce((s,c)=>s+hilo(c.rank),0);}
  get decksLeft(){return Math.max(.25,this.decks-this.history.length/52);}
  get tc(){return this.running/this.decksLeft;}
  snapshot(){return clone({decks:this.decks,round:this.round,ledger:this.ledger,hands:this.hands,status:this.status,results:this.results,dealerHistory:this.dealerHistory,high:this.high,low:this.low,manualLocks:this.manualLocks,splits:this.splits});}
  transaction(type,fn,detail={}){
    const before=this.snapshot(),rc=this.running;
    fn();this.undoStack.push(before);if(this.undoStack.length>100)this.undoStack.shift();
    this.high=Math.max(this.high,this.tc);this.low=Math.min(this.low,this.tc);
    this.events.push({timestamp:new Date().toISOString(),type,round:this.round,...detail,running:this.running,trueCount:this.tc,previousRC:rc});
  }
  commit(key,cards,source){
    this.hands[key]=clone(cards);
    // Physical identity: round + hand + card position. Corrections replace the existing entry.
    for(const id of Object.keys(this.ledger))if(id.startsWith(`${this.round}:${key}:`))delete this.ledger[id];
    cards.forEach((c,i)=>{const id=`${this.round}:${key}:${i}`;this.ledger[id]={...c,id,seat:key,round:this.round,source};});
    this.status[key]=source==='manual'?'MANUAL VERIFIED':'VERIFIED';
  }
  observeFrame(observations,{frames=2,threshold=85}={}){
    const changes=[];let splitChanged=false;
    for(const o of observations){
      const key=o.key;
      if(o.issue){this.hold(key,o.issue);continue;}
      if(o.splitHands || this.splits[key]){splitChanged=this.observeSplit(o,{frames,threshold})||splitChanged;continue;}
      if(o.ambiguous){this.status[key]='SPLIT / MULTIPLE HANDS — MANUAL REVIEW';delete this.pending[key];continue;}
      let cards=o.cards||[],source='table';
      // Active panel is a duplicate correction source, never a separate ledger hand.
      if(o.activeCards?.length && o.activeSeat===Number(key.replace('player','')) && o.total!=null && handInfo(o.activeCards).total===o.total && o.activeCards.every(c=>c.confidence>=threshold)){
        cards=o.activeCards;source='active panel';
      }
      if(!cards.length){if(this.hands[key]?.length)this.status[key]='NOT VISIBLE';delete this.pending[key];continue;}
      const old=this.hands[key]||[];
      // The side panel may place the newly revealed hole card before the up-card.
      // Keep the first verified up-card as position zero for recommendations.
      if(key==='dealer' && old.length && cards.length>=old.length && cards.length>1){const up=cards.findIndex(c=>c.rank===old[0].rank);if(up>0)cards=[cards[up],...cards.slice(0,up),...cards.slice(up+1)];}
      const valid=cards.every(c=>ranks.includes(c.rank) && c.confidence>=threshold) && (key==='dealer' || (o.total!=null && handInfo(cards).total===o.total));
      if(!valid || (old.length>cards.length)) {this.status[key]='VERIFYING HAND...';delete this.pending[key];continue;}
      const sig=signature(cards);
      if(this.manualLocks[key] && signature(old)!==sig){this.status[key]='MANUAL LOCK — REVIEW';continue;}
      if(signature(old)===sig && !this.manualLocks[key] && cards.some((c,i)=>c.suit && c.suit!=='?' && (!old[i].suit || old[i].suit==='?'))){changes.push({key,cards:cards.map((c,i)=>({...c,suit:c.suit&&c.suit!=='?'?c.suit:old[i].suit||'?'})),source,old});continue;}
      if(signature(old)===sig){this.status[key]=this.manualLocks[key]?'MANUAL VERIFIED':'VERIFIED';delete this.pending[key];continue;}
      this.status[key]='VERIFYING HAND...';
      const p=this.pending[key];this.pending[key]={sig,count:p?.sig===sig?p.count+1:1};
      if(this.pending[key].count>=frames)changes.push({key,cards,source,old});
    }
    if(!changes.length)return splitChanged;
    // Reject impossible rank inventories before changing any count.
    const simulated=clone(this.ledger);
    for(const c of changes){for(const id of Object.keys(simulated))if(id.startsWith(`${this.round}:${c.key}:`))delete simulated[id];c.cards.forEach((card,i)=>simulated[`${this.round}:${c.key}:${i}`]=card);}
    if(ranks.some(r=>Object.values(simulated).filter(c=>c.rank===r).length>this.decks*4)){changes.forEach(c=>this.status[c.key]='SHOE CONFLICT — REVIEW');return false;}
    this.transaction('scan',()=>{changes.forEach(c=>{this.commit(c.key,c.cards,c.source);delete this.pending[c.key];});},{changes:changes.map(c=>({seat:c.key,cards:c.cards,total:handInfo(c.cards).total,confidence:Math.min(...c.cards.map(x=>x.confidence)),correction:c.old.length?signature(c.old)+' → '+signature(c.cards):'',source:c.source}))});
    return true;
  }
  hold(key,message){this.status[key]=message;for(const child of this.splits[key]||[])this.status[child]=message;delete this.pending[key];}
  splitInventory(key,hands){
    const simulated=clone(this.ledger),keys=[key,...(this.splits[key]||[])];
    for(const id of Object.keys(simulated))if(keys.some(k=>id.startsWith(`${this.round}:${k}:`)))delete simulated[id];
    hands.forEach((h,i)=>h.cards.forEach((card,j)=>simulated[`${this.round}:${key}/${i+1}:${j}`]=card));
    return !ranks.some(r=>Object.values(simulated).filter(c=>c.rank===r).length>this.decks*4);
  }
  commitSplit(key,hands,source){
    for(const id of Object.keys(this.ledger))if(id.startsWith(`${this.round}:${key}:`))delete this.ledger[id];
    delete this.hands[key];delete this.manualLocks[key];this.splits[key]=hands.map((h,i)=>key+'/'+(i+1));
    hands.forEach((h,i)=>this.commit(this.splits[key][i],h.cards,source));this.status[key]='SPLIT — TWO HANDS';delete this.pending[key];
  }
  observeSplit(o,{frames=2,threshold=85}={}){
    const key=o.key,children=this.splits[key],hands=o.splitHands;
    if(!hands || hands.length!==2){this.hold(key,'SPLIT LAYOUT UNCLEAR — REVIEW');return false;}
    const old=children?children.map(k=>this.hands[k]||[]):[this.hands[key]||[]];
    const seeds=children?old.map(h=>h[0]?.rank):old[0].map(c=>c.rank);
    const valid=hands.every(h=>!h.ambiguous&&h.cards?.length>=2&&h.cards.every(c=>ranks.includes(c.rank)&&c.confidence>=threshold)&&h.total!=null&&handInfo(h.cards).total===h.total);
    const pair=children || (old[0].length===2&&cardValue(old[0][0].rank)===cardValue(old[0][1].rank));
    const sameSeeds=children?hands.every((h,i)=>h.cards[0]?.rank===seeds[i]):hands.map(h=>h.cards[0]?.rank).sort().join(',')===[...seeds].sort().join(',');
    const continuous=!children||hands.every((h,i)=>h.cards.length>=old[i].length&&(h.cards.length===old[i].length||old[i].every((c,j)=>c.rank===h.cards[j]?.rank)));
    if(!valid||!pair||!sameSeeds||!continuous){this.hold(key,'VERIFYING SPLIT — CHECK BOTH TOTALS');return false;}
    const unchanged=children&&hands.every((h,i)=>signature(h.cards)===signature(old[i]));
    if(this.manualLocks[key] || (children&&children.some((k,i)=>this.manualLocks[k]&&signature(hands[i].cards)!==signature(old[i])))){
      this.hold(key,'MANUAL LOCK — REVIEW');return false;
    }
    if(unchanged){hands.forEach((h,i)=>this.status[children[i]]=this.manualLocks[children[i]]?'MANUAL VERIFIED':'VERIFIED');this.status[key]='SPLIT — TWO HANDS';delete this.pending[key];return false;}
    const sig=hands.map(h=>signature(h.cards)).join('|'),p=this.pending[key];
    this.pending[key]={sig,count:p?.sig===sig?p.count+1:1};this.status[key]='VERIFYING SPLIT...';for(const child of children||[])this.status[child]='VERIFYING SPLIT...';
    if(this.pending[key].count<frames)return false;
    if(!this.splitInventory(key,hands)){this.hold(key,'SHOE CONFLICT — REVIEW');return false;}
    this.transaction('scan',()=>this.commitSplit(key,hands,'split table'),{changes:hands.map((h,i)=>({seat:key+'/'+(i+1),cards:h.cards,total:handInfo(h.cards).total,confidence:Math.min(...h.cards.map(c=>c.confidence)),correction:children?'split hand updated':'original pair moved into separate hands',source:'split table'}))});return true;
  }
  setManualSplit(key,hands){
    if(!/^player[1-7]$/.test(key)||hands.length!==2||hands.some(cards=>!cards.length||!cards.every(c=>ranks.includes(c.rank))))throw Error('Enter two complete hands, separated by /, for a player seat.');
    const entries=hands.map(cards=>({cards:cards.map(c=>({...c,confidence:100}))}));
    if(!this.splitInventory(key,entries))throw Error('These hands exceed the configured shoe inventory.');
    this.transaction('manual split',()=>{this.commitSplit(key,entries,'manual');this.splits[key].forEach(k=>this.manualLocks[k]=true);},{changes:entries.map((h,i)=>({seat:key+'/'+(i+1),cards:h.cards,total:handInfo(h.cards).total,confidence:100,correction:'manual split replacement'}))});
  }
  setManual(key,cards){
    if(this.splits[key])throw Error('This seat has split hands. Select a split hand, or enter both hands separated by /.');
    if(!cards.every(c=>ranks.includes(c.rank)))throw Error('Use valid card ranks.');
    this.transaction('manual correction',()=>{this.commit(key,cards.map(c=>({...c,confidence:100})),'manual');this.manualLocks[key]=true;delete this.pending[key];},{seat:key,cards,total:handInfo(cards).total});
  }
  nextRound(rules={}){
    this.transaction('new round',()=>{
      if(dealerComplete(this.hands.dealer||[],rules) && /VERIFIED/.test(this.status.dealer||''))this.dealerHistory.unshift({round:this.round,cards:clone(this.hands.dealer),total:handInfo(this.hands.dealer).total});
      this.round++;this.hands={};this.status={};this.pending={};this.manualLocks={};this.splits={};
    });
  }
  resetShoe(decks=this.decks){
    this.transaction('new shoe',()=>{this.decks=decks;this.round++;this.ledger={};this.hands={};this.status={};this.pending={};this.manualLocks={};this.splits={};});
  }
  undo(){const s=this.undoStack.pop();if(!s)return false;Object.assign(this,s);this.pending={};this.events.push({timestamp:new Date().toISOString(),type:'undo',running:this.running,trueCount:this.tc,round:this.round});return true;}
  recordResult(seat,result,hand='main',multiplier=1){
    if(!['WIN','LOSS','PUSH','SURRENDER'].includes(result))throw Error('Confirm a known result.');
    const id=`${this.round}:${seat}:${hand}`;
    if(this.results.some(r=>r.id===id))throw Error('Result already recorded for this hand.');
    this.transaction('result',()=>this.results.push({id,round:this.round,seat,hand,result,multiplier}),{seat,result,hand,multiplier});
  }
}
return {ranks,hilo,cardValue,handInfo,baseRecommendation,applyHiLoDeviation,recommendMove,betRecommendation,probabilities,dealerComplete,outcome,stats,Tracker};
});
