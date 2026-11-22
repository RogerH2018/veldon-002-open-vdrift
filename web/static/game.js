// SPDX-License-Identifier: GPL-3.0-or-later
import createEngine from "./engine.mjs";
import { makeCircuit, createMinimap } from "./circuit.js";
import { createScene } from "./scene.js";

const byId = (id) => document.getElementById(id);
const copy = {
  "zh-CN": {
    trial: "漂移计时试玩", trialDescription: "开着后驱双门跑车驶上铜线赛道，练习漂移，刷新单圈成绩。",
    loading: "正在加载车辆动力学…", start: "开始驾驶", drive: "开车", handbrake: "手刹", brake: "刹车",
    throttle: "油门", touchHelp: "使用屏幕上的方向键、油门和手刹。", lap: "圈数", score: "漂移分", circuit: "铜线赛道",
    reset: "重开", best: "最快圈", drift: "漂移", soundOff: "声音关", soundOn: "声音开", upstream: "VDrift 原作",
    source: "本版源码", failure: "试玩加载失败。请检查浏览器是否启用了 WebGL，然后刷新页面。",
    left: "向左", right: "向右", dashboard: "驾驶仪表",
  },
  en: {
    trial: "Drift time trial", trialDescription: "Take a rear-wheel-drive coupe around Copperline Circuit. Practice drifting and beat your best lap.",
    loading: "Loading vehicle physics…", start: "Start driving", drive: "Drive", handbrake: "Handbrake", brake: "Brake",
    throttle: "Throttle", touchHelp: "Use the on-screen steering, throttle, and handbrake.", lap: "Lap", score: "Drift score", circuit: "Copperline Circuit",
    reset: "Restart", best: "Best lap", drift: "Drifting", soundOff: "Sound off", soundOn: "Sound on", upstream: "Original VDrift",
    source: "Trial source", failure: "The trial couldn't load. Check that WebGL is enabled, then reload the page.",
    left: "Steer left", right: "Steer right", dashboard: "Driving instruments",
  },
};

const view = {
  game: document.querySelector(".game"),
  dashboard: byId("dashboard"),
  intro: byId("intro"),
  start: byId("start"),
  sound: byId("sound"),
  error: byId("load-error"),
  speed: byId("speed"),
  rpm: byId("rpm"),
  gear: byId("gear"),
  lap: byId("lap-count"),
  lapTime: byId("lap-time"),
  score: byId("drift-score"),
  combo: byId("combo"),
  best: byId("best-lap"),
};

function bestLapFromStorage() {
  try {
    return Number(localStorage.getItem("copperline.bestLap")) || 0;
  } catch {
    return 0;
  }
}

let bestLap = bestLapFromStorage();
let locale = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "zh-CN";
function translate() {
  document.documentElement.lang = locale;
  for (const node of document.querySelectorAll("[data-copy]")) node.textContent = copy[locale][node.dataset.copy];
  byId("language").textContent = locale === "en" ? "中文" : "EN";
  byId("language").lang = locale === "en" ? "zh-CN" : "en";
  document.querySelector("[data-control='left']").ariaLabel = copy[locale].left;
  document.querySelector("[data-control='right']").ariaLabel = copy[locale].right;
  view.dashboard.ariaLabel = copy[locale].dashboard;
  if (!view.error.hidden) view.error.textContent = copy[locale].failure;
  showBestLap();
}

function clock(seconds) {
  const ticks = Math.floor(seconds * 100);
  const minutes = String(Math.floor(ticks / 6000)).padStart(2, "0");
  const rest = String(Math.floor(ticks / 100) % 60).padStart(2, "0");
  const hundredths = String(ticks % 100).padStart(2, "0");
  return `${minutes}:${rest}.${hundredths}`;
}

function showBestLap() {
  view.best.hidden = !bestLap;
  if (bestLap) view.best.textContent = `${copy[locale].best} ${clock(bestLap)}`;
}

byId("language").addEventListener("click", () => {
  locale = locale === "en" ? "zh-CN" : "en";
  const url = new URL(location.href);
  if (locale === "en") url.searchParams.set("lang", "en");
  else url.searchParams.delete("lang");
  history.replaceState(null, "", url);
  translate();
});
translate();

