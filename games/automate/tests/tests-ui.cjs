const assert=require('node:assert/strict');
const css=require('node:fs').readFileSync(__dirname+'/../style.css','utf8');
assert.match(css,/grid-template-rows:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
assert.match(css,/min-height:\s*0;\s*overflow:\s*hidden;/);
const vm=require('node:vm'),fs=require('node:fs');
const window={ChessRules:require('../rules.js'),ArmySetup:require('../setup.js')};
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.listeners={};this.className='';this.textContent='';this.value='600';this.disabled=false;this.hidden=false;this.classList={add:(...names)=>{this.className+=' '+names.join(' ');},toggle:(name,enabled)=>{this.className=this.className.replace(new RegExp('\\b'+name+'\\b','g'),'').trim()+(enabled?' '+name:'');}};}
 setAttribute(name,v){this[name]=v;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;this.textContent='';}
 addEventListener(type,handler){this.listeners[type]=handler;}
 click(){if(!this.disabled) this.listeners.click?.({target:this});}
 closest(selector){return selector==='button.sq'&&this.className.includes('sq')?this:null;}
}
const ids=['board','engineStatus','setupPanel','battlePanel','whitePoints','blackPoints','turn','doneBtn','undoBtn','clearBtn','message','pieceTools','gameStatus','playBtn','stepBtn','moves','thinkMs','rematchBtn','newBtn'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const document={getElementById:id=>{assert.ok(elements[id],id);return elements[id];},createElement:tag=>new Element(tag)};
class FakeWorker{
 constructor(path){assert.equal(path,'./engine/stockfish.js');this.fen='';this.terminated=false;}
 postMessage(cmd){
  if(cmd==='uci')queueMicrotask(()=>this.onmessage?.({data:'uciok'}));
  if(cmd==='isready')queueMicrotask(()=>this.onmessage?.({data:'readyok'}));
  if(cmd.startsWith('position fen '))this.fen=cmd.slice(13);
  if(cmd.startsWith('go movetime ')){
   const state=window.ChessRules.parseFen(this.fen);
   const move=window.ChessRules.legal(state)[0];
   queueMicrotask(()=>this.onmessage?.({data:'bestmove '+window.ChessRules.key(move)}));
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
assert.equal(elements.turn.textContent,'WHITE');
assert.equal(elements.whitePoints.textContent,'0/35');
assert.equal(elements.message.textContent,'');
const choose=p=>{
 const btn=elements.pieceTools.children.find(el=>el.title.startsWith(p+' ('));assert.ok(btn,p);btn.click();};
const pick=i=>{const square=elements.board.children[i];elements.board.listeners.click({target:square});};
choose('K');pick(60);assert.equal(elements.turn.textContent,'BLACK');
choose('K');pick(4);assert.equal(elements.turn.textContent,'WHITE');
choose('Q');pick(51);assert.equal(elements.turn.textContent,'BLACK');
choose('R');pick(8);assert.equal(elements.turn.textContent,'WHITE');
assert.equal(elements.whitePoints.textContent,'9/35');assert.equal(elements.blackPoints.textContent,'5/35');
elements.doneBtn.click();assert.equal(elements.turn.textContent,'BLACK');
elements.doneBtn.click();assert.equal(elements.setupPanel.hidden,true);assert.equal(elements.battlePanel.hidden,false);
assert.equal(elements.board.children.length,64);
setImmediate(()=>{
 assert.equal(elements.gameStatus.textContent==='ENGINE ERROR',false,'Mock UCI initialized');
 assert.ok(elements.moves.children.length>0,'Mock engine made its first legal move');
 assert.match(elements.engineStatus.textContent,/STOCKFISH 11/);
 console.log('Browser UCI simulated: board starts empty, alternating draft, engine initializes and plays legal move.');
});
