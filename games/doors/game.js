/* Door events translated to JS, with unbounded counts and a one-second timer. */
"use strict";
const FPS = 4194304 / 70224;
const counterText = value => {
  const n = BigInt(value), digits = String(n < 0n ? 0n : n);
  return digits.length <= 9 ? digits.padStart(9, "0") : `${digits[0]}.${digits.slice(1, 4)}e+${digits.length - 1}`;
};

function readProgress(saved) {
  if (!saved || !Array.isArray(saved.variables) || saved.variables.length !== 7) return null;
  try {
    const v = saved.variables.slice();
    if (![v[3], v[5], v[6]].every(Number.isInteger) || v[5] < 0 || v[5] > 6) return null;
    if (saved.version === 2) {
      for (const i of [0, 1, 2, 4]) {
        if (!/^\d+$/.test(String(v[i]))) return null;
        v[i] = BigInt(v[i]);
      }
    } else if (saved.version === 1 && v.every(Number.isInteger)) {
      // Recover the original Fibonacci position, including old signed-16 saves.
      let a = 1n, b = 0n, found = false;
      for (let visit = 0; visit < 512; visit++) {
        [a, b] = [b, a + b];
        if (Number(BigInt.asIntN(16, a)) === v[0] && Number(BigInt.asIntN(16, b)) === v[1]) {
          found = true; break;
        }
      }
      if (!found) return null;
      const elapsed = BigInt.asUintN(16, b - BigInt(v[4]));
      const remaining = v[3] === 1 ? 0n : b > elapsed ? b - elapsed : 0n;
      [v[0], v[1], v[2], v[4]] = [a, b, b, remaining];
    } else return null;
    v[3] = v[4] === 0n ? 1 : 0;
    return { variables: v, music: saved.music,
      timerRemaining: Number.isFinite(saved.timerRemaining) && saved.timerRemaining > 0 && saved.timerRemaining <= FPS ? saved.timerRemaining : FPS,
      readyDelay: Number.isInteger(saved.readyDelay) && saved.readyDelay > 0 && saved.readyDelay <= 16 ? saved.readyDelay : -1 };
  } catch (_) { return null; }
}

