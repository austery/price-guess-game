// Countdown music, synthesized in the browser with the Web Audio API.
// No audio files, no downloads, nothing touches the server.
//
// Two styles (pick with DEFAULT_MUSIC below):
//  - "jingle-bells": the chorus of Jingle Bells (1857, public domain) on bells with sleigh bells
//    and an oom-pah bass. Its 32 beats are stretched to exactly fill the countdown, so the song
//    ends right as time runs out. A ticking clock joins for the last 5 seconds.
//  - "tick-tock": game-show thinking music (Am - F - C - G) with a riser in the last 5 seconds.
// Both end with a buzzer at 0.

export const DEFAULT_MUSIC = "jingle-bells";

const BEAT = 0.5; // seconds (120 bpm)
const BASS = [110.0, 87.31, 130.81, 98.0]; // A2 F2 C3 G2
const CHORDS = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
];

function tone(ctx, out, { type = "sine", freq, endFreq, start, dur, gain = 0.2, attack = 0.005 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(out);
  o.start(start);
  o.stop(start + dur + 0.05);
}

/** Schedule `seconds` of countdown music ending exactly at t0 + seconds, then the buzzer. */
export function scheduleCountdown(ctx, out, t0, seconds, style = DEFAULT_MUSIC) {
  return (style === "tick-tock" ? scheduleTickTock : scheduleJingleBells)(ctx, out, t0, seconds);
}

// ---------- Jingle Bells ----------

const N = { G2: 98.0, C3: 130.81, D3: 146.83, G3: 196.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63,
  Fs4: 369.99, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33 };
// Chorus: "Jingle bells, jingle bells, jingle all the way" + "...in a one-horse open sleigh". [note, beats]
const MELODY = [
  ["B4", 1], ["B4", 1], ["B4", 2],
  ["B4", 1], ["B4", 1], ["B4", 2],
  ["B4", 1], ["D5", 1], ["G4", 1.5], ["A4", 0.5],
  ["B4", 4],
  ["C5", 1], ["C5", 1], ["C5", 1.5], ["C5", 0.5],
  ["C5", 1], ["B4", 1], ["B4", 1], ["B4", 0.5], ["B4", 0.5],
  ["D5", 1], ["D5", 1], ["C5", 1], ["A4", 1],
  ["G4", 4],
];
// One chord per bar: bass root + "pah" chord on beats 2 and 4.
const BARS = [
  ["G2", ["G3", "B3", "D4"]], ["G2", ["G3", "B3", "D4"]], ["G2", ["G3", "B3", "D4"]], ["G2", ["G3", "B3", "D4"]],
  ["C3", ["C4", "E4", "G4"]], ["G2", ["G3", "B3", "D4"]], ["D3", ["D4", "Fs4", "A4"]], ["G2", ["G3", "B3", "D4"]],
];
const SONG_BEATS = 32;

const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  if (!noiseCache.has(ctx)) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return noiseCache.get(ctx);
}

function sleighBell(ctx, out, t, gain) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(hp).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.15);
}

/** Bell / celesta-like note: a few sine partials with a quick attack and long decay. */
function bell(ctx, out, freq, t, beats, beat, gain) {
  const ring = Math.min(1.6, Math.max(0.35, beats * beat * 1.1));
  tone(ctx, out, { freq, start: t, dur: ring, gain, attack: 0.004 });
  tone(ctx, out, { freq: freq * 2, start: t, dur: ring * 0.6, gain: gain * 0.35, attack: 0.003 });
  tone(ctx, out, { freq: freq * 3.01, start: t, dur: ring * 0.3, gain: gain * 0.12, attack: 0.002 });
}

export function scheduleJingleBells(ctx, out, t0, seconds) {
  const end = t0 + seconds;
  const beat = seconds / SONG_BEATS; // 15 s -> 128 bpm
  // melody
  let b = 0;
  for (const [note, len] of MELODY) {
    bell(ctx, out, N[note], t0 + b * beat, len, beat, 0.18);
    b += len;
  }
  // accompaniment + sleigh bells
  for (let k = 0; k < SONG_BEATS; k++) {
    const t = t0 + k * beat;
    const [root, chord] = BARS[Math.floor(k / 4)];
    const left = end - t;
    if (k % 2 === 0) tone(ctx, out, { type: "triangle", freq: N[root], start: t, dur: beat * 0.9, gain: 0.3, attack: 0.01 });
    else for (const n of chord) tone(ctx, out, { type: "triangle", freq: N[n], start: t, dur: beat * 0.5, gain: 0.045, attack: 0.01 });
    sleighBell(ctx, out, t, 0.18);
    sleighBell(ctx, out, t + beat / 2, 0.09);
    // last 5 seconds: a ticking clock joins in for tension
    if (left <= 5 + 1e-6) {
      tone(ctx, out, { type: "square", freq: 1760, start: t, dur: 0.04, gain: 0.06 });
      tone(ctx, out, { type: "square", freq: 1568, start: t + beat / 2, dur: 0.035, gain: 0.05 });
    }
  }
  scheduleBuzzer(ctx, out, end);
}

