
const state={dealerHistory:[],dealer:[{rank:'10',suit:'♥'},{rank:'7',suit:'♠'}]};
function cardValue(rank){if(rank==='A')return 11;if(['10','J','Q','K'].includes(rank))return 10;return Number(rank)||0}
function handInfo(hand){let total=hand.reduce((s,c)=>s+cardValue(c.rank),0),aces=hand.filter(c=>c.rank==='A').length;while(total>21&&aces>0){total-=10;aces--}return{total,soft:aces>0,pairValue:null,blackjack:hand.length===2&&total===21}}
function dealerHandSignature(hand){return hand.map(card=>`${card.rank}${card.suit||'?'}`).join('|')}
function dealerOutcomeLabel(hand){const info=handInfo(hand);if(!hand.length)return'';if(info.blackjack)return'Blackjack';if(info.total>21)return`Bust ${info.total}`;return`Total ${info.total}`}
function saveDealerHandToHistory(){
 if(!state.dealer.length)return;
 const snapshot=state.dealer.map(card=>({rank:card.rank,suit:card.suit||'?',source:card.source||'screen'}));
 const signature=dealerHandSignature(snapshot),newest=state.dealerHistory[0];
 if(newest&&newest.signature===signature)return;
 state.dealerHistory.unshift({signature,cards:snapshot,total:handInfo(snapshot).total,outcome:dealerOutcomeLabel(snapshot),time:Date.now()});
 state.dealerHistory=state.dealerHistory.slice(0,12);
}
saveDealerHandToHistory();
saveDealerHandToHistory();
if(state.dealerHistory.length!==1||state.dealerHistory[0].total!==17) process.exit(1);
console.log('dealer-history PASS',state.dealerHistory.length,state.dealerHistory[0].outcome);