class DoorGame {
  constructor(io = {}) {
    this.io = { music() {}, sfx() {}, save() {}, walkedThrough() {}, ...io };
    this.variables = [1n, 0n, 0n, 1, 0n, 0, 0];
    this.scene = "initial";
    this.cameraX = 0;
    this.door = 0;
    this.displayed = null;
    this.textInstant = false;
    this.textProgress = 0;
    this.fade = 5;
    this.gameTime = 0;
    this.frames = 0;
    this.timer = 0;
    this.timerRemaining = FPS;
    this.readyDelay = -1;
    this.music = null;
    this.inputDown = false;
    this.lastInput = false;
    this.locked = true;
    this.modal = null;
    this.wait = 0;
    this.job = this.boot(io.saved);
    this.resume();
  }
  play(name) { this.music = name; this.io.music(name); }
  *fadeTo(target, mask) {
    if (this.fade === target) return;
    this.modal = { target, mask, frame: 0 };
    yield "fade";
  }
  *boot(saved) {
    const progress = readProgress(saved);
    if (progress) {
      this.variables = progress.variables;
      this.scene = "room";
      this.displayed = this.variables[4];
      this.textInstant = true;
      this.textProgress = 9;
      this.timer = this.variables[4] > 0n ? 1 : 0;
      this.timerRemaining = progress.timerRemaining;
      this.readyDelay = progress.readyDelay;
      if (progress.music) this.play(progress.music);
      else if (!this.timer && this.readyDelay < 0) this.play("ready");
      yield* this.fadeTo(0, 3);
    } else {
      yield 1;
      yield* this.fadeTo(0, 15);
    }
    this.locked = false;
  }
  resume() {
    for (let guard = 0; guard < 100; guard++) {
      if (!this.job) return;
      const item = this.job.next();
      if (item.done) { this.job = null; return; }
      if (item.value === "fade") return;
      if (Number.isInteger(item.value) && item.value > 0) { this.wait = item.value; return; }
    }
    throw new Error("Door sequence did not yield");
  }
  press() {
    if (this.locked || this.job) return false;
    if (this.variables[3] !== 1) {
      this.io.sfx("locked", this.scene === "initial" ? 8 : 0);
      return false;
    }
    this.job = this.openDoor();
    this.resume();
    return true;
  }
  *openDoor() {
    const startingNumber = this.scene === "initial" ? 0n : this.variables[1];
    this.readyDelay = -1;
    this.play("opening");
    this.door = 1;
    yield 54;
    this.door = 2;
    yield 12;
    this.door = 3;
    yield 72;
    yield* this.fadeTo(5, 3);
    this.io.walkedThrough(startingNumber);
    yield* this.hallway();
  }
  *hallway() {
    this.locked = true;
    this.timer = 0;
    this.scene = "hall1";
    this.cameraX = 0;
    this.displayed = null;
    yield 1;
    yield* this.fadeTo(0, 1);
    const v = this.variables;
    if (v[5] <= 1) v[6] = 1;
    else if (v[5] === 6) v[6] = 0;
    v[5] += v[6] ? 1 : -1;
    this.play("leadin");
    yield 63;
    this.play("track" + v[5]);
    // 05:7e9c–7fd0: eight camera cuts, each preceded by its original wait.
    for (let cut = 0; cut < 8; cut++) {
      yield cut < 2 ? 12 : 18;
      this.cameraX = cut % 2 === 0 ? 160 : 0;
    }
    yield 18;
    this.scene = "hall2";
    this.cameraX = 0;
    yield 1;
    yield 18;
    this.cameraX = 160;
    yield 18;
    this.scene = "hall3";
    this.cameraX = 0;
    yield 1;
    yield 24;
    yield* this.fadeTo(5, 7);
    this.scene = "room";
    this.cameraX = 0;
    this.door = 0;
    v[2] = v[0] + v[1];
    v[0] = v[1];
    v[1] = v[2];
    v[4] = v[2];
    this.displayed = v[4];
    this.textProgress = this.textInstant ? 9 : 0;
    this.timer = 1;
    this.timerRemaining = FPS;
    v[3] = 0;
    yield 1;
    yield* this.fadeTo(0, 3);
    this.locked = false;
    this.saveProgress();
  }
  finishTimerCallback() {
    const v = this.variables;
    if (v[4] === 0n) {
      this.timer = 0;
      v[3] = 1;
      this.play(null);
      this.io.sfx("unlock", 8);
      this.readyDelay = 16;
    }
  }
  timerCallback() {
    if (this.variables[4] > 0n) this.variables[4]--;
    this.textInstant = true;
    this.textProgress = 9;
    this.displayed = this.variables[4];
    this.finishTimerCallback();
    this.saveProgress();
  }
  saveProgress() {
    this.io.save({ version: 2, variables: this.variables.map(n => typeof n === "bigint" ? String(n) : n),
      timerRemaining: this.timerRemaining, readyDelay: this.readyDelay, music: this.music });
  }
  tick() {
    this.frames++;
    if (this.modal) {
      const f = this.modal;
      if ((f.frame++ & f.mask) === 0) this.fade += Math.sign(f.target - this.fade);
      if (this.fade === f.target) { this.modal = null; this.resume(); }
      return; // Modal fades block the main loop, but hardware audio continues.
    }
    if (this.wait && --this.wait === 0) this.resume();
    if (this.modal) return;
    if (this.readyDelay >= 0 && --this.readyDelay === 0) {
      this.play("ready");
      this.readyDelay = -1;
      this.saveProgress();
    }
    if (this.inputDown && !this.lastInput && !this.locked) this.press();
    this.lastInput = this.inputDown;
    if (!this.locked && this.timer) {
      if (--this.timerRemaining <= 0) { this.timerRemaining += FPS; this.timerCallback(); }
    }
    if (this.displayed !== null && this.textProgress < 9) this.textProgress++;
    this.gameTime = (this.gameTime + 1) & 255;
  }
}

if (typeof module !== "undefined") module.exports = { DoorGame, FPS, counterText, readProgress };

