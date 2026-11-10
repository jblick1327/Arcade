/* Automate — two humans take turns drafting; Stockfish Lite plays the game. */
(() => {
'use strict';
const A=window.ArmySetup,R=window.ChessRules,$=id=>document.getElementById(id);
const ICON={w:{P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'},b:{P:'♟︎',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'}};
const PIECE={P:'Pawn',N:'Knight',B:'Bishop',R:'Rook',Q:'Queen',K:'King',X:'Erase'};
let draft=A.create(),phase='draft',brush='P';
let game=null,worker=null,ready=false,searching=false,discard=false,timeout=null,engineId=0;
const colorOf=p=>p===p.toUpperCase()?'w':'b';
// Online (Arcade match) state. Everything below is inert when no match is attached.
let online=false,match=null,you=null,busy=false,engineStarted=false;
const myColor=()=>you===0?'w':you===1?'b':null;
function canAct(){return !online||(!busy&&match&&match.status==='active'&&you!==null&&match.turn===you&&phase==='draft'&&draft.turn===myColor());}
function amRunner(){return online&&phase==='battle'&&match&&match.state&&you!==null&&match.state.runner===you;}
function sharedDraft(d){return {armies:d.armies,turn:d.turn,done:d.done};}
function info(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function engineInfo(text){$('engineStatus').textContent=text;}
function sound(cue,options){
 if($('sound').checked)window.AutomateAudio?.play(cue,options);
}
function setStatus(id,text){
 const node=$(id);
 if(node.textContent!==text)node.textContent=text;
}
function setupBoardPieces(){const b=Array(64).fill(null);for(const c of ['w','b'])for(let i=0;i<64;i++)if(draft.armies[c][i])b[i]=c==='w'?draft.armies[c][i]:draft.armies[c][i].toLowerCase();return b;}
function renderBoard(){
 const b=phase==='draft'?setupBoardPieces():Array.from({length:64},(_,i)=>game.history.at(-1).b[Math.floor(i/8)*16+i%8]);
 const board=$('board'),focused=document.activeElement?.dataset.index;
 const drafting=phase==='draft'&&canAct();
 board.replaceChildren();
 for(let i=0;i<64;i++){
  const r=Math.floor(i/8),c=i%8,p=b[i],square=A.square(i);
  const button=document.createElement('button');
  button.type='button';button.dataset.index=i;button.className='sq '+((r+c)%2?'dark':'light');
  button.disabled=!drafting;
  const legal=drafting&&!A.placementError(draft,brush,i);
  if(legal)button.classList.add('deploy');
  if(phase==='battle'&&game.last&&(game.last.from===square||game.last.to===square))button.classList.add('last');
  const occupant=p?A.names[colorOf(p)]+' '+PIECE[p.toUpperCase()]:'empty';
  const action=brush==='X'?'can erase':'can place '+PIECE[brush];
  button.setAttribute('aria-label',square+', '+occupant+(legal?', '+action:''));
  if(p){const span=document.createElement('span');span.className='piece '+colorOf(p);span.textContent=ICON[colorOf(p)][p.toUpperCase()];button.append(span);}
  if(c===0){const label=document.createElement('span');label.className='coord rank';label.textContent=8-r;button.append(label);}
  if(r===7){const label=document.createElement('span');label.className='coord file';label.textContent='abcdefgh'[c];button.append(label);}
  board.append(button);
 }
 if(drafting&&focused!==undefined)board.children[focused]?.focus({preventScroll:true});
}
function renderTools(){const tools=$('pieceTools');tools.replaceChildren();for(const p of ['P','N','B','R','Q','K','X']){
 const button=document.createElement('button');button.type='button';button.className='tool';button.setAttribute('aria-pressed',String(brush===p));button.disabled=!canAct();
 const sym=document.createElement('span');sym.className='symbol';sym.textContent=p==='X'?'⌫':ICON[draft.turn][p];
 sym.setAttribute('aria-hidden','true');
 const label=document.createElement('span');label.className='cost';label.textContent=p==='X'?PIECE[p]:PIECE[p]+' · '+A.COST[p];
 button.append(sym,label);
 button.addEventListener('click',()=>{
  brush=p;
  for(const tool of tools.children)tool.setAttribute('aria-pressed',String(tool===button));
  info('');renderDraftHint();renderBoard();
 });
 tools.append(button);
 }}
function renderDraftHint(){
 let tip='';
 if(canAct()){
  const army=draft.armies[draft.turn];
  const king=A.countKing(army);
  if(brush==='X')tip='Choose an outlined piece to erase it.';
  else if(brush==='K'&&king)tip='Your king is already on the board.';
  else if(A.COST[brush]>A.BUDGET-A.points(army))tip='That piece costs more points than you have left.';
  else if(!king)tip='Place a king before you lock your army.';
  else tip='Choose a piece, then select an outlined square.';
 }
 $('draftHint').textContent=tip;
}
function render(){
 $('whitePoints').textContent=(A.BUDGET-A.points(draft.armies.w))+' points left';
 $('blackPoints').textContent=(A.BUDGET-A.points(draft.armies.b))+' points left';
 $('whiteLocked').hidden=!draft.done.w;$('blackLocked').hidden=!draft.done.b;
 $('setupPanel').hidden=phase!=='draft';$('battlePanel').hidden=phase!=='battle';
 if(phase==='draft'){
  const side=A.names[draft.turn];
  let turn=side+' is drafting';
  if(online){
   if(match.status==='waiting')turn='Waiting for opponent';
   else if(busy)turn='Saving your draft…';
   else if(canAct())turn='Your turn · '+side;
  }
  setStatus('turn',turn);renderDraftHint();
  $('doneBtn').disabled=A.countKing(draft.armies[draft.turn])!==1||!canAct();
  $('undoBtn').disabled=draft.history.length===0;
  renderTools();
 } else {
  const state=R.status(game.history),eng=ready||(online&&!amRunner());
  const label=game.finished&&game.drawClaim?'Draw by '+game.drawClaim+'.':state.text;
  setStatus('gameStatus',eng||game.finished?label+(game.paused&&!game.finished?' · Paused':''):'Loading Stockfish…');
  $('gameStatus').classList.toggle('finished',game.finished);
  setStatus('battleResult',game.finished?label:'');
  $('playBtn').disabled=!ready||game.finished;
  $('playBtn').textContent=game.paused?'Resume':'Pause';
  $('stepBtn').disabled=!ready||game.finished;
  $('moves').replaceChildren();
  for(let i=0;i<game.moves.length;i++){
   const div=document.createElement('div');div.textContent=Math.floor(i/2)+1+(i%2?'... ':'. ')+game.moves[i];$('moves').append(div);
  }
  $('moves').scrollTop=$('moves').scrollHeight;
 }
 renderBoard();
 if(online)onlineChrome();
}
function useResult(result){if(result.error){info(result.error,true);return false;}
 if(online){submitDraft(result.state);return true;}
 draft=result.state;brush='P';info('');render();return true;}
$('board').addEventListener('click',e=>{
 const button=e.target.closest('button.sq');
 if(!button||phase!=='draft'||!canAct())return;
 const chosenBrush=brush;
 if(useResult(A.perform(draft,brush,Number(button.dataset.index)))&&chosenBrush!=='X')sound('draft');
});
function validate(s){let state;try{state=R.parseFen(A.fen(s));}catch(e){return {error:e.message};}
 if(R.checked(state,1)||R.checked(state,-1))return {error:'Both kings must start out of check. Adjust your draft to continue.'};
 return {state};
}
function startBattle(start){phase='battle';game={history:[start],moves:[],uci:[],last:null,paused:false,finished:false,drawClaim:'',pendingStep:false,thinkMs:Number($('thinkMs').value)};render();startEngine();}
$('doneBtn').addEventListener('click',()=>{
 if(!canAct())return;
 const result=A.finish(draft);
 if(result.error){info(result.error,true);return;}
 if(A.complete(result.state)){
  const check=validate(result.state);
  if(check.error){info(check.error,true);return;}
  if(online){submitBattle(result.state);return;}
  draft=result.state;startBattle(check.state);
 }else useResult(result);
});
$('undoBtn').addEventListener('click',()=>useResult(A.undo(draft)));
$('clearBtn').addEventListener('click',()=>{draft=A.create();brush='P';info('');render();});
function send(cmd){if(worker)worker.postMessage(cmd);}
function killEngine(){
 engineId++;clearTimeout(timeout);
 if(worker){worker.terminate();worker=null;}
 ready=false;searching=false;discard=false;
}
function engineFailed(error){
 console.error('[Automate engine]',error);
 killEngine();if(game)game.paused=true;
 const msg=(error?.message||String(error)).replace(/\s+/g,' ').slice(0,230);
 engineInfo('ERROR: '+msg);
 if(phase==='battle'){
  $('gameStatus').textContent='ENGINE ERROR';
  $('moves').title=msg;renderBoard();
  $('playBtn').disabled=true;$('stepBtn').disabled=true;
 }
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function checkEngine(id){
 if(location.protocol==='file:')throw Error('Open this game through the site, not as a file.');
 for(const name of ['stockfish.js','stockfish.wasm']){
  if(id!==engineId)return false;
  let response;
  try{response=await fetch('./engine/'+name,{method:'HEAD',cache:'no-store'});}
  catch(e){throw Error('Cannot read engine files: '+e.message);}
  if(!response.ok)throw Error(name+' missing (HTTP '+response.status+'). Reload the page, or tell the site owner.');
 }
 return id===engineId;
}
async function startEngine(){
 killEngine();const id=engineId;
 engineInfo('LOADING STOCKFISH...');
 try{
  if(!await checkEngine(id))return;
  if(id!==engineId)return;
  worker=new Worker('./engine/stockfish.js');
 }catch(e){if(id===engineId)engineFailed(e);return;}
 worker.onerror=e=>{if(id===engineId)engineFailed(new Error(e.message||'Worker failed. Check the browser console.'));};
 worker.onmessageerror=e=>{if(id===engineId)engineFailed(new Error('Unreadable engine message.'));};
 worker.onmessage=e=>{
  if(id!==engineId)return;
  for(const raw of String(e.data).split(/\r?\n/)){
   const line=raw.trim();
   if(line==='uciok'){
    send('setoption name MultiPV value 1');
    send('setoption name Hash value 32');
    send('isready');
   }else if(line==='readyok'){
    clearTimeout(timeout);ready=true;engineInfo('STOCKFISH 11');render();requestMove();
   }else if(line.startsWith('bestmove ')){
    const match=/^bestmove\s+(\S+)/.exec(line);bestMove(match?.[1]);
   }
  }
 };
 send('uci');
 timeout=setTimeout(()=>{if(id===engineId&&!ready)engineFailed(new Error('Engine initialization timed out. Check WASM and browser console.'));},45000);
}
function doneIfFinished(){if(phase!=='battle'||!game)return true;const st=R.status(game.history);if(st.done||st.claim){game.finished=true;game.paused=true;game.pendingStep=false;game.drawClaim=st.claim||'';return true;}return false;}
function requestMove(){if(phase!=='battle'||!ready||searching||game.finished||game.paused&&!game.pendingStep)return;
 if(doneIfFinished()){render();return;}
 searching=true;send('position fen '+R.toFen(game.history.at(-1)));send('go movetime '+game.thinkMs);}
function recordMove(g,before,move,uci){
 const [from,to,,flag]=move;
 const target=(to>>4)*8+(to&7);
 const capture=flag==='ep'||before.b[to]!=='.';
 g.uci.push(uci);
 g.moves.push(R.san(before,move));
 g.last={from:R.sq(from),to:R.sq(to),target,capture,castle:flag==='castle',promotion:Boolean(move[2])};
 g.history.push(R.apply(before,move));
}
function moveFeedback(){
 if(!game?.last)return;
 const {capture,target,castle,promotion}=game.last;
 if(capture)$('board').children[target].classList.add('capture');
 const mate=game.finished&&game.moves.at(-1).endsWith('#');
 const cue=mate?'checkmate':game.finished?'draw':promotion?'promotion':castle?'castle':capture?'capture':'move';
 sound(cue,{capture});
}
function bestMove(best){if(!searching)return;searching=false;
 if(discard){discard=false;requestMove();return;}
 if(phase!=='battle'||game.finished||game.paused&&!game.pendingStep)return;
 const before=game.history.at(-1),move=best&&best!=='(none)'?R.fromUci(before,best):null;
 if(!move){if(doneIfFinished()){render();return;}engineFailed(new Error('Illegal move from engine: '+best));return;}
 recordMove(game,before,move,R.key(move));game.pendingStep=false;
 doneIfFinished();render();moveFeedback();
 if(online){publishMove();return;}
 scheduleNext();
}
function scheduleNext(){if(!game.paused&&!game.finished)requestMove();}
$('playBtn').addEventListener('click',()=>{
 if(phase!=='battle'||!ready||game.finished)return;
 if(game.paused){game.paused=false;game.pendingStep=false;render();requestMove();}else{
  game.paused=true;game.pendingStep=false;if(searching){discard=true;send('stop');}render();
 }
});
$('stepBtn').addEventListener('click',()=>{
 if(phase!=='battle'||!ready||game.finished)return;
 game.paused=true;game.pendingStep=true;if(searching){discard=true;send('stop');}else requestMove();render();
});
$('thinkMs').addEventListener('change',e=>{if(game)game.thinkMs=Number(e.target.value);});
$('sound').addEventListener('change',()=>{
 window.AutomateAudio?.setEnabled($('sound').checked);
});
$('sfxVolume').addEventListener('input',e=>{
 $('sfxValue').textContent=e.target.value+'%';
 window.AutomateAudio?.setVolume(e.target.value);
});
$('rematchBtn').addEventListener('click',()=>{killEngine();const check=validate(draft);if(check.error){engineInfo(check.error);return;}startBattle(check.state);});
$('newBtn').addEventListener('click',()=>{killEngine();phase='draft';draft=A.create();game=null;brush='P';engineInfo('');info('');render();});
render();engineInfo('');

/* ---------- Online play through the Arcade SDK ---------- */
function onlineChrome(){
 const runner=amRunner();
 $('undoBtn').hidden=true;$('clearBtn').hidden=true;$('rematchBtn').hidden=true;$('newBtn').hidden=true;
 $('playBtn').hidden=!runner;$('stepBtn').hidden=!runner;$('engineSettings').hidden=!runner;
}
function replay(s,prev){
 let cur=R.parseFen(A.fen(s.draft));
 const g={history:[cur],moves:[],uci:[],last:null,paused:false,finished:false,drawClaim:'',pendingStep:false,thinkMs:Number($('thinkMs').value)};
 if(prev){g.paused=prev.paused;}
 for(const u of s.moves){
  const mv=R.fromUci(cur,u);if(!mv)break;
  recordMove(g,cur,mv,u);cur=g.history.at(-1);
 }
 return g;
}
function winnerOf(){const s=game.history.at(-1);return R.legal(s).length===0&&R.checked(s)?(s.t===1?1:0):null;}
function applyMatch(m){
 if(!m)return;
 const previousMoves=game?.uci.length??(match?0:undefined);
 match=m;you=m.you;
 const s=m.state||{phase:'draft',draft:sharedDraft(A.create()),runner:null,moves:[]};
 draft={...s.draft,history:[]};
 if(s.phase==='battle'){
  const runner=you!==null&&s.runner===you;
  if(!(runner&&game&&engineStarted&&m.status!=='done')){
   phase='battle';game=replay(s,game);doneIfFinished();
   if(!runner){const r=m.players[s.runner];engineInfo(r?r.name+"'s browser is running the engine":'');}
   if(runner&&m.status==='active'&&!engineStarted){
    engineStarted=true;
    if(game.finished)publishMove();else startEngine();
   }
  }
 }else{phase='draft';game=null;}
 render();
 if(phase==='battle'&&!amRunner()&&previousMoves!==undefined&&game.uci.length>previousMoves)moveFeedback();
}
async function submitDraft(next){
 draft=next;brush='P';info('');busy=true;render();
 const r=await Arcade.match.update({state:{phase:'draft',draft:sharedDraft(next),runner:null,moves:[]},turn:next.turn==='w'?0:1});
 busy=false;
 if(r.ok){applyMatch(r.match);return;}
 applyMatch(r.match||Arcade.match.get());
 info(r.reason==='conflict'?'Out of date — refreshed.':'Could not save — refreshed.',true);
}
async function submitBattle(done){
 busy=true;render();
 const r=await Arcade.match.update({state:{phase:'battle',draft:sharedDraft(done),runner:you,moves:[]},turn:you});
 busy=false;
 if(r.ok){applyMatch(r.match);return;}
 applyMatch(r.match||Arcade.match.get());
 info(r.reason==='conflict'?'Out of date — refreshed.':'Could not save — refreshed.',true);
}
// Runner only: send the moves so far (and the result once the game is over). One request at a time.
async function publishMove(){
 const body={state:{phase:'battle',draft:sharedDraft(draft),runner:you,moves:game.uci.slice()},turn:you};
 if(game.finished)body.result={winner:winnerOf()};
 for(;;){
  const r=await Arcade.match.update(body);
  if(r.ok)break;
  const cur=r.match||Arcade.match.get();
  // Our earlier write may have landed even though the reply was lost.
  if(cur&&cur.state&&cur.state.moves&&cur.state.moves.length===game.uci.length&&(!game.finished||cur.status==='done'))break;
  if(r.reason==='conflict'){engineFailed(new Error('Out of sync with the server. Reload the page.'));return;}
  await sleep(1500);
 }
 scheduleNext();
}
if(window.Arcade){
 Arcade.ready().then(({match:m})=>{
  if(!m)return; // local mode: nothing changes
  online=true;
  Arcade.match.onChange(applyMatch);
  applyMatch(m);
 });
}
})();
