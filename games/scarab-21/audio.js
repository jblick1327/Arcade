/* Scarab 21 audio: card-table feedback with small, event-driven flourishes. */
(() => {
'use strict';
let context=null,master=null,enabled=false,level=.7;
const samples=Object.create(null);
const Context=window.AudioContext||window.webkitAudioContext;
const HIGH_AWARDS=new Set(['Super Blackjack','Double Blackjack','Full House']);
const BONUS_AWARDS=new Set(['Blackjack','Large 21','7-7-7','6-7-8']);

function initialize(){
 if(context||!Context)return context;
 try{
  context=new Context();
  master=context.createGain();
  master.gain.value=0;
  master.connect(context.destination);
  for(const name of ['place','column-clear','board-clear']){
   fetch('sounds/'+name+'.wav')
    .then(response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.arrayBuffer();})
    .then(bytes=>context.decodeAudioData(bytes))
    .then(buffer=>{samples[name]=buffer;})
    .catch(error=>console.warn('[Scarab 21 audio] '+name+' unavailable',error));
  }
 }catch(error){console.warn('[Scarab 21 audio] Audio unavailable',error);context=null;}
 return context;
}
function setEnabled(on){
 enabled=Boolean(on);
 if(!enabled){
  if(context)master.gain.setTargetAtTime(0,context.currentTime,.012);
  return;
 }
 if(!initialize())return;
 if(context.state==='suspended')context.resume().catch(()=>{});
 master.gain.setTargetAtTime(level*.85,context.currentTime,.015);
}
function setVolume(value){
 level=Math.max(0,Math.min(1,Number(value)/100||0));
 if(context&&enabled)master.gain.setTargetAtTime(level*.85,context.currentTime,.015);
}
function tone(hz,time,length,gain,kind='triangle'){
 const oscillator=context.createOscillator(),volume=context.createGain();
 oscillator.type=kind;
 oscillator.frequency.setValueAtTime(hz,time);
 volume.gain.setValueAtTime(.0001,time);
 volume.gain.exponentialRampToValueAtTime(gain,time+.012);
 volume.gain.exponentialRampToValueAtTime(.0001,time+length);
 oscillator.connect(volume);volume.connect(master);
 oscillator.start(time);oscillator.stop(time+length+.01);
 oscillator.onended=()=>{oscillator.disconnect();volume.disconnect();};
}
function tap(name,at,gain,rate){
 if(samples[name]){
  const source=context.createBufferSource(),volume=context.createGain();
  source.buffer=samples[name];
  source.playbackRate.value=rate;
  volume.gain.value=gain;
  source.connect(volume);volume.connect(master);
  source.start(at);
  source.onended=()=>{source.disconnect();volume.disconnect();};
 }else{
  // Immediate tactile response while samples decode; no extra assets required.
  const hz=name==='place'?250:name==='column-clear'?360:440;
  tone(hz,at,name==='place'?.065:.11,gain*.13);
 }
}
function play(event,{award='',deckClear=false,gameOver=false}={}){
 if(!enabled||!initialize())return;
 if(context.state==='suspended')context.resume().catch(()=>{});
 const at=context.currentTime+.008;
 const rate=1+(Math.random()-.5)*.04;
 // Use exactly one physical event per placement. Scoring accents sit after its attack.
 if(event==='board-clear'){
  tap('board-clear',at,.54,rate);
 }else if(event==='column-clear'){
  tap('column-clear',at,.50,rate);
  if(HIGH_AWARDS.has(award)){
   tone(587.33,at+.12,.12,.022);
   tone(783.99,at+.245,.20,.029);
  }else if(BONUS_AWARDS.has(award)){
   tone(698.46,at+.155,.105,.023);
  }
 }else{
  tap('place',at,.43,rate);
 }
 if(deckClear){
  // This can coincide with a clear. Use one light bonus accent, never replay a second clear.
  const delay=event==='board-clear'?.39:event==='column-clear'?.25:.10;
  tone(659.25,at+delay,.13,.025);
  tone(880,at+delay+.115,.19,.029);
 }
 if(gameOver){
  // End-of-run cue starts after the placement/award, not on top of its attack.
  const delay=event==='board-clear'?.42:event==='column-clear'?.34:.11;
  tone(392,at+delay,.16,.022);
  tone(329.63,at+delay+.145,.24,.02);
 }
}
window.ScarabAudio={setEnabled,setVolume,play};
})();