function makeSound() {
  let audio, engineNote, pulse, filter, volume;
  let enabled = false;
  const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Audio) {
    view.sound.disabled = true;
    return { update() {} };
  }
  view.sound.addEventListener("click", async () => {
    if (enabled) {
      enabled = false;
      volume.gain.setTargetAtTime(0, audio.currentTime, .045);
    } else {
      try {
        if (!audio) {
          audio = new Audio();
          engineNote = audio.createOscillator();
          pulse = audio.createOscillator();
          const harmonic = audio.createGain();
          filter = audio.createBiquadFilter();
          volume = audio.createGain();
          volume.gain.value = 0;
          engineNote.type = "triangle";
          pulse.type = "sawtooth";
          harmonic.gain.value = .22;
          filter.type = "lowpass";
          engineNote.connect(filter);
          pulse.connect(harmonic).connect(filter);
          filter.connect(volume).connect(audio.destination);
          engineNote.start();
          pulse.start();
        }
        await audio.resume();
        enabled = true;
      } catch {
        view.sound.disabled = true;
      }
    }
    view.sound.dataset.copy = enabled ? "soundOn" : "soundOff";
    view.sound.textContent = copy[locale][view.sound.dataset.copy];
    view.sound.setAttribute("aria-pressed", String(enabled));
  });
  return {
    update(rpm, throttle, active) {
      if (!enabled) return;
      const now = audio.currentTime;
      engineNote.frequency.setTargetAtTime(28 + rpm / 73, now, .045);
      pulse.frequency.setTargetAtTime(56 + rpm / 37, now, .045);
      filter.frequency.setTargetAtTime(120 + rpm * .065 + throttle * 480, now, .05);
      volume.gain.setTargetAtTime(active ? .049 + throttle * .068 : 0, now, .055);
    },
  };
}

function installControls(reset, active) {
  const keys = new Set();
  const pointers = new Map();
  const mapping = {
    ArrowUp: "throttle", KeyW: "throttle", ArrowDown: "brake", KeyS: "brake",
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "handbrake",
  };
  const pressed = (control) => Object.keys(mapping).some((code) => mapping[code] === control && keys.has(code)) ||
    [...pointers.values()].some((button) => button.dataset.control === control);

  addEventListener("keydown", (event) => {
    if (!active() || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "KeyR" && !event.repeat) reset();
    if (!(event.code in mapping) || (event.code === "Space" && event.target.closest?.("button, a"))) return;
    event.preventDefault();
    keys.add(event.code);
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  const clear = () => {
    keys.clear();
    for (const button of pointers.values()) button.classList.remove("active");
    pointers.clear();
  };
  addEventListener("blur", clear);
  document.addEventListener("visibilitychange", clear);
  for (const button of document.querySelectorAll("[data-control]")) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      pointers.set(event.pointerId, button);
      button.setPointerCapture(event.pointerId);
      button.classList.add("active");
    });
    const release = (event) => {
      pointers.delete(event.pointerId);
      if (![...pointers.values()].includes(button)) button.classList.remove("active");
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(event, release);
    }
  }
  return {
    read: () => ({
      throttle: Number(pressed("throttle")),
      brake: Number(pressed("brake")),
      steer: Number(pressed("right")) - Number(pressed("left")),
      handbrake: Number(pressed("handbrake")),
    }),
    clear,
  };
}

function crossedGate(point, previousX, previousY, x, y) {
  const { center, forward, right, width } = point;
  const before = (previousX - center.x) * forward.x + (previousY - center.y) * forward.y;
  const after = (x - center.x) * forward.x + (y - center.y) * forward.y;
  if (before > 0 || after < 0 || after <= before) return false;
  const fraction = -before / (after - before);
  const crossX = previousX + fraction * (x - previousX);
  const crossY = previousY + fraction * (y - previousY);
  return Math.abs((crossX - center.x) * right.x + (crossY - center.y) * right.y) < width;
}

