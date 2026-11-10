/* Automate audio: a restrained, self-contained mixer for chess events. */
(() => {
'use strict';
let ctx=null,master=null;
let enabled=false,level=.7,lastQuiet=-Infinity;
const buffers=Object.create(null);
const Context=window.AudioContext||window.webkitAudioContext;

// Both samples are original Automate assets. They carry the tactile sound;
// short synthesized accents convey chess meaning without copying another game's sounds.
function initialize(){
 if(ctx||!Context)return ctx;
 try{
  ctx=new Context();
  master=ctx.createGain();
  master.gain.value=0;
  master.connect(ctx.destination);
  for(const name of ['piece','capture']){
   fetch('sounds/'+name+'.wav')
    .then(response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.arrayBuffer();})
    .then(data=>ctx.decodeAudioData(data))
    .then(buffer=>{buffers[name]=buffer;})
    .catch(error=>console.warn('[Automate sound] '+name+' unavailable; using synthesized taps.',error));
  }
 }catch(error){
  console.warn('[Automate sound] Audio unavailable.',error);
  ctx=null;
 }
 return ctx;
}
function setEnabled(value){
 enabled=Boolean(value);
 if(!enabled){
  if(ctx)master.gain.setTargetAtTime(0,ctx.currentTime,.012);
  return;
 }
 if(!initialize())return;
 if(ctx.state==='suspended')ctx.resume().catch(()=>{});
 master.gain.setTargetAtTime(level*.85,ctx.currentTime,.015);
}
function setVolume(value){
 level=Math.max(0,Math.min(1,Number(value)/100||0));
 if(ctx&&enabled)master.gain.setTargetAtTime(level*.85,ctx.currentTime,.015);
}
function tap(kind,gain,rate,at){
 if(buffers[kind]){
  const source=ctx.createBufferSource(),volume=ctx.createGain();
  source.buffer=buffers[kind];
  source.playbackRate.value=rate;
  volume.gain.value=gain;
  source.connect(volume);
  volume.connect(master);
  source.start(at);
  source.onended=()=>{source.disconnect();volume.disconnect();};
  return;
 }
 // Fallback for the first click while samples decode or if a file is missing.
 const oscillator=ctx.createOscillator(),volume=ctx.createGain();
 oscillator.type='triangle';
 oscillator.frequency.setValueAtTime((kind==='capture'?210:270)*rate,at);
 oscillator.frequency.exponentialRampToValueAtTime(95*rate,at+.065);
 volume.gain.setValueAtTime(.0001,at);
 volume.gain.exponentialRampToValueAtTime(gain*.18,at+.004);
 volume.gain.exponentialRampToValueAtTime(.0001,at+.075);
 oscillator.connect(volume);
 volume.connect(master);
 oscillator.start(at);
 oscillator.stop(at+.08);
 oscillator.onended=()=>{oscillator.disconnect();volume.disconnect();};
}
function tone(hz,at,duration,gain){
 const oscillator=ctx.createOscillator(),volume=ctx.createGain();
 oscillator.type='triangle';
 oscillator.frequency.setValueAtTime(hz,at);
 volume.gain.setValueAtTime(.0001,at);
 volume.gain.exponentialRampToValueAtTime(gain,at+.012);
 volume.gain.exponentialRampToValueAtTime(.0001,at+duration);
 oscillator.connect(volume);
 volume.connect(master);
 oscillator.start(at);
 oscillator.stop(at+duration+.015);
 oscillator.onended=()=>{oscillator.disconnect();volume.disconnect();};
}
function play(type,{capture=false}={}){
 if(!enabled||!initialize())return;
 if(ctx.state==='suspended')ctx.resume().catch(()=>{});
 const at=ctx.currentTime+.008;
 // Quiet moves should remain distinct at high Stockfish speeds.
 if(type==='move'&&at-lastQuiet<.075)return;
 if(type==='move')lastQuiet=at;
 const rate=1+(Math.random()-.5)*(type==='move'?.035:.018);
 const base=capture?'capture':'piece';
 const strength=capture?.48:.35;
 switch(type){
  case 'draft': tap('piece',.23,rate*1.035,at);break;
  case 'erase': tap('piece',.15,rate*.85,at);break;
  case 'lock':
   tone(440,at,.105,.023);
   tone(554.37,at+.08,.16,.028);
   break;
  case 'castle':
   tap('piece',.28,rate,at);
   tap('piece',.25,rate*.93,at+.075);
   break;
  case 'check':
   tap(base,strength*.82,rate,at);
   tone(698.46,at+.025,.11,.04);
   break;
  case 'promotion':
   tap(base,strength,rate,at);
   tone(587.33,at+.01,.13,.03);
   tone(783.99,at+.13,.2,.042);
   break;
  case 'checkmate':
   tap(base,strength,rate,at);
   tone(392,at+.035,.17,.039);
   tone(523.25,at+.16,.2,.042);
   tone(659.25,at+.3,.37,.045);
   break;
  case 'draw':
   tap(base,strength*.72,rate,at);
   tone(440,at+.035,.145,.027);
   tone(392,at+.145,.22,.024);
   break;
  case 'capture':tap('capture',.48,rate,at);break;
  default:tap('piece',.35,rate,at);
 }
}
window.AutomateAudio={setEnabled,setVolume,play};
})();