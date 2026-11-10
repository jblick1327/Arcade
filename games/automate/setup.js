/* Two-player alternating draft. No dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArmySetup=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
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
function create(){return {armies:{w:Array(64).fill(null),b:Array(64).fill(null)},turn:'w',done:{w:false,b:false},history:[]};}
function snapshot(s){return {armies:{w:s.armies.w.slice(),b:s.armies.b.slice()},turn:s.turn,done:{...s.done}};}
function next(s){let n=snapshot(s);n.history=[...s.history,snapshot(s)];return n;}
function placementError(s,p,i){
 const c=s.turn,a=s.armies[c];
 if(s.done[c])return 'Already done.';
 if(!eligible(c,i))return 'Wrong square.';
 if(p==='X')return a[i]?'':'No piece to erase.';
 if(!Object.hasOwn(COST,p))return 'Choose a piece.';
 if(s.armies.w[i]||s.armies.b[i])return 'Square occupied.';
 if(p==='P'&&(row(i)===0||row(i)===7))return 'Pawns cannot go on the back rank.';
 if(p==='K'&&countKing(a))return 'One king per player.';
 if(points(a)+COST[p]>BUDGET)return 'Not enough points.';
 return '';
}
function perform(s,p,i){
 const error=placementError(s,p,i);
 if(error)return {state:s,error};
 const c=s.turn,other=opponent(c),n=next(s);
 n.armies[c][i]=p==='X'?null:p;
 n.turn=n.done[other]?c:other;
 return {state:n,error:''};
}
function finish(s){const c=s.turn,other=opponent(c);
 if(s.done[c])return {state:s,error:'Already done.'};
 if(countKing(s.armies[c])!==1)return {state:s,error:'Place your king first.'};
 const n=next(s);n.done[c]=true;n.turn=other;
 return {state:n,error:''};
}
function undo(s){if(!s.history.length)return {state:s,error:'Nothing to undo.'};
 const h=s.history.slice(),prev=h.pop();return {state:{...prev,history:h},error:''};}
function complete(s){return s.done.w&&s.done.b;}
function fen(s){const b=Array(64).fill(null);
 for(const color of ['w','b'])for(let i=0;i<64;i++)if(s.armies[color][i])b[i]=color==='w'?s.armies[color][i]:s.armies[color][i].toLowerCase();
 const ranks=[];for(let r=0;r<8;r++){let word='',empty=0;for(let c=0;c<8;c++){const p=b[r*8+c];if(!p)empty++;else {if(empty){word+=empty;empty=0;}word+=p;}}if(empty)word+=empty;ranks.push(word);}
 let castle='';if(b[60]==='K'){if(b[63]==='R')castle+='K';if(b[56]==='R')castle+='Q';}
 if(b[4]==='k'){if(b[7]==='r')castle+='k';if(b[0]==='r')castle+='q';}
 return ranks.join('/')+' w '+(castle||'-')+' - 0 1';
}
return {COST,BUDGET,names,opponent,row,square,eligible,countKing,points,create,placementError,perform,finish,undo,complete,fen};
});
