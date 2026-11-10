const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const oscillators=[],gains=[],sources=[];
class Param{
 constructor(value=1){this.value=value;this.events=[];}
 setValueAtTime(value,time){this.value=value;this.events.push(['set',value,time]);}
 exponentialRampToValueAtTime(value,time){this.value=value;this.events.push(['ramp',value,time]);}
 setTargetAtTime(value,time,constant){this.value=value;this.events.push(['target',value,time,constant]);}
}
class Node{
 constructor(){this.frequency=new Param(440);this.gain=new Param();this.playbackRate=new Param(1);}
 connect(dest){this.output=dest;return dest;}
 disconnect(){}
 start(time){this.started=time;}
 stop(time){this.stopped=time;}
}
class AudioContext{
 constructor(){this.currentTime=1;this.state='running';this.destination=new Node();}
 createGain(){const gain=new Node();gains.push(gain);return gain;}
 createOscillator(){const oscillator=new Node();oscillators.push(oscillator);return oscillator;}
 createBufferSource(){const source=new Node();sources.push(source);return source;}
}
const window={AudioContext};
vm.runInNewContext(fs.readFileSync(__dirname+'/../audio.js','utf8'),{
 window,console,fetch:()=>new Promise(()=>{}),
});
const audio=window.ScarabAudio;
assert.ok(audio,'Audio module must initialize');
audio.play('place');
assert.equal(oscillators.length,0,'Muted by default');
audio.setEnabled(true);
assert.equal(gains[0].gain.value,.7*.85,'Direct output has headroom');
function expect(type,details,oscillatorCount){
 const before=oscillators.length;
 audio.play(type,details);
 assert.equal(oscillators.length-before,oscillatorCount,type+' event layer count');
 return oscillators.slice(before);
}
expect('place',{},1);
expect('column-clear',{},1);
expect('column-clear',{award:'Blackjack'},2);
expect('column-clear',{award:'Large 21'},2);
expect('column-clear',{award:'Full House'},3);
expect('column-clear',{award:'Super Blackjack'},3);
expect('column-clear',{award:'Double Blackjack'},3);
expect('board-clear',{award:'Straight'},1);
expect('board-clear',{award:'5 of a Kind',deckClear:true},3);
expect('place',{gameOver:true},3);
const layered=expect('column-clear',{award:'Blackjack',deckClear:true,gameOver:true},6);
assert.ok(layered[0].started<layered[1].started,'Bonus accent follows physical clear');
assert.ok(layered.at(-1).started>layered[0].started,'Game over resolves after the clear');
audio.setVolume(40);
assert.equal(gains[0].gain.value,.4*.85);
audio.setEnabled(false);
assert.equal(gains[0].gain.value,0);
expect('board-clear',{},0);
assert.ok(oscillators.length>0);
console.log('Scarab 21 audio cue hierarchy, headroom, event layering, mute and volume pass.');
