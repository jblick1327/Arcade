/* Original tracker songs rendered offline; browser playback has no sound-chip VM. */
"use strict";
class DoorAudio {
  constructor(data) {
    this.data = data;
    this.context = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    this.buffers = new Map();
    this.sources = [];
    this.enabled = false;
    this.name = null;
    this.sfxPriority = -1;
    this.sfxUntil = 0;
    this.soundToken = 0;
    this.ready = this.prepare();
  }
  async prepare() {
    const decode = async entry => {
      const uri = entry.data;
      if (!uri) throw new Error("Missing embedded audio asset");
      const raw = atob(uri.slice(uri.indexOf(",") + 1));
      const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
      const buffer = await this.context.decodeAudioData(bytes.buffer);
      this.buffers.set(entry, buffer);
    };
    await Promise.all([
      ...Object.values(this.data.music).flatMap(song => [decode(song.body), decode(song.effects)]),
      ...Object.values(this.data.sfx).map(decode)
    ]);
  }
  unlock() {
    if (this.enabled) { this.context.resume().catch(() => {}); return; }
    this.enabled = true;
    this.context.resume().catch(() => {});
    if (this.name) this.music(this.name);
  }
  music(name) {
    this.name = name;
    for (const source of this.sources) { try { source.stop(); } catch (_) {} }
    this.sources.length = 0;
    this.effectsGain = null;
    if (!name || !this.enabled) return;
    const song = this.data.music[name];
    if (!song) return;
    const at = this.context.currentTime;
    for (const [part, muted] of [[song.body, false], [song.effects, true]]) {
      const buffer = this.buffers.get(part);
      if (!buffer) continue;
      const source = this.context.createBufferSource(), gain = this.context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = song.loopStart;
      source.loopEnd = song.loopEnd;
      source.connect(gain).connect(this.context.destination);
      gain.gain.value = muted && at < this.sfxUntil ? 0 : 1;
      if (muted) this.effectsGain = gain;
      source.start(at);
      this.sources.push(source);
    }
  }
  sfx(name, priority = 0) {
    if (!this.enabled) return;
    const entry = this.data.sfx[name], at = this.context.currentTime;
    if (!entry || (at < this.sfxUntil && priority < this.sfxPriority)) return;
    if (this.effectSource) { try { this.effectSource.stop(); } catch (_) {} }
    const token = ++this.soundToken;
    this.sfxPriority = priority;
    this.sfxUntil = at + entry.duration;
    if (this.effectsGain) {
      this.effectsGain.gain.cancelScheduledValues(at);
      this.effectsGain.gain.setValueAtTime(0, at);
      this.effectsGain.gain.setValueAtTime(1, this.sfxUntil);
    }
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(entry);
    source.connect(this.context.destination);
    source.onended = () => {
      if (token !== this.soundToken) return;
      this.sfxPriority = -1;
      if (this.effectsGain) this.effectsGain.gain.setValueAtTime(1, this.context.currentTime);
    };
    source.start(at);
    this.effectSource = source;
  }
  suspend() { this.context.suspend().catch(() => {}); }
  resume() { if (this.enabled) this.context.resume().catch(() => {}); }
}
