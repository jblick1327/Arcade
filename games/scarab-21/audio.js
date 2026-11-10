(() => {
  'use strict';

  const Audio = window.AudioContext || window.webkitAudioContext;
  const cues = {
    place: ['place', 0.44],
    column: ['column-clear', 0.50],
    board: ['board-clear', 0.54],
    end: ['end', 0.50],
  };
  const buffers = new Map();
  let context, master, enabled = false, level = 0.7;

  function setEnabled(on) {
    enabled = on;
    if (on && !context && Audio) {
      try {
        context = new Audio();
      } catch {
        return;
      }
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      for (const [cue, [file]] of Object.entries(cues)) {
        fetch(`sounds/${file}.wav`)
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.arrayBuffer();
          })
          .then(bytes => context.decodeAudioData(bytes))
          .then(buffer => buffers.set(cue, buffer))
          .catch(error => console.warn(`[Scarab 21 audio] ${file} unavailable`, error));
      }
    }
    if (!context) return;
    if (on && context.state !== 'running') context.resume().catch(() => {});
    master.gain.setTargetAtTime(on ? level * 0.85 : 0, context.currentTime, 0.012);
  }

  function setVolume(value) {
    level = Math.min(1, Math.max(0, Number(value) / 100 || 0));
    if (enabled && context) master.gain.setTargetAtTime(level * 0.85, context.currentTime, 0.012);
  }

  function play(cue) {
    if (!enabled || !context) return;
    if (context.state !== 'running') {
      context.resume().catch(() => {});
      return;
    }
    const buffer = buffers.get(cue);
    if (!buffer) return;

    const source = context.createBufferSource();
    const volume = context.createGain();
    source.buffer = buffer;
    if (cue === 'place') source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.04;
    volume.gain.value = cues[cue][1];
    source.connect(volume);
    volume.connect(master);
    source.onended = () => { source.disconnect(); volume.disconnect(); };
    source.start(context.currentTime);
  }

  window.ScarabAudio = { setEnabled, setVolume, play };
})();
