(() => {
  'use strict';

  const Audio = window.AudioContext || window.webkitAudioContext;
  const cues = ['piece', 'capture', 'promotion', 'checkmate', 'draw'];
  const buffers = new Map();
  const level = 0.7 * 0.85;
  const context = createContext();
  const master = context?.createGain();
  let muted = false;

  function createContext() {
    try {
      return Audio && new Audio();
    } catch {
      return null;
    }
  }

  if (master) {
    master.gain.value = level;
    master.connect(context.destination);
    for (const cue of cues) {
      fetch(`sounds/${cue}.wav`)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then(bytes => context.decodeAudioData(bytes))
        .then(buffer => buffers.set(cue, buffer))
        .catch(error => console.warn(`[Automate audio] ${cue} unavailable`, error));
    }
    document.addEventListener('click', resume, true);
    document.addEventListener('keydown', resume, true);
  }

  function resume() {
    if (!muted && context && context.state !== 'running') context.resume().catch(() => {});
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : level, context.currentTime, 0.012);
    resume();
    return muted;
  }

  function sample(cue, gain, rate, time) {
    const buffer = buffers.get(cue);
    if (!buffer) return;
    const source = context.createBufferSource();
    const volume = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    volume.gain.value = gain;
    source.connect(volume);
    volume.connect(master);
    source.onended = () => { source.disconnect(); volume.disconnect(); };
    source.start(time);
  }

  function play(cue, { capture = false } = {}) {
    if (muted || !context) return;
    if (context.state !== 'running' && !window.navigator?.userActivation?.isActive) return;
    const time = context.currentTime;
    const rate = 1 + (Math.random() - 0.5) * 0.035;
    if (cue === 'castle') {
      sample('piece', 0.28, rate, time);
      sample('piece', 0.25, rate * 0.96, time + 0.055);
      return;
    }

    const impact = capture || cue === 'capture';
    sample(impact ? 'capture' : 'piece', impact ? 0.48 : cue === 'draft' ? 0.23 : 0.35, rate, time);
    if (cue === 'checkmate' || cue === 'draw' || cue === 'promotion') sample(cue, 0.2, 1, time);
  }

  window.AutomateAudio = { toggleMute, play };
})();