// ---------- Tick-tock thinking music ----------

function scheduleTickTock(ctx, out, t0, seconds) {
  const end = t0 + seconds;
  const nBeats = Math.floor(seconds / BEAT + 1e-6);
  const first = end - nBeats * BEAT;
  for (let k = 0; k < nBeats; k++) {
    const t = first + k * BEAT;
    const left = end - t;
    const beatNo = Math.round((t - first) / BEAT);
    const bar = Math.floor(beatNo / 4) % 4;
    const beatInBar = beatNo % 4;
    const urgent = left <= 5 + 1e-6;
    const lift = urgent ? 1.0595 : 1; // up a semitone for tension

    // tick-tock
    tone(ctx, out, { type: "square", freq: urgent ? 1760 : beatInBar % 2 ? 1046 : 1318, start: t, dur: 0.05, gain: urgent ? 0.1 : 0.07 });
    if (urgent) tone(ctx, out, { type: "square", freq: 1568, start: t + BEAT / 2, dur: 0.04, gain: 0.07 });

    // bass on 1 and 3 (every beat when urgent)
    if (beatInBar % 2 === 0 || urgent) {
      tone(ctx, out, { type: "triangle", freq: BASS[bar] * lift, start: t, dur: BEAT * 0.9, gain: 0.32, attack: 0.01 });
    }

    // eighth-note arpeggio
    const chord = CHORDS[bar];
    for (let e = 0; e < 2; e++) {
      const n = chord[(beatInBar * 2 + e) % 3] * 2 * lift;
      tone(ctx, out, { type: "triangle", freq: n, start: t + (e * BEAT) / 2, dur: BEAT * 0.45, gain: 0.05 });
    }
  }

  // riser over the last 5 seconds
  const rs = Math.max(t0, end - 5);
  if (end - rs > 0.5) {
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(110, rs);
    o.frequency.exponentialRampToValueAtTime(440, end);
    f.type = "lowpass";
    f.frequency.setValueAtTime(300, rs);
    f.frequency.exponentialRampToValueAtTime(3000, end);
    g.gain.setValueAtTime(0.0001, rs);
    g.gain.exponentialRampToValueAtTime(0.05, end - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(f).connect(g).connect(out);
    o.start(rs);
    o.stop(end + 0.05);
  }

  scheduleBuzzer(ctx, out, end);
}

/** "Time's up!" buzzer. */
export function scheduleBuzzer(ctx, out, t) {
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1800;
  f.connect(out);
  tone(ctx, f, { type: "square", freq: 220, endFreq: 140, start: t, dur: 0.8, gain: 0.22, attack: 0.01 });
  tone(ctx, f, { type: "square", freq: 233, endFreq: 148, start: t, dur: 0.8, gain: 0.18, attack: 0.01 });
}

/** Controller for the host screen. */
export function createCountdownSound() {
  let ctx = null;
  let master = null;
  let run = null; // { gain, end }
  let muted = false;
  try {
    muted = localStorage.getItem("pg-muted") === "1";
  } catch {}

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function stop() {
    if (!run) return;
    const { gain } = run;
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    setTimeout(() => gain.disconnect(), 400);
    run = null;
  }

  return {
    /** Call from a click/keypress so the browser allows sound later. */
    unlock: () => ensure(),
    get muted() {
      return muted;
    },
    setMuted(m) {
      muted = m;
      try {
        localStorage.setItem("pg-muted", m ? "1" : "0");
      } catch {}
      if (m) stop();
    },
    /** Start music that ends (with the buzzer) in `secondsLeft` seconds. */
    start(secondsLeft) {
      stop();
      if (muted || secondsLeft <= 0.3 || !ensure()) return;
      const gain = ctx.createGain();
      gain.connect(master);
      const t0 = ctx.currentTime + 0.03;
      scheduleCountdown(ctx, gain, t0, secondsLeft);
      run = { gain, end: t0 + secondsLeft };
    },
    /** Round locked. If it ended early (host pressed Stop), cut the music and buzz now. */
    locked() {
      if (!run || !ctx) return;
      if (ctx.currentTime < run.end - 0.25) {
        stop();
        if (!muted) scheduleBuzzer(ctx, master, ctx.currentTime + 0.01);
      } else {
        const r = run;
        setTimeout(() => r.gain.disconnect(), 1500); // let the buzzer ring out
        run = null;
      }
    },
    stop,
  };
}
