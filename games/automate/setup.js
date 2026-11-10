/* Two-player draft. Every placement is final. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./rules.js'));
 else root.ArmySetup=factory(root.ChessRules);
})(typeof globalThis!=='undefined'?globalThis:this,function(Chess){
'use strict';
const COST={P:1,N:3,B:3,R:5,Q:9,K:0};
const BUDGET=35;
const names={w:'White',b:'Black'};
const opponent=color=>color==='w'?'b':'w';
const row=i=>Math.floor(i/8);
const square=i=>'abcdefgh'[i%8]+(8-row(i));
const eligible=(color,i)=>Number.isInteger(i)&&i>=0&&i<64&&(color==='w'?row(i)>=5:row(i)<=2);
const countKing=a=>a.filter(x=>x==='K').length;
const points=a=>a.reduce((sum,p)=>sum+(p?COST[p]:0),0);
function create(){return {armies:{w:Array(64).fill(null),b:Array(64).fill(null)},turn:'w',done:{w:false,b:false}};}
function snapshot(s){return {armies:{w:s.armies.w.slice(),b:s.armies.b.slice()},turn:s.turn,done:{...s.done}};}

function pieceError(s,p,i,color){
 const army=s.armies[color];
 if(typeof p!=='string'||!Object.hasOwn(COST,p))return 'Choose a piece.';
 if(!eligible(color,i))return 'Wrong square.';
 if(s.armies.w[i]||s.armies.b[i])return 'Square occupied.';
 if(p==='P'&&(row(i)===0||row(i)===7))return 'Pawns cannot go on the back rank.';
 if(p==='K'&&countKing(army))return 'One king per player.';
 if(points(army)+COST[p]>BUDGET)return 'Not enough points.';
 return '';
}

function validArmy(army,color){
 if(!Array.isArray(army)||army.length!==64)return false;
 const draft=create();
 for(const [i,p] of army.entries()){
  if(p===null)continue;
  if(pieceError(draft,p,i,color))return false;
  draft.armies[color][i]=p;
 }
 return true;
}

function placementError(s,p,i,color=s.turn){
 const error=pieceError(s,p,i,color);
 if(error)return error;
 const otherHasKing=countKing(s.armies[opponent(color)]);
 if(p!=='K'&&(!countKing(s.armies[color])||!otherHasKing))return 'Place both kings first.';
 if(otherHasKing){
  const proposed=snapshot(s);
  proposed.armies[color][i]=p;
  if(!battlePosition(proposed))return 'Both kings must stay out of check.';
 }
 return '';
}

function hasPlacement(s,color){
 const army=s.armies[color];
 const pieces=countKing(army)?['P','N','B','R','Q']:['K'];
 const left=BUDGET-points(army);
 const start=color==='w'?40:0;
 return pieces.some(p=>COST[p]<=left&&army.slice(start,start+24).some((_,i)=>!placementError(s,p,start+i,color)));
}

function settle(s,turn=s.turn){
 const done={w:!hasPlacement(s,'w'),b:!hasPlacement(s,'b')};
 const other=opponent(turn);
 return {...s,done,turn:done[turn]&&!done[other]?other:turn};
}

function perform(s,p,i){
 const error=placementError(s,p,i);
 if(error)return {state:s,error};
 const next=snapshot(s);
 next.armies[s.turn][i]=p;
 return {state:settle(next,opponent(s.turn)),error:''};
}
function complete(s){return s.done.w&&s.done.b;}

function fen(s){const b=Array(64).fill(null);
 for(const color of ['w','b'])for(let i=0;i<64;i++)if(s.armies[color][i])b[i]=color==='w'?s.armies[color][i]:s.armies[color][i].toLowerCase();
 const ranks=[];for(let r=0;r<8;r++){let word='',empty=0;for(let c=0;c<8;c++){const p=b[r*8+c];if(!p)empty++;else {if(empty){word+=empty;empty=0;}word+=p;}}if(empty)word+=empty;ranks.push(word);}
 let castle='';if(b[60]==='K'){if(b[63]==='R')castle+='K';if(b[56]==='R')castle+='Q';}
 if(b[4]==='k'){if(b[7]==='r')castle+='k';if(b[0]==='r')castle+='q';}
 return ranks.join('/')+' w '+(castle||'-')+' - 0 1';
}
function battlePosition(s){
 try{
  const position=Chess.parseFen(fen(s));
  if(!Chess.checked(position,1)&&!Chess.checked(position,-1))return position;
 }catch{}
 return null;
}
return {COST,BUDGET,names,opponent,row,square,eligible,countKing,points,create,snapshot,validArmy,placementError,hasPlacement,settle,perform,complete,fen,battlePosition};
});
