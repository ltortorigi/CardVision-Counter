'use strict';
const $=id=>document.getElementById(id),api=window.cardvision;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=x=>JSON.parse(JSON.stringify(x));
const autoLocator=new CVAuto.Stabilizer(),handCycle=new CVAuto.HandCycle();
let autoStartRequested=false,lastAutoAnchor=null,dealerBeforeClear=null;
let baseRegions=copy(DEFAULT_REGIONS),editingOutlines=false,editBackup=null,resumeAfterEdit=false,outlinesAvailable=false,lastCorrectionTargets="",lastResultSeatKey="";
const initial={name:'SportsBetting — 6 Deck H17',decks:6,soft17:'H17',surrender:false,seat:4,source:'',theme:'dark',sounds:false,compact:false,frames:2,threshold:85,regions:copy(DEFAULT_REGIONS),regionOverrides:{},showOutlines:true,calibrated:false};
let profiles={},profileId='default',profile,tracker,vision,stream=null,scanning=false,busy=false,timer=null,fixture=false,epoch=0,ocrReady=false,logStart=0,lastMove='',lastAlert='';
try{const saved=JSON.parse(localStorage.getItem('cardvision-v21')||'null');if(saved){profiles=saved.profiles||{};profileId=saved.active;}}catch{}
if(!profiles[profileId]){profiles.default=copy(initial);profileId='default';}
profile={...copy(initial),...profiles[profileId]};profile.regions=copy(DEFAULT_REGIONS);
tracker=new CV.Tracker(profile.decks);vision=new Vision(api,window.CARD_TEMPLATES||[]);
function save(){profiles[profileId]=copy(profile);localStorage.setItem('cardvision-v21',JSON.stringify({active:profileId,profiles}));}
function notice(s){$('appNotice').textContent=s;}
function beep(message){notice(message);if(!profile.sounds)return;try{const ctx=new AudioContext(),o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);g.gain.value=.05;o.frequency.value=660;o.start();o.stop(ctx.currentTime+.12);o.onended=()=>ctx.close();}catch{}}
function cardsText(h){return h?.length?h.map(c=>c.rank+(c.suit||'?')).join(' '):'—';}
function verified(key){return ['VERIFIED','MANUAL VERIFIED'].includes(tracker.status[key]);}
function selectedKey(){const parent=`player${profile.seat}`;return tracker.splits[parent]?parent+'/'+($('splitHandSelect').value||'1'):parent;}
function recommendation(key){
 const hand=tracker.hands[key]||[];
 if(!hand.length)return {action:'WAITING',reason:'Waiting for a hand.'};
 if(!verified(key)||!verified('dealer'))return {action:'VERIFYING HAND...',reason:'Awaiting consistent ranks, the displayed total, and a verified dealer up-card.'};
 if(profile.decks<4)return {action:'RULES UNSUPPORTED',reason:'Counting is available. This build preserves the multi-deck strategy chart; single/two-deck strategy requires a separate chart.'};
 const split=key.includes('/');
 if(split&&hand[0]?.rank==='A')return {action:'CHECK SPLIT RULES',reason:'Split-ace hit and resplit rules must be confirmed at the table.'};
 const r=CV.recommendMove(hand,CV.cardValue(tracker.hands.dealer?.[0]?.rank),tracker.tc,tracker.running,split?{...profile,surrender:false,split:true}:profile);
 if(split&&r.action==='SPLIT')return {action:'CHECK SPLIT RULES',reason:'Confirm whether resplitting is allowed. This reader tracks two split hands; additional hands require review.'};
 return r;
}
function probabilityHTML(hand){const p=CV.probabilities(hand,tracker.history,tracker.decks);return p?`<span>Safe draw ${p.safe.toFixed(1)}%</span><span>Helpful ${p.helpful.toFixed(1)}%</span><span class="risk">Bust ${p.bust.toFixed(1)}%</span><small>ESTIMATES</small>`:'';}
function render(){
 document.body.classList.toggle('light',profile.theme==='light');document.body.classList.toggle('compact',profile.compact);
 $('profileName').textContent=`${profile.name} · Seat ${profile.seat}`;$('mySeat').value=String(profile.seat);
 $('runningCount').textContent=tracker.running;$('trueCount').textContent=tracker.tc.toFixed(2);$('cardsSeen').textContent=tracker.history.length;$('decksLeft').textContent=tracker.decksLeft.toFixed(2);
 const bet=CV.betRecommendation(tracker.tc);$('betSignal').textContent=bet.signal;$('shoeProgress').textContent=Math.min(100,100*tracker.history.length/(tracker.decks*52)).toFixed(1)+'%';
 $('scanState').textContent=scanning?'SCANNING':'PAUSED';$('autoScanBtn').textContent=scanning?'Pause scanning':'Resume scanning';
 const keySelected=selectedKey(),selected=tracker.hands[keySelected]||[],move=recommendation(keySelected),dealer=tracker.hands.dealer||[];
 $('splitHandSelect').hidden=!tracker.splits[`player${profile.seat}`];
 const resultSeatKey=profile.seat+':'+Boolean(tracker.splits[`player${profile.seat}`]);if(resultSeatKey!==lastResultSeatKey){$('resultHand').value=tracker.splits[`player${profile.seat}`]?'split'+($('splitHandSelect').value||'1'):'main';lastResultSeatKey=resultSeatKey;}
 $('strategyHand').textContent=cardsText(selected);$('selectedTotal').textContent=selected.length?`Total ${CV.handInfo(selected).total} · ${tracker.status[keySelected]}`:'Waiting for cards';
 $('strategyDealer').textContent=`Dealer: ${cardsText(dealer.slice(0,1))}`;$('recommendedMove').textContent=move.action;$('recommendationReason').textContent=move.reason;
 $('strategyMode').textContent=move.adjusted?`COUNT-ADJUSTED · Basic strategy: ${move.baseAction}`:'Multi-deck basic strategy · DAS · dealer peek';
 $('selectedProbabilities').innerHTML=verified(keySelected)?probabilityHTML(selected):'';
 $('dealerCards').textContent=cardsText(dealer);$('dealerTotal').textContent=dealer.length?`${CV.handInfo(dealer).total} · ${tracker.status.dealer}`:'—';
 const occupied=new Set(Object.keys(tracker.hands).filter(k=>k.startsWith('player')&&tracker.hands[k].length).map(k=>k.split('/')[0]));
 $('detectedHands').textContent=`${occupied.size} / 7 confirmed seats`;
 $('playersGrid').innerHTML=Array.from({length:7},(_,i)=>{
  const parent=`player${i+1}`,keys=tracker.splits[parent]||[parent];
  return keys.map(key=>{const h=tracker.hands[key]||[],status=tracker.status[key]||'Empty',r=recommendation(key);
   if(!h.length&&!tracker.status[key])return '';
   return `<div class="player-row ${profile.seat===i+1?'you':''}" data-seat="${i+1}" data-hand="${key.split('/')[1]||''}"><b>Seat ${i+1}${key.includes('/')?'<span class="split-label">Split '+key.split('/')[1]+'</span>':''}</b><div class="cards">${h.map(c=>`${escapeHTML(c.rank)}${escapeHTML(c.suit||'?')}<small class="confidence ${c.confidence<85?'low':c.confidence<93?'medium':''}">${Math.round(c.confidence)}%</small>`).join(' ')}<span class="hand-state">${h.length?'Total '+CV.handInfo(h).total+' · ':''}${escapeHTML(status)}</span></div><span class="move-small">${escapeHTML(r.action)}</span><div class="probabilities">${verified(key)?probabilityHTML(h):''}</div></div>`;
  }).join('');
 }).join('')||'<p>No verified player hands. Only occupied regions are analyzed.</p>';
 $('playersGrid').querySelectorAll('[data-seat]').forEach(e=>e.onclick=()=>{selectSeat(+e.dataset.seat);if(e.dataset.hand){$('splitHandSelect').value=e.dataset.hand;$('resultHand').value='split'+e.dataset.hand;render();}});
 const targets=['dealer',...Array.from({length:7},(_,i)=>'player'+(i+1)),...Object.values(tracker.splits).flat()];
 if(targets.join('|')!==lastCorrectionTargets){const selectedTarget=$('targetSelect').value;$('targetSelect').replaceChildren(...targets.map(k=>new Option(CVRegions.label(k),k)));$('targetSelect').value=targets.includes(selectedTarget)?selectedTarget:`player${profile.seat}`;lastCorrectionTargets=targets.join('|');}
 const st=CV.stats(tracker.results);$('sessionStats').innerHTML=Object.entries({'Hands played':st.hands,Wins:st.wins,Losses:st.losses,Pushes:st.pushes,Surrenders:st.surrenders,'Win %':st.winPercent==null?'—':st.winPercent.toFixed(1)+'%','Highest TC':tracker.high.toFixed(2),'Lowest TC':tracker.low.toFixed(2)}).map(([k,v])=>`<span>${k}<b>${v}</b></span>`).join('');
 $('dealerHistoryList').textContent=tracker.dealerHistory.slice(0,12).map(h=>`Round ${h.round}: ${cardsText(h.cards)} — Total ${h.total}`).join('\n')||'No completed dealer hands.';
 $('detectionLog').textContent=tracker.events.slice(logStart).slice(-60).reverse().map(e=>`${e.timestamp.slice(11,19)} ${e.type} ${e.changes?e.changes.map(c=>`${c.seat}: ${cardsText(c.cards)} total ${c.total}${c.correction?' correction '+c.correction:''}`).join('; '):e.seat||''}${e.result?' '+e.result:''} RC ${e.previousRC??''} → ${e.running} TC ${Number(e.trueCount).toFixed(2)}`).join('\n');
 if(move.action!==lastMove && !['WAITING','VERIFYING HAND...','RULES UNSUPPORTED','CHECK SPLIT RULES'].includes(move.action)){beep(`Seat ${profile.seat}: ${move.action}${move.adjusted?' · Count-adjusted':''}`);lastMove=move.action;}
 const alert=tracker.tc>=4?'Strong positive true count':tracker.status[keySelected]==='VERIFYING HAND...'?'Selected hand requires verification':'';
 if(alert&&alert!==lastAlert){beep(alert);lastAlert=alert;}if(!alert)lastAlert='';
 drawOutlines();
 api.overlayData({status:scanning?'SCANNING':'PAUSED',hands:`YOU: ${cardsText(selected)}${selected.length?' · '+CV.handInfo(selected).total:''}\nDEALER: ${cardsText(dealer.slice(0,1))}`,move:move.action,counts:`RC ${tracker.running} · TC ${tracker.tc.toFixed(2)}\nBET ${bet.signal}`});
}
function selectSeat(n){profile.seat=n;$('splitHandSelect').value='1';$('resultHand').value=tracker.splits[`player${n}`]?'split1':'main';$('targetSelect').value=`player${n}`;save();render();}
function pause(){autoStartRequested=false;scanning=false;epoch++;clearTimeout(timer);timer=null;render();}
function sourceFrame(){
 const source=fixture?$('fixtureImage'):$('screenVideo'),w=fixture?source.naturalWidth:source.videoWidth,h=fixture?source.naturalHeight:source.videoHeight;
 if(!w||!h)throw Error('Connect a capture source or load a test screenshot first.');
 const c=$('captureCanvas');c.width=Math.min(w,1600);c.height=Math.round(h*c.width/w);c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c;
}
async function scanOnce(){
 if(busy||editingOutlines)return;
 if(!ocrReady){notice('Recognition is not ready. Open Diagnostics for help.');return;}
 busy=true;const token=epoch,start=performance.now();
 try{
  const c=sourceFrame();
  const located=autoLocator.update(CVAuto.locate(c.getContext('2d').getImageData(0,0,c.width,c.height),DEFAULT_REGIONS));
  if(!located.ready){
   outlinesAvailable=false;
   handCycle.update({tableVisible:false,cardRegions:0,now:performance.now()});
   Object.keys(tracker.hands).forEach(k=>tracker.status[k]='TABLE NOT LOCKED');
   $('tableStatus').textContent=located.found?'TABLE: ALIGNING':'TABLE: FINDING';
   $('scanStatus').textContent=located.reason||'Aligning to the detected dealer panel…';render();return;
  }
  const anchorKey=[located.anchor.x,located.anchor.y,located.anchor.scale.toFixed(3),c.width,c.height].join(':');
  if(anchorKey!==lastAutoAnchor){vision.clear();tracker.pending={};lastAutoAnchor=anchorKey;}
  baseRegions=located.regions;profile.regions=CVRegions.apply(baseRegions,profile.regionOverrides);profile.calibrated=true;vision.geometry=located;outlinesAvailable=true;
  vision.prepare(c,profile.regions,profile.regionOverrides);
  $('tableStatus').textContent='TABLE: AUTO-ALIGNED';
  const physical=vision.presence(c,vision.scanRegions);
  const phase=handCycle.update({tableVisible:true,cardRegions:physical,now:performance.now()});
  if(phase==='new-hand'){if(dealerBeforeClear===JSON.stringify(tracker.hands.dealer))tracker.status.dealer='VERIFIED';dealerBeforeClear=null;tracker.nextRound(profile);vision.clear();notice('New hand detected from cleared cards. Shoe count retained.');}
  if(!physical){
   if(verified('dealer')&&CV.dealerComplete(tracker.hands.dealer||[],profile))dealerBeforeClear=JSON.stringify(tracker.hands.dealer);
   Object.keys(tracker.hands).forEach(k=>tracker.status[k]='WAITING FOR CARDS');
   $('scanStatus').textContent=phase==='cleared'?'Table cleared. Waiting for the next deal.':'Table found. Waiting for visible cards…';render();return;
  }
  const observations=await vision.observe(c,profile.regions,profile.seat,obs=>{
   if(token!==epoch)return;
   const changed=tracker.observeFrame(obs,{frames:profile.frames,threshold:profile.threshold});
   if(changed){const e=tracker.events.at(-1);e.changes.forEach(x=>x.recommendation=recommendation(x.seat).action);}
   render();
  });
  if(token!==epoch)return;
  $('scanStatus').textContent=`${fixture?'TEST SCREENSHOT · ':''}Auto-aligned · ${physical} occupied hand regions · Totals checked before counting${Object.keys(vision.regionIssues).length?' · CHECK RED OUTLINES':''}`;
 }catch(e){Object.keys(tracker.hands).forEach(k=>tracker.status[k]='RECOGNITION ERROR');render();notice(`Recognition error: ${e.message}`);$('ocrState').textContent='RECOGNITION: ERROR';beep('Detection problem. Check Diagnostics.');}
 finally{busy=false;$('lastScan').textContent=`${Math.round(performance.now()-start)} ms`;}
}
async function loop(){if(!scanning)return;await scanOnce();if(scanning)timer=setTimeout(loop,350);}
function toggleScanning(){if(editingOutlines){notice('Click Done editing before resuming scans.');return;}if(scanning)pause();else if(ocrReady){scanning=true;render();loop();}else notice('Wait for recognition to load, then resume scanning.');}
async function refreshSources(){
 try{const sources=await api.getSources();for(const id of ['sourceSelect','setupSource']){const el=$(id);el.replaceChildren(...sources.map(s=>new Option(s.name,s.id)));if(sources.some(s=>s.id===profile.source))el.value=profile.source;}if(!sources.length)notice('No capture sources. Check screen-recording permission.');}
 catch(e){$('captureStatus').textContent='CAPTURE: ERROR';notice(`Capture sources unavailable: ${e.message}`);}
}
async function connectScreen(){
 if(editingOutlines)finishOutlineEdit(false);pause();outlinesAvailable=false;try{
  if(tracker.history.length && !confirm('Changing capture source can mix tables. Connect only to the same shoe, or reset with New shoe. Continue?'))return;
  stream?.getTracks().forEach(t=>t.stop());const id=$('sourceSelect').value;if(!id)throw Error('Choose a capture source first.');
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:id,maxWidth:3840,maxHeight:2160,maxFrameRate:15}}});
  fixture=false;$('fixtureImage').hidden=true;$('screenVideo').hidden=false;autoLocator.reset();lastAutoAnchor=null;autoStartRequested=true;$('screenVideo').onloadeddata=()=>{if(autoStartRequested&&!scanning){scanning=true;render();loop();}};$('screenVideo').srcObject=stream;$('screenPlaceholder').hidden=true;$('captureStatus').textContent='CAPTURE: OK';
  profile.source=id;save();vision.clear();epoch++;tracker.pending={};
  stream.getVideoTracks()[0].onended=()=>{pause();$('captureStatus').textContent='CAPTURE: ENDED';Object.keys(tracker.hands).forEach(k=>tracker.status[k]='NOT VISIBLE');render();};
  notice('Connected. Finding the table, dealer, occupied seats and totals automatically.');
 }catch(e){$('captureStatus').textContent='CAPTURE: ERROR';notice(`Could not capture: ${e.message}. On macOS enable Screen Recording for the launching application and restart.`);}
}
function resetShoe(ask=true){if(ask&&!confirm('Reset the count for a new shoe? Session results are retained.'))return;pause();tracker.resetShoe(profile.decks);vision.clear();handCycle.reset();dealerBeforeClear=null;autoLocator.reset();lastAutoAnchor=null;lastMove='';render();}
function nextRound(){pause();if(!confirm('Start tracking a new hand? Do this only after the previous cards are removed. The shoe count stays.'))return;tracker.nextRound(profile);vision.clear();handCycle.reset();dealerBeforeClear=null;render();}
function undo(){pause();if(tracker.undo())notice('Last confirmed change undone. Scanning paused so it is not immediately reapplied.');else notice('Nothing to undo.');vision.clear();render();}
function parseCards(text){if(!text.trim())return [];return text.trim().toUpperCase().split(/[\s,]+/).map(token=>{const m=token.match(/^(10|[2-9AJQK])([♥♦♣♠?])?$/);if(!m)throw Error(`Invalid card: ${token}. Use ranks 2–10, J, Q, K, A and optional suits.`);return {rank:m[1],suit:m[2]||'?',confidence:100};});}
function manualCorrection(){try{pause();const key=$('targetSelect').value,text=$('manualCards').value;if(text.includes('/')){tracker.setManualSplit(key,text.split('/').map(parseCards));vision.clear();render();notice('Split hands replaced separately; original pair removed from the count. Each hand is manually locked.');return;}const cards=parseCards(text);if(!cards.length&&!confirm('Remove every card in this hand from the count? Use Next hand to retain counted cards.'))return;tracker.setManual(key,cards);vision.clear();render();notice('Hand replaced; count corrected. Manual lock stays until you unlock it or start the next hand.');}catch(e){notice(e.message);}}
function settings(){if(editingOutlines)finishOutlineEdit(false);pause();$('settingsTitle').textContent=localStorage.getItem('cardvision-v21')?'Settings / Profiles':'First-run setup';$('profileSelect').replaceChildren(...Object.entries(profiles).map(([id,p])=>new Option(p.name,id)));$('profileSelect').value=profileId;fillSettings(profile);$('settingsDialog').showModal();}
function fillSettings(p){$('editProfileName').value=p.name;$('deckCount').value=p.decks;$('soft17Rule').value=p.soft17;$('surrenderRule').value=String(p.surrender);$('setupSeat').value=p.seat;$('theme').value=p.theme;$('sounds').checked=p.sounds;$('compact').checked=p.compact;$('confirmFrames').value=p.frames;$('threshold').value=p.threshold;if(p.source)$('setupSource').value=p.source;}
function applySettings(e){e.preventDefault();const id=$('profileSelect').value,base=profiles[id]||initial,deck=+$('deckCount').value,changed=id!==profileId||deck!==profile.decks;
 if(changed&&tracker.history.length&&!confirm('Changing profiles or decks resets the shoe count. Continue?'))return;
 profileId=id;profile={...copy(initial),...copy(base),name:$('editProfileName').value.trim()||initial.name,decks:deck,soft17:$('soft17Rule').value,surrender:$('surrenderRule').value==='true',seat:+$('setupSeat').value,source:$('setupSource').value,theme:$('theme').value,sounds:$('sounds').checked,compact:$('compact').checked,frames:+$('confirmFrames').value,threshold:Math.max(85,Math.min(99,+$('threshold').value||85))};
 if(changed){tracker.resetShoe(deck);handCycle.reset();dealerBeforeClear=null;autoLocator.reset();lastAutoAnchor=null;}
 baseRegions=copy(DEFAULT_REGIONS);outlinesAvailable=false;save();vision.clear();if(profile.source)$('sourceSelect').value=profile.source;$('settingsDialog').close();render();
}
function info(title,text,about=false){$('infoTitle').textContent=title;$('infoBody').textContent=text;$('aboutActions').hidden=!about;$('infoDialog').showModal();}
async function diagnostics(){try{const d=await api.diagnostics();let captureMessage;try{const c=sourceFrame();captureMessage=`OK · ${c.width} × ${c.height}`;}catch{captureMessage='Not connected. Choose a source and click Connect.';}
 info('Diagnostics / Troubleshooting',`Capture: ${captureMessage}\nPermission: ${d.capturePermission}\nRecognition: ${ocrReady?'READY':'ERROR — startup needs an internet connection to download English OCR data; reconnect, then restart.'}\nTemplates: ${window.CARD_TEMPLATES.length} rank examples loaded\nCalibration: ${lastAutoAnchor?'Automatically aligned':'Searching for dealer strip and blue felt'}\nProfile: ${profile.name}\nDealer region: ${profile.regions.dealer?'Configured; validate against the capture':'Missing'}\nPlayer regions: ${Object.keys(profile.regions).filter(k=>/^player/.test(k)).length} configured; empty seats are skipped\nTable: SportsBetting profile selected; not automatically authenticated\nRuntime: Electron ${d.electron} · Node ${d.node} · ${d.platform}\n\n${d.privacy}\n\nIf reads stay VERIFYING: make the casino window visible, increase browser zoom or capture resolution, and use manual correction. Two split stacks require separate verified totals. For clipped cards or unclear splits, edit the feed outlines or enter both hands in Manual Correction separated by /. Resplits beyond two hands require review. An empty screen never resets the shoe.`);
 }catch(e){info('Diagnostics',e.message);}}
