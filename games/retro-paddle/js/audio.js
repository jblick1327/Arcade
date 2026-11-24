/*
 * audio.js — square-wave beeps generated with the Web Audio API.
 * No audio files. The context is created on the first user gesture.
 */
(function (root) {
  'use strict';

  // [frequency Hz, start offset s, duration s]
  var SOUNDS = {
    paddle: [[490, 0, 0.05]],
    wall:   [[245, 0, 0.05]],
    score:  [[110, 0, 0.38]],
    count:  [[440, 0, 0.08]],
    go:     [[880, 0, 0.14]],
    blip:   [[660, 0, 0.03]],
    win:    [[523, 0, 0.12], [659, 0.14, 0.12], [784, 0.28, 0.12], [1047, 0.42, 0.35]]
  };

  function create() {
    var ctx = null;
    var api = {
      played: 0,       // counters exposed for manual / automated checks
      last: null,
      unlock: function () {
        if (!ctx) {
          var AC = root.AudioContext || root.webkitAudioContext;
          if (!AC) return;
          ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume();
      },
      play: function (name) {
        var notes = SOUNDS[name];
        if (!notes) return;
        api.played++;
        api.last = name;
        if (!ctx) return;
        var t0 = ctx.currentTime + 0.005;
        notes.forEach(function (n) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          var start = t0 + n[1], end = start + n[2];
          osc.type = 'square';
          osc.frequency.setValueAtTime(n[0], start);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(0.12, start + 0.004);
          gain.gain.setValueAtTime(0.12, end - 0.01);
          gain.gain.linearRampToValueAtTime(0.0001, end);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(end + 0.01);
        });
      }
    };
    return api;
  }

  root.PaddleAudio = { create: create, SOUNDS: SOUNDS };
})(typeof self !== 'undefined' ? self : this);
