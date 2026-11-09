/* Automate — two humans take turns drafting; Stockfish Lite plays the game. */
(() => {
'use strict';
const A=window.ArmySetup,R=window.ChessRules,$=id=>document.getElementById(id);
const ICON={w:{P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'},b:{P:'♟︎',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'}};
let draft=A.create(),phase='draft',brush='P';
let game=null,worker=null,ready=false,searching=false,waiting=false,discard=false,timer=null,timeout=null,engineId=0;
const side=c=>c==='w'?'WHITE':'BLACK';
const colorOf=p=>p===p.toUpperCase()?'w':'b';
const delay=250;
// Online (Arcade match) state. Everything below is inert when no match is attached.
let online=false,match=null,you=null,busy=false,engineStarted=false;
const WAITING='WAITING FOR OPPONENT';
const myColor=()=>you===0?'w':you===1?'b':null;
function canAct(){return !online||(!busy&&match&&match.status==='active'&&you!==null&&match.turn===you&&phase==='draft'&&draft.turn===myColor());}
function amRunner(){return online&&phase==='battle'&&match&&match.state&&you!==null&&match.state.runner===you;}
function sharedDraft(d){return {armies:d.armies,turn:d.turn,done:d.done};}
function info(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function engineInfo(text){$('engineStatus').textContent=text;}
function setupBoardPieces(){const b=Array(64).fill(null);for(const c of ['w','b'])for(let i=0;i<64;i++)if(draft.armies[c][i])b[i]=c==='w'?draft.armies[c][i]:draft.armies[c][i].toLowerCase();return b;}
function renderBoard(){const b=phase==='draft'?setupBoardPieces():Array.from({length:64},(_,i)=>game.history.at(-1).b[Math.floor(i/8)*16+i%8]);const board=$('board');board.replaceChildren();
 for(let i=0;i<64;i++){
  const r=Math.floor(i/8),c=i%8,p=b[i],button=document.createElement('button');button.type='button';button.dataset.index=i;button.className='sq '+((r+c)%2?'dark':'light');
  button.disabled=phase!=='draft'||!canAct();
  if(phase==='draft'&&A.eligible(draft.turn,i))button.classList.add('deploy');
  if(phase==='battle'&&game.last&&(game.last.from===A.square(i)||game.last.to===A.square(i)))button.classList.add('last');
  button.setAttribute('aria-label',A.square(i)+(p?' '+(p===p.toUpperCase()?'white ':'black ')+p.toUpperCase():' empty'));
  if(p){const span=document.createElement('span');span.className='piece '+colorOf(p);span.textContent=ICON[colorOf(p)][p.toUpperCase()];button.append(span);}
  if(c===0){const label=document.createElement('span');label.className='coord rank';label.textContent=8-r;button.append(label);}
  if(r===7){const label=document.createElement('span');label.className='coord file';label.textContent='abcdefgh'[c];button.append(label);}
  board.append(button);
 }
}
function renderTools(){const tools=$('pieceTools');tools.replaceChildren();for(const p of ['P','N','B','R','Q','K','X']){
 const button=document.createElement('button');button.type='button';button.className='tool'+(brush===p?' selected':'');button.setAttribute('aria-pressed',String(brush===p));button.disabled=!canAct();
 const sym=document.createElement('span');sym.className='symbol';sym.textContent=p==='X'?'⌫':ICON[draft.turn][p];
 const label=document.createElement('span');label.className='cost';label.textContent=p==='X'?'ERASE':p+' '+A.COST[p];
 button.append(sym,label);button.title=p==='X'?'Erase':p+' ('+A.COST[p]+')';button.addEventListener('click',()=>{brush=p;renderTools();info('');});tools.append(button);
 }}
function render(){
 $('whitePoints').textContent=A.points(draft.armies.w)+'/35';$('blackPoints').textContent=A.points(draft.armies.b)+'/35';
 $('setupPanel').hidden=phase!=='draft';$('battlePanel').hidden=phase!=='battle';
 if(phase==='draft'){
  $('turn').textContent=side(draft.turn)+(online&&canAct()?' - YOUR TURN':'');
  $('doneBtn').disabled=A.countKing(draft.armies[draft.turn])!==1||!canAct();
  $('undoBtn').disabled=draft.history.length===0;
  renderTools();
 } else {
  const state=R.status(game.history),eng=ready||(online&&!amRunner());
  $('gameStatus').textContent=game.finished?(game.drawClaim?'Draw: '+game.drawClaim:state.text):eng?(game.paused?'PAUSED':state.text):'LOADING...';
  $('playBtn').disabled=!ready||game.finished;
  $('playBtn').textContent=game.paused?'GO':'PAUSE';
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
$('board').addEventListener('click',e=>{const b=e.target.closest('button.sq');if(!b||phase!=='draft'||!canAct())return;useResult(A.perform(draft,brush,Number(b.dataset.index)));});
function validate(s){let state;try{state=R.parseFen(A.fen(s));}catch(e){return {error:e.message};}
 if(R.checked(state,1)||R.checked(state,-1))return {error:'King in check. UNDO and change pieces.'};
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
function cancelTimer(){if(timer){clearTimeout(timer);timer=null;}waiting=false;}
function killEngine(){
 engineId++;cancelTimer();clearTimeout(timeout);
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
    send('setoption name UCI_LimitStrength value false');
    send('setoption name Skill Level value 20');
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
function requestMove(){if(phase!=='battle'||!ready||searching||waiting||game.finished||game.paused&&!game.pendingStep)return;
 if(doneIfFinished()){render();return;}
 searching=true;send('position fen '+R.toFen(game.history.at(-1)));send('go movetime '+game.thinkMs);render();}
function bestMove(best){if(!searching)return;searching=false;
 if(discard){discard=false;requestMove();return;}
 if(phase!=='battle'||game.finished||game.paused&&!game.pendingStep)return;
 const before=game.history.at(-1),move=best&&best!=='(none)'?R.fromUci(before,best):null;
 if(!move){if(doneIfFinished()){render();return;}engineFailed(new Error('Illegal move from engine: '+best));return;}
 game.uci.push(R.key(move));game.moves.push(R.san(before,move));game.last={from:R.sq(move[0]),to:R.sq(move[1])};game.history.push(R.apply(before,move));game.pendingStep=false;
 doneIfFinished();render();
 if(online){publishMove();return;}
 scheduleNext();
}
function scheduleNext(){if(!game.paused&&!game.finished){waiting=true;timer=setTimeout(()=>{waiting=false;timer=null;requestMove();},delay);}}
$('playBtn').addEventListener('click',()=>{
 if(phase!=='battle'||!ready||game.finished)return;
 if(game.paused){game.paused=false;game.pendingStep=false;render();requestMove();}else{
  game.paused=true;game.pendingStep=false;cancelTimer();if(searching){discard=true;send('stop');}render();
 }
});
$('stepBtn').addEventListener('click',()=>{
 if(phase!=='battle'||!ready||game.finished)return;
 game.paused=true;game.pendingStep=true;cancelTimer();if(searching){discard=true;send('stop');}else requestMove();render();
});
$('thinkMs').addEventListener('change',e=>{if(game)game.thinkMs=Number(e.target.value);});
$('rematchBtn').addEventListener('click',()=>{killEngine();const check=validate(draft);if(check.error){engineInfo(check.error);return;}startBattle(check.state);});
$('newBtn').addEventListener('click',()=>{killEngine();phase='draft';draft=A.create();game=null;brush='P';engineInfo('');info('');render();});
render();engineInfo('');

/* ---------- Online play through the Arcade SDK ---------- */
function onlineChrome(){
 const runner=amRunner(),draftPhase=phase==='draft';
 $('undoBtn').hidden=true;$('clearBtn').hidden=true;$('rematchBtn').hidden=true;$('newBtn').hidden=true;
 $('playBtn').hidden=!runner;$('stepBtn').hidden=!runner;$('thinkMs').parentElement.hidden=!runner;
}
function replay(s,prev){
 let cur=R.parseFen(A.fen(s.draft));
 const g={history:[cur],moves:[],uci:[],last:null,paused:false,finished:false,drawClaim:'',pendingStep:false,thinkMs:Number($('thinkMs').value)};
 if(prev){g.paused=prev.paused;}
 for(const u of s.moves){
  const mv=R.fromUci(cur,u);if(!mv)break;
  g.moves.push(R.san(cur,mv));g.uci.push(u);g.last={from:R.sq(mv[0]),to:R.sq(mv[1])};cur=R.apply(cur,mv);g.history.push(cur);
 }
 return g;
}
function winnerOf(){const s=game.history.at(-1);return R.legal(s).length===0&&R.checked(s)?(s.t===1?1:0):null;}
function applyMatch(m){
 if(!m)return;
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
 if(m.status==='waiting')info(WAITING);else if($('message').textContent===WAITING)info('');
 render();
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
