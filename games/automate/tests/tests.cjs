const assert=require('node:assert/strict');const R=require('../rules.js');
const start=R.parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
function perft(s,d){if(!d)return 1;return R.legal(s).reduce((sum,m)=>sum+perft(R.apply(s,m),d-1),0)}
assert.equal(perft(start,1),20);assert.equal(perft(start,2),400);assert.equal(perft(start,3),8902);
let s=start;for(const m of ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','e1g1']){const a=R.fromUci(s,m);assert.ok(a,'Legal '+m);s=R.apply(s,a);}assert.equal(s.b[R.index('g1')],'K');assert.equal(s.b[R.index('f1')],'R');
const ep=R.parseFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');let m=R.fromUci(ep,'e5d6');assert.ok(m);assert.equal(R.apply(ep,m).b[R.index('d5')],'.');
const pr=R.parseFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');assert.equal(R.apply(pr,R.fromUci(pr,'a7a8q')).b[R.index('a8')],'Q');
const mate=R.parseFen('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');assert.match(R.status([mate]).text,/Checkmate/);
console.log('Rules verified (perft 20/400/8902, castling, en passant, promotion, checkmate).');