if (typeof document !== "undefined") (async function mount() {
  const canvas = document.getElementById("screen");
  const paletteTray = document.getElementById("palettes");
  globalThis.doorPalettes = DoorPalettes.install(canvas, paletteTray);
  resize();
  const context = canvas.getContext("2d");
  const images = {};
  const sources = [...Object.values(VISUALS.scenes).map(v => v.src), ...VISUALS.door.frames, VISUALS.font.src];
  await Promise.all(sources.map(src => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { images[src] = image; resolve(); };
    image.onerror = () => reject(new Error("Could not load " + src));
    image.src = src;
  })));
  const sound = new DoorAudio(globalThis.DOOR_AUDIO);
  const platform = globalThis.DoorArcade ? await DoorArcade.connect() : null;
  await sound.ready;
  const baseKey = "door-e8114820-save-0";
  const saveKey = platform ? platform.progressKey(baseKey) : baseKey;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(saveKey)); } catch (_) {}
  const game = new DoorGame({
    saved,
    music: name => sound.music(name),
    sfx: (name, priority) => sound.sfx(name, priority),
    walkedThrough: number => platform?.walkedThrough(number),
    save: value => { try { localStorage.setItem(saveKey, JSON.stringify(value)); } catch (_) {} }
  });
  globalThis.doorGame = game;
  globalThis.doorSound = sound;
  function draw() {
    context.imageSmoothingEnabled = false;
    const scene = images[VISUALS.scenes[game.scene].src];
    context.drawImage(scene, game.cameraX, 0, 160, 144, 0, 0, 160, 144);
    if (game.scene === "initial" || game.scene === "room") {
      context.drawImage(images[VISUALS.door.frames[game.door]], 0, 0);
      if (game.displayed !== null) {
        const text = counterText(game.displayed), font = VISUALS.font;
        const width = Math.min(8, 72 / text.length);
        for (let i = 0; i < (game.textProgress >= 9 ? text.length : Math.min(text.length, game.textProgress)); i++) {
          context.drawImage(images[font.src], font.characters.indexOf(text[i]) * 8, 0, 8, 8, font.x + i * width, font.y, width, 8);
        }
      }
    }
    // The DMG fades by palette entries, rather than opacity blending.
    if (game.fade) {
      const add = Math.min(4, game.fade) * 85;
      context.globalCompositeOperation = "lighter";
      context.fillStyle = `rgb(${add},${add},${add})`;
      context.fillRect(0, 0, 160, 144);
      context.globalCompositeOperation = "source-over";
    }
  }
  globalThis.drawDoor = draw;
  function resize() {
    const controls = paletteTray.getBoundingClientRect().height + 14;
    const fit = Math.max(0.1, Math.min(innerWidth / 160, (innerHeight - controls - 12) / 144));
    const scale = fit >= 1 ? Math.floor(fit) : fit;
    canvas.style.width = 160 * scale + "px";
    canvas.style.height = 144 * scale + "px";
  }
  addEventListener("resize", resize); resize();
  const keys = new Set(["KeyA", "KeyZ", "Space"]);
  addEventListener("keydown", event => {
    if (event.target?.closest?.(".palette-picker")) return;
    if (!keys.has(event.code)) return;
    event.preventDefault();
    sound.unlock();
    game.inputDown = true;
  });
  addEventListener("keyup", event => {
    if (keys.has(event.code)) {
      game.inputDown = false;
      if (!event.target?.closest?.(".palette-picker")) event.preventDefault();
    }
  });
  canvas.addEventListener("pointerdown", event => {
    event.preventDefault(); canvas.setPointerCapture(event.pointerId);
    sound.unlock(); game.inputDown = true;
  });
  canvas.addEventListener("pointerup", () => { game.inputDown = false; });
  canvas.addEventListener("pointercancel", () => { game.inputDown = false; });
  addEventListener("blur", () => { game.inputDown = false; });
  let last = performance.now(), debt = 0;
  function frame(now) {
    if (document.hidden) { last = now; requestAnimationFrame(frame); return; }
    debt += now - last; last = now;
    const step = 1000 / FPS;
    while (debt >= step) { game.tick(); debt -= step; }
    draw();
    requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => {
    // Do not silently skip countdown time when a browser suspends this page.
    if (document.hidden) sound.suspend();
    else { last = performance.now(); debt = 0; sound.resume(); }
  });
  draw(); requestAnimationFrame(frame);
})().catch(error => {
  console.error(error);
  document.getElementById("screen").setAttribute("aria-label", error.message);
});