function startTrial(engine) {
  const circuit = makeCircuit();
  const scene = createScene(byId("viewport"), circuit);
  const drawMap = createMinimap(byId("map"), circuit);
  const sound = makeSound();
  const pointer = engine._malloc(circuit.edges.byteLength);
  if (!pointer) throw new Error("Could not allocate circuit geometry");
  engine.HEAPF32.set(circuit.edges, pointer >>> 2);
  const created = engine._createSimulation(pointer, circuit.centers.length);
  engine._free(pointer);
  if (!created) throw new Error("Could not initialize circuit physics");

  const spawn = circuit.centers[3];
  const checkpoints = [96, 192, 288, 0].map((i) => circuit.centers[i]);
  const fixedStep = 1 / 90;
  let active = false;
  let snap = true;
  let beforeFrame = 0;
  let accumulator = 0;
  let steering = 0;
  let timer = 0;
  let lap = 1;
  let gate = 0;
  let points = 0;
  let drifting = false;
  let previousX, previousY;
  const readState = () => {
    const offset = engine._carState() >>> 2;
    return engine.HEAPF32.subarray(offset, offset + 41);
  };
  const controls = installControls(reset, () => active);

  function reset() {
    if (!engine._resetCar(spawn.center.x, spawn.center.y, Math.atan2(-spawn.forward.x, spawn.forward.y))) {
      throw new Error("Could not initialize vehicle physics");
    }
    [previousX, previousY] = readState();
    timer = accumulator = steering = gate = points = 0;
    lap = 1;
    drifting = false;
    snap = true;
    controls.clear();
    if (active) view.game.focus({ preventScroll: true });
  }

  function updateTiming(state) {
    const [x, y] = state;
    if (state[35] > 1.5 || timer > 0) timer += fixedStep;
    if (crossedGate(checkpoints[gate], previousX, previousY, x, y)) {
      gate = (gate + 1) % checkpoints.length;
      if (!gate) {
        if (!bestLap || timer < bestLap) {
          bestLap = timer;
          try {
            localStorage.setItem("copperline.bestLap", String(bestLap));
          } catch {
            // Timing remains usable when persistent storage is unavailable.
          }
          showBestLap();
        }
        lap += 1;
        timer = 0;
      }
    }
    previousX = x;
    previousY = y;
    const angle = Math.abs(state[38]);
    drifting = state[39] === 1 && state[40] > 4 && state[35] > 7 && angle > .25;
    if (drifting) points += Math.min(angle, 1.05) * state[35] * fixedStep * 12;
  }

  function updateDashboard(state) {
    view.speed.textContent = String(Math.round(state[35] * 3.6)).padStart(3, "0");
    view.rpm.style.transform = `scaleX(${Math.min(1, Math.max(0, state[36] / 7400))})`;
    view.gear.textContent = state[37] === -1 ? "R" : (state[37] || "N");
    view.lap.textContent = String(lap).padStart(2, "0");
    view.lapTime.textContent = clock(timer);
    view.score.textContent = Math.floor(points).toLocaleString(locale);
    view.combo.hidden = !drifting;
    if (drifting) view.combo.textContent = `${copy[locale].drift} · ${Math.round(Math.abs(state[38]) * 180 / Math.PI)}°`;
    drawMap(state[0], state[1]);
  }

  function frame(now) {
    const elapsed = Math.min((now - (beforeFrame || now)) / 1000, .085);
    beforeFrame = now;
    let throttle = 0;
    if (active && !document.hidden) {
      const input = controls.read();
      throttle = input.throttle;
      accumulator += elapsed;
      while (accumulator >= fixedStep) {
        steering += (input.steer - steering) * (input.steer === 0 ? .155 : .098);
        engine._stepCar(throttle, input.brake, steering, input.handbrake);
        updateTiming(readState());
        accumulator -= fixedStep;
      }
    }
    const state = readState();
    if (active) updateDashboard(state);
    sound.update(state[36], throttle, active && !document.hidden);
    scene.render(state, active, elapsed, snap);
    snap = false;
    requestAnimationFrame(frame);
  }

  reset();
  view.start.dataset.copy = "start";
  view.start.textContent = copy[locale].start;
  view.start.disabled = false;
  view.start.addEventListener("click", () => {
    active = true;
    snap = true;
    view.intro.hidden = true;
    view.dashboard.hidden = false;
    view.game.focus({ preventScroll: true });
  });
  byId("reset").addEventListener("click", reset);
  requestAnimationFrame(frame);
}

createEngine().then(startTrial).catch((error) => {
  console.error(error);
  view.start.hidden = true;
  view.error.textContent = copy[locale].failure;
  view.error.hidden = false;
});
