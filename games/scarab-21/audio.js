// audio.js - sound effects for Scarab 21
// Author: Reachnid Group
// Centennial College - Fall 2026

(() => {
  'use strict';

  //=============================================================
  //                           SETUP
  //=============================================================

  const Audio = window.AudioContext || window.webkitAudioContext;
  // cue name -> [file in sounds/, volume]
  const cues = {
    place: ['place', 0.44],
    column: ['column-clear', 0.5],
    board: ['board-clear', 0.54],
    end: ['end', 0.5],
  };
  const buffers = new Map();
  const level = 0.7 * 0.85; // master volume
  const context = createContext();
  const master = context?.createGain();
  let muted = false;

  // A Web Audio context, or null where audio is unavailable (silence instead of errors)
  function createContext() {
    try {
      return Audio && new Audio();
    } catch {
      return null;
    }
  }

  // preload every cue, and resume the context on the first user gesture (autoplay policy)
  if (master) {
    master.gain.value = level;
    master.connect(context.destination);
    for (const [cue, [file]] of Object.entries(cues)) {
      fetch(`sounds/${file}.wav`)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then((bytes) => context.decodeAudioData(bytes))
        .then((buffer) => buffers.set(cue, buffer))
        .catch((error) => console.warn(`[Scarab 21 audio] ${file} unavailable`, error));
    }
    document.addEventListener('click', resume, true);
    document.addEventListener('keydown', resume, true);
  }

  //=============================================================
  //                          CONTROLS
  //=============================================================

  function resume() {
    if (!muted && context && context.state !== 'running') context.resume().catch(() => {});
  }

  // toggle mute with a short fade. Returns the new muted state
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : level, context.currentTime, 0.012);
    resume();
    return muted;
  }

  //=============================================================
  //                          PLAYBACK
  //=============================================================

  // play a cue: 'place', 'column', 'board' or 'end'
  function play(cue) {
    if (muted || !context) return;
    if (context.state !== 'running' && !window.navigator?.userActivation?.isActive) return;
    const buffer = buffers.get(cue);
    if (!buffer) return;

    const source = context.createBufferSource();
    const volume = context.createGain();
    source.buffer = buffer;
    if (cue === 'place') source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.04;
    volume.gain.value = cues[cue][1];
    source.connect(volume);
    volume.connect(master);
    source.onended = () => {
      source.disconnect();
      volume.disconnect();
    };
    source.start(context.currentTime);
  }

  //=============================================================
  //                          EXPORTS
  //=============================================================

  window.ScarabAudio = { toggleMute, play };
})();