function exportSession(format){const rows=tracker.events.flatMap(e=>e.changes?.length?e.changes.map(c=>({timestamp:e.timestamp,round:e.round,seat:c.seat,cards:cardsText(c.cards),total:c.total,confidence:c.confidence,recommendation:c.recommendation||'',running:e.running,trueCount:e.trueCount,result:'',correction:c.correction||'',event:e.type})): [{timestamp:e.timestamp,round:e.round,seat:e.seat||'',cards:cardsText(e.cards||[]),total:e.total??'',confidence:e.type==='manual correction'?100:'',recommendation:'',running:e.running,trueCount:e.trueCount,result:e.result||'',correction:e.type==='manual correction'?'manual replacement':'',event:e.type}]);
 let text;if(format==='json')text=JSON.stringify({version:'2.1.0-dev.3',profile,session:CV.stats(tracker.results),results:tracker.results,ledger:tracker.history,events:rows},null,2);else{const keys=['timestamp','round','seat','cards','total','confidence','recommendation','running','trueCount','result','correction','event'];const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';text=[keys.join(','),...rows.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\r\n');}
 api.exportSession({format,text}).then(r=>{if(r.saved)notice('Session exported.');}).catch(e=>notice(`Export failed: ${e.message}`));}
function recordResult(){try{tracker.recordResult(profile.seat,$('resultSelect').value,$('resultHand').value,$('doubled').checked?2:1);render();}catch(e){notice(e.message);}}
function reviewOutcome(){const parent=`player${profile.seat}`,split=$('resultHand').value!=='main',key=split?parent+'/'+$('resultHand').value.replace('split',''):parent,player=tracker.hands[key]||[],dealer=tracker.hands.dealer||[];const result=CV.outcome(player,dealer,{split,complete:verified(key)&&verified('dealer')&&CV.dealerComplete(dealer,profile)});if(result==='UNKNOWN'){notice('Outcome cannot be determined confidently. Confirm it from the table.');return;}$('resultSelect').value=result;notice(`Suggested outcome: ${result}. Verify it at the table, then click Confirm result.`);}
for(let i=1;i<=7;i++){for(const id of ['mySeat','setupSeat'])$(id).add(new Option(`Seat ${i}`,String(i)));$('targetSelect').add(new Option(`Seat ${i}`,`player${i}`));}
$('targetSelect').value=`player${profile.seat}`;
$('mySeat').onchange=e=>selectSeat(+e.target.value);
$('splitHandSelect').value='1';$('splitHandSelect').onchange=()=>{$('resultHand').value='split'+$('splitHandSelect').value;render();};
$('refreshSourcesBtn').onclick=refreshSources;$('shareBtn').onclick=connectScreen;$('autoScanBtn').onclick=toggleScanning;$('manualScanBtn').onclick=scanOnce;
$('nextRoundBtn').onclick=nextRound;$('newShoeBtn').onclick=()=>resetShoe();$('undoBtn').onclick=undo;$('correctBtn').onclick=manualCorrection;
$('unlockBtn').onclick=()=>{const key=$('targetSelect').value;delete tracker.manualLocks[key];tracker.status[key]='VERIFYING HAND...';vision.clear();render();};
$('targetSelect').onchange=()=>{$('manualCards').value=cardsText(tracker.hands[$('targetSelect').value]||[]).replace('—','');};
$('settingsBtn').onclick=settings;$('settingsForm').onsubmit=applySettings;$('profileSelect').onchange=()=>fillSettings({...copy(initial),...profiles[$('profileSelect').value]});
$('newProfileBtn').onclick=()=>{const id='profile-'+Date.now();profiles[id]={...copy(initial),name:'SportsBetting — New profile'};$('profileSelect').add(new Option(profiles[id].name,id));$('profileSelect').value=id;fillSettings(profiles[id]);};
$('deleteProfileBtn').onclick=()=>{const id=$('profileSelect').value;if(id===profileId){notice('Load another profile before deleting the active profile.');return;}if(confirm('Delete this profile?')){delete profiles[id];save();$('profileSelect').querySelector(`option[value="${id}"]`).remove();$('profileSelect').value=profileId;fillSettings(profile);}};
$('calibrateBtn').onclick=()=>{if(editingOutlines)finishOutlineEdit(false);autoLocator.reset();lastAutoAnchor=null;vision.clear();$('tableStatus').textContent='TABLE: FINDING';notice('Finding the table automatically. Saved outline adjustments are retained. No round number is needed.');if(!scanning)toggleScanning();};
$('overlayBtn').onclick=async()=>{await api.toggleOverlay();setTimeout(render,300);};$('diagnosticsBtn').onclick=diagnostics;
$('aboutBtn').onclick=()=>info('CardVision Counter · 2.1.0-dev.3','Development build based on the supplied CardVision project.\n\nRecognition stays on this computer. OCR language data is downloaded at first startup; update checks contact GitHub. Screenshots are not uploaded or saved by default. Profiles/settings are stored locally; session data is in memory until exported.\n\nRecommendations assume multi-deck blackjack, double after split, dealer peek, and the selected H17/S17 and late-surrender rules. The app never clicks game controls or places bets.\n\nDraw estimates use only the configured shoe and observed cards. Hidden cards are unknown; starting mid-shoe or missed cards reduces accuracy. Helpful means a non-busting draw that increases the total to 17–21; it is a subset of safe draws.\n\nDefault profile: untouched seven-seat reference, numbering right to left. Automatic alignment currently supports the seven-seat SportsBetting layout; unfamiliar layouts remain unverified.\n\nWindows/macOS packaging and live table accuracy still require device testing. 1–2 seconds is a target, not a measured guarantee.',true);
$('updateBtn').onclick=async()=>{const r=await api.checkUpdates();$('infoBody').textContent=r.error||`Installed: ${r.current}\nLatest published stable release: ${r.latest}\n${r.newer?'A newer release is available. Use View releases to review/download it.':'No newer stable release found.'}\nThe application will not overwrite itself.`;};
for(const [id,section] of [['releasesBtn','releases'],['projectBtn',''],['docsBtn','docs'],['issuesBtn','issues']])$(id).onclick=()=>api.openProject(section);
$('exportCsvBtn').onclick=()=>exportSession('csv');$('exportJsonBtn').onclick=()=>exportSession('json');$('recordResultBtn').onclick=recordResult;$('inferResultBtn').onclick=reviewOutcome;
$('clearLogBtn').onclick=()=>{logStart=tracker.events.length;render();};$('clearDealerHistoryBtn').onclick=()=>{tracker.dealerHistory=[];render();};
$('fixtureInput').onchange=e=>{const file=e.target.files[0];if(!file)return;if(editingOutlines)finishOutlineEdit(false);pause();outlinesAvailable=false;if(tracker.history.length&&!confirm('Loading a test screenshot resets the shoe count. Continue?'))return;stream?.getTracks().forEach(t=>t.stop());stream=null;tracker=new CV.Tracker(profile.decks);const url=URL.createObjectURL(file);$('fixtureImage').onload=()=>{URL.revokeObjectURL(url);fixture=true;$('fixtureImage').hidden=false;$('screenVideo').hidden=true;$('screenPlaceholder').hidden=true;$('captureStatus').textContent='CAPTURE: TEST FIXTURE';vision.clear();autoLocator.reset();handCycle.reset();lastAutoAnchor=null;render();scanning=true;loop();notice('Test fixture loaded. Automatically finding the table…');};$('fixtureImage').src=url;};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.addEventListener('keydown',e=>{if(editingOutlines||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;const k=e.key.toLowerCase();if(k===' '){e.preventDefault();toggleScanning();}else if(k==='n')resetShoe();else if(k==='z'&&(e.ctrlKey||e.metaKey)){e.preventDefault();undo();}else if(k==='s')scanOnce();else if(k==='o')$('overlayBtn').click();else if(k===',')settings();else if(k==='r')nextRound();else if(/^[1-7]$/.test(k))selectSeat(+k);});
// Editing happens on the same live feed, while recognition is paused.
const feedEditor=new FeedEditor($('feedOverlay'),()=>{
 const c=$('captureCanvas'),regions=editingOutlines?{...profile.regions,...Object.fromEntries(Object.entries(vision.splitRegions||{}).filter(([k])=>k.endsWith('-total')))}:{...(vision.scanRegions||profile.regions),...(vision.splitRegions||{})};
 return {width:c.width,height:c.height,editing:editingOutlines,visible:outlinesAvailable&&(profile.showOutlines||editingOutlines),regions,search:vision.searchRegions,issues:vision.regionIssues};
},(key,r)=>{
 const base=baseRegions[key]||vision.splitBases[key];if(!base)return;
 profile.regionOverrides[key]=CVRegions.relative(base,r);
 if(baseRegions[key])profile.regions[key]=r;else vision.splitRegions[key]=r;
},key=>{$('outlineTarget').value=key;});
function drawOutlines(){
 $('showOutlines').checked=profile.showOutlines;$('editOutlinesBtn').disabled=!outlinesAvailable;
 $('editOutlinesBtn').textContent=editingOutlines?'Done editing':'Edit outlines';
 for(const id of ['outlineTarget','resetOutlineBtn','resetOutlinesBtn','cancelOutlinesBtn'])$(id).hidden=!editingOutlines;
 $('outlineHelp').textContent=editingOutlines?'LIVE VIDEO · Scanning paused. Drag any outline to move it; drag its white handles to resize. Select small total boxes from the menu. Arrow keys nudge; Shift moves 10 pixels. Click Done editing to save.':'Outlines show the latest scan. Teal: card crops · blue: totals · pink: split hands. Dashed amber: selected seat’s search limit. Red: review needed.';
 feedEditor.draw();
}
function startOutlineEdit(){
 if(!outlinesAvailable){notice('Connect the table and wait for automatic alignment first.');return;}
 resumeAfterEdit=scanning;pause();editingOutlines=true;editBackup=copy(profile.regionOverrides||{});profile.regionOverrides=profile.regionOverrides||{};
 const keys=[...Object.keys(profile.regions),...Object.keys(vision.splitBases||{})];
 $('outlineTarget').replaceChildren(...keys.map(k=>new Option(CVRegions.label(k),k)));feedEditor.selected=`player${profile.seat}`;$('outlineTarget').value=feedEditor.selected;drawOutlines();
}
function finishOutlineEdit(cancel=false){
 if(!editingOutlines)return;if(feedEditor.drag)feedEditor.end({},true);
 if(cancel)profile.regionOverrides=editBackup;profile.regions=CVRegions.apply(baseRegions,profile.regionOverrides);
 editingOutlines=false;epoch++;tracker.pending={};vision.cache?.clear();vision.scanRegions=copy(profile.regions);vision.searchRegions={};vision.regionIssues={};for(const [key,base]of Object.entries(vision.splitBases||{}))vision.splitRegions[key]=CVRegions.applyOne(base,profile.regionOverrides[key]);Object.keys(tracker.hands).forEach(k=>tracker.status[k]='VERIFYING HAND...');save();render();
 notice(cancel?'Outline edits cancelled.':'Outline adjustments saved. They follow automatic table alignment.');
 if(resumeAfterEdit){scanning=true;render();loop();}
}
$('editOutlinesBtn').onclick=()=>editingOutlines?finishOutlineEdit():startOutlineEdit();
$('cancelOutlinesBtn').onclick=()=>finishOutlineEdit(true);
$('showOutlines').onchange=()=>{profile.showOutlines=$('showOutlines').checked;save();drawOutlines();};
$('outlineTarget').onchange=()=>{feedEditor.selected=$('outlineTarget').value;feedEditor.draw();};
$('resetOutlineBtn').onclick=()=>{const key=feedEditor.selected;delete profile.regionOverrides[key];if(baseRegions[key])profile.regions[key]=[...baseRegions[key]];else if(vision.splitBases[key])vision.splitRegions[key]=[...vision.splitBases[key]];feedEditor.draw();};
$('resetOutlinesBtn').onclick=()=>{profile.regionOverrides={};profile.regions=copy(baseRegions);vision.splitRegions={...vision.splitRegions,...vision.splitBases};feedEditor.draw();};
refreshSources();render();
api.warmOcr().then(()=>{ocrReady=true;$('ocrState').textContent='RECOGNITION: READY';}).catch(e=>{$('ocrState').textContent='RECOGNITION: ERROR';notice(`OCR could not load: ${e.message}. See Diagnostics.`);});
if(!localStorage.getItem('cardvision-v21'))settings();
