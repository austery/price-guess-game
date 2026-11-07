// Countdown "thinking" music, synthesized in the browser with the Web Audio API.
// No audio files, no downloads, no licensing, nothing touches the server.
//
// Feel: 120 bpm tick-tock + bass + light arpeggio (Am - F - C - G). In the last 5 seconds
// the ticks double, the harmony shifts up and a riser builds; a buzzer sounds at 0.

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
export function scheduleCountdown(ctx, out, t0, seconds) {
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
