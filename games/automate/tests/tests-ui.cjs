const assert=require('node:assert/strict');
const css=require('node:fs').readFileSync(__dirname+'/../style.css','utf8');
assert.match(css,/grid-template-rows:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
assert.match(css,/min-height:\s*0;\s*overflow:\s*hidden;/);
const vm=require('node:vm'),fs=require('node:fs');
const window={ChessRules:require('../rules.js'),ArmySetup:require('../setup.js')};
const soundEvents=[];
let muted=false;
window.AutomateAudio={
 play:(cue)=>soundEvents.push(cue),
 toggleMute:()=>muted=!muted,
};
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.listeners={};this.className='';this.textContent='';this.value='600';this.disabled=false;this.hidden=false;this.classList={add:(...names)=>{this.className+=' '+names.join(' ');},toggle:(name,enabled)=>{this.className=this.className.replace(new RegExp('\\b'+name+'\\b','g'),'').trim()+(enabled?' '+name:'');}};}
 setAttribute(name,v){this[name]=v;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;this.textContent='';}
 addEventListener(type,handler){this.listeners[type]=handler;}
 click(){if(!this.disabled) this.listeners.click?.({target:this,currentTarget:this});}
 closest(selector){return selector==='button.sq'&&this.className.includes('sq')?this:null;}
}
const ids=['board','engineStatus','setupPanel','battlePanel','whitePoints','blackPoints','whiteComplete','blackComplete','turn','draftHint','message','pieceTools','gameStatus','battleResult','playBtn','stepBtn','moves','thinkMs','sound','rematchBtn','newBtn'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const document={getElementById:id=>{assert.ok(elements[id],id);return elements[id];},createElement:tag=>new Element(tag)};
const commands=[];
let deliveredMoves=0;
class FakeWorker{
 constructor(path){assert.equal(path,'./engine/stockfish.js');this.fen='';this.terminated=false;}
 postMessage(cmd){
  commands.push(cmd);
  if(cmd==='uci')queueMicrotask(()=>this.onmessage?.({data:'uciok'}));
  if(cmd==='isready')queueMicrotask(()=>this.onmessage?.({data:'readyok'}));
  if(cmd.startsWith('position fen '))this.fen=cmd.slice(13);
  if(cmd.startsWith('go movetime ')){
   const state=window.ChessRules.parseFen(this.fen);
   if(deliveredMoves++===0){
    const capture=window.ChessRules.fromUci(state,'d3d6');
    assert.ok(capture,'fixture opens with a legal capture');
    queueMicrotask(()=>this.onmessage?.({data:'bestmove d3d6'}));
   }
  }
 }
 terminate(){this.terminated=true;}
}
const context={window,document,console,location:{protocol:'http:'},Worker:FakeWorker,
 fetch:async(url,options={})=>({ok:true,async json(){return {state:'ready'};},status:200}),
 setTimeout:()=>1,clearTimeout:()=>{},};
vm.runInNewContext(fs.readFileSync(__dirname+'/../app.js','utf8'),context);
assert.equal(elements.board.children.length,64);
assert.ok(elements.board.children.every(b=>!b.children.some(x=>x.className?.includes('piece'))),'Initially empty');
assert.equal(elements.turn.textContent,'White is drafting');
assert.equal(elements.whitePoints.textContent,'35 points left');
assert.equal(elements.whiteComplete.hidden,true);
assert.match(elements.draftHint.textContent,/king/);
assert.equal(elements.message.textContent,'');
elements.sound.click();
assert.equal(elements.sound.textContent,'Unmute sound');
elements.sound.click();
assert.equal(elements.sound.textContent,'Mute sound');
const choose=name=>{
 const btn=elements.pieceTools.children.find(el=>el.children[1].textContent.startsWith(name));assert.ok(btn,name);btn.click();};
const pick=i=>{const square=elements.board.children[i];elements.board.listeners.click({target:square});};
const highlighted=()=>elements.board.children.filter(square=>square.className.includes('deploy'));
assert.equal(highlighted().length,24,'The draft starts with king placement');
choose('Pawn');assert.equal(highlighted().length,0,'Other pieces wait for both kings');
const A=window.ArmySetup;
let draft=A.create();
function place(piece,index){
 const names={K:'King',P:'Pawn',Q:'Queen',R:'Rook',N:'Knight',B:'Bishop'};
 choose(names[piece]);pick(index);
 const action=A.perform(draft,piece,index);
 assert.equal(action.error,'');
 draft=action.state;
}
place('K',60);assert.equal(elements.turn.textContent,'Black is drafting');
place('K',4);assert.equal(elements.turn.textContent,'White is drafting');
choose('King');assert.equal(highlighted().length,0,'A second king has no legal squares');
place('Q',43);assert.equal(elements.turn.textContent,'Black is drafting');
place('R',19);assert.equal(elements.turn.textContent,'White is drafting');
assert.equal(elements.whitePoints.textContent,'26 points left');assert.equal(elements.blackPoints.textContent,'30 points left');
while(!A.complete(draft)){
 const next=['N','B','P','R','Q'].flatMap(p=>Array.from({length:64},(_,i)=>[p,i]))
  .find(([p,i])=>!A.placementError(draft,p,i));
 assert.ok(next);
 place(...next);
}
assert.equal(elements.setupPanel.hidden,true);
assert.equal(elements.battlePanel.hidden,false);
assert.ok(soundEvents.filter(cue=>cue==='draft').length>=2,'Draft placement sounds are classified');
assert.equal(elements.board.children.length,64);
setImmediate(()=>{
 assert.equal(elements.gameStatus.textContent==='ENGINE ERROR',false,'Mock UCI initialized');
 assert.ok(elements.moves.children.length>0,'Mock engine made its first legal move');
 assert.equal(commands.filter(cmd=>cmd==='go movetime 600').length,2);
 assert.ok(elements.board.children[19].className.includes('capture'),'Next search preserves the capture flash');
 assert.equal(soundEvents.at(-1),'capture');
 assert.match(elements.engineStatus.textContent,/STOCKFISH 11/);
 console.log('Browser UCI simulated: board starts empty, alternating draft, engine initializes and plays legal move.');
});
