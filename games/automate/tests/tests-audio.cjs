const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const oscillators=[],gains=[];
class Param{
 constructor(value=1){this.value=value;this.events=[];}
 setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);}
 exponentialRampToValueAtTime(v,t){this.value=v;this.events.push(['exponential',v,t]);}
 linearRampToValueAtTime(v,t){this.value=v;this.events.push(['linear',v,t]);}
 setTargetAtTime(v,t,k){this.value=v;this.events.push(['target',v,t,k]);}
 cancelScheduledValues(t){this.events.push(['cancel',t]);}
}
class Node{
 constructor(){this.gain=new Param();this.frequency=new Param(440);this.playbackRate=new Param(1);}
 connect(dest){return dest;}
 disconnect(){}
 start(t){this.started=t;}
 stop(t){this.stopped=t;}
}
let audio;
class AudioContext{
 constructor(){this.currentTime=1;this.state='running';this.destination=new Node();audio=this;}
 createGain(){const gain=new Node();gains.push(gain);return gain;}
 createDynamicsCompressor(){
  const node=new Node();
  Object.assign(node,{threshold:new Param(),knee:new Param(),ratio:new Param(),attack:new Param(),release:new Param()});
  return node;
 }
 createOscillator(){const node=new Node();oscillators.push(node);return node;}
 createBufferSource(){throw Error('Audio samples should still be loading in this test');}
}
const window={AudioContext};
vm.runInNewContext(fs.readFileSync(__dirname+'/../audio.js','utf8'),{
 window,console,fetch:()=>new Promise(()=>{}),
});
const s=window.AutomateAudio;
s.play('move');
assert.equal(oscillators.length,0,'Sound must start disabled');
s.setVolume(70);
s.setEnabled(true);
assert.equal(gains[2].gain.value,.7*.85,'Master bus starts below unity for headroom');
function expect(cue,count,options){
 const before=oscillators.length;
 s.play(cue,options);
 assert.equal(oscillators.length-before,count,cue+' should have expected number of layers');
 return oscillators.slice(before);
}
const move=expect('move',1);
expect('move',0); // no machine-gun repeated normal taps at extremely fast engine speeds
const capture=expect('capture',1);
const moveLevel=move[0].gain, captureLevel=capture[0].gain;
assert.ok(moveLevel&&captureLevel);
expect('castle',2);
const check=expect('check',2,{capture:true});
assert.ok(Math.abs(check[1].frequency.value-698.46)<.01,'Check has a distinct warning pitch');
expect('promotion',3);
const mate=expect('checkmate',4);
assert.ok(Math.abs(mate.at(-1).frequency.value-659.25)<.01,'Mate resolves to a final chime');
expect('draw',3);
expect('draft',1);
expect('erase',1);
expect('lock',2);
s.setVolume(40);
assert.equal(gains[2].gain.value,.4*.85);
s.setEnabled(false);
assert.equal(gains[2].gain.value,0);
expect('checkmate',0);
console.log('Automate audio: muted by default, event layering, fast-move throttling, and master mix validated.');
