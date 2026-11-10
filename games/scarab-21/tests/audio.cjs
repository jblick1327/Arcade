const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const oscillators=[],gains=[],sources=[],filters=[];
class Param{
 constructor(value=1){this.value=value;this.events=[];}
 setValueAtTime(value,time){this.value=value;this.events.push(['set',value,time]);}
 linearRampToValueAtTime(value,time){this.value=value;this.events.push(['linear',value,time]);}
 exponentialRampToValueAtTime(value,time){this.value=value;this.events.push(['ramp',value,time]);}
 setTargetAtTime(value,time,constant){this.value=value;this.events.push(['target',value,time,constant]);}
}
class Node{
 constructor(){this.frequency=new Param(440);this.gain=new Param();this.playbackRate=new Param(1);this.Q=new Param(.7);}
 connect(dest){this.output=dest;return dest;}
 disconnect(){}
 start(time){this.started=time;}
 stop(time){this.stopped=time;}
}
class AudioContext{
 constructor(){this.currentTime=1;this.state='running';this.destination=new Node();}
 createGain(){const gain=new Node();gains.push(gain);return gain;}
 createBiquadFilter(){const filter=new Node();filters.push(filter);return filter;}
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
assert.equal(filters.length,1,'A single shared placement filter is created');
assert.equal(filters[0].type,'lowpass');
assert.equal(filters[0].frequency.value,1500);
assert.equal(filters[0].Q.value,.65);
assert.equal(filters[0].output,gains[0],'Only placement taps use the filter');
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

async function testLoadedBuffers(){
 const loadedSources=[],loadedGains=[],loadedFilters=[];
 class LoadedContext extends AudioContext{
  createGain(){const node=new Node();loadedGains.push(node);return node;}
  createBiquadFilter(){const node=new Node();loadedFilters.push(node);return node;}
  createBufferSource(){const node=new Node();loadedSources.push(node);return node;}
  decodeAudioData(){return Promise.resolve({duration:.075});}
 }
 const app={AudioContext:LoadedContext};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../audio.js','utf8'),{
  window:app,console,
  fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}),
 });
 app.ScarabAudio.setEnabled(true);
 // Resolve the fetch, decode, and buffer assignment promise chains.
 for(let i=0;i<20;i++)await Promise.resolve();
 app.ScarabAudio.play('place');
 assert.equal(loadedSources.length,1,'Placement uses the decoded sample');
 const place=loadedSources[0];
 assert.equal(place.output.output,loadedFilters[0],'Only placement goes through the lowpass');
 assert.ok(place.playbackRate.value>=.9212&&place.playbackRate.value<=.9588,'Placement is pitched down gently');
 const volume=place.output;
 assert.deepEqual(volume.gain.events.map(([kind])=>kind),['set','linear']);
 assert.equal(volume.gain.events[1][1],.40,'Placement attack reaches its quieter level');
 assert.ok(Math.abs(volume.gain.events[1][2]-place.started-.003)<1e-8,'Attack ramp is 3ms');
 app.ScarabAudio.play('column-clear');
 assert.equal(loadedSources.length,2);
 assert.equal(loadedSources[1].output.output,loadedGains[0],'Column clear bypasses the lowpass');
 app.ScarabAudio.play('board-clear');
 assert.equal(loadedSources.length,3);
 assert.equal(loadedSources[2].output.output,loadedGains[0],'Board clear bypasses the lowpass');
}
testLoadedBuffers().then(
 ()=>console.log('Scarab 21 placement lowpass, softened attack and clear bypass pass.'),
 error=>{console.error(error);process.exitCode=1;}
);
