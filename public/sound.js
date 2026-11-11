// Countdown music, synthesized in the browser with the Web Audio API.
// No audio files, no downloads, nothing touches the server.
//
// Each round plays a different traditional Christmas song (all public domain), arranged as a
// bouncy up-tempo band: melody, "boom-chick" drums, walking oom-pah bass, off-beat chord stabs
// and sleigh bells. A ticking clock joins for the last 5 seconds; a buzzer sounds at 0.
// Set DEFAULT_MUSIC = "tick-tock" for the plain game-show thinking music instead.

export const DEFAULT_MUSIC = "christmas";

const BEAT = 0.5; // tick-tock style: seconds per beat (120 bpm)
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

/**
 * Schedule `seconds` of countdown music ending exactly at t0 + seconds, then the buzzer.
 * `song` picks the Christmas song (any integer; it wraps around).
 */
export function scheduleCountdown(ctx, out, t0, seconds, song = 0, style = DEFAULT_MUSIC) {
  if (style === "tick-tock") return scheduleTickTock(ctx, out, t0, seconds);
  return scheduleSong(ctx, out, t0, seconds, SONGS[((song % SONGS.length) + SONGS.length) % SONGS.length]);
}

// ---------- Christmas songs (traditional / public domain) ----------
// melody: "NOTE:beats" tokens ("|" = bar line, ignored; default length 1 beat). pickup = beats before bar 1.
export const SONGS = [
  {
    name: "Jingle Bells", key: "G", minor: false, bpm: 200, beatsPerBar: 4, pickup: 0,
    melody: `B4 B4 B4:2 | B4 B4 B4:2 | B4 D5 G4:1.5 A4:0.5 | B4:4 | C5 C5 C5:1.5 C5:0.5 | C5 B4 B4 B4:0.5 B4:0.5 |
             B4 A4 A4 B4 | A4:2 D5:2 | B4 B4 B4:2 | B4 B4 B4:2 | B4 D5 G4:1.5 A4:0.5 | B4:4 |
             C5 C5 C5:1.5 C5:0.5 | C5 B4 B4 B4:0.5 B4:0.5 | D5 D5 C5 A4 | G4:4`,
  },
  {
    name: "Deck the Halls", key: "F", minor: false, bpm: 184, beatsPerBar: 4, pickup: 0,
    melody: `C5:1.5 Bb4:0.5 A4 G4 | F4 G4 A4 F4 | G4:0.5 A4:0.5 Bb4:0.5 G4:0.5 A4:1.5 G4:0.5 | F4 E4 F4:2 |
             C5:1.5 Bb4:0.5 A4 G4 | F4 G4 A4 F4 | G4:0.5 A4:0.5 Bb4:0.5 G4:0.5 A4:1.5 G4:0.5 | F4 E4 F4:2 |
             G4:1.5 A4:0.5 Bb4 G4 | A4:1.5 Bb4:0.5 C5 G4 | A4:0.5 B4:0.5 C5 D5:0.5 E5:0.5 F5 | E5 D5 C5:2 |
             C5:1.5 Bb4:0.5 A4 G4 | F4 G4 A4 F4 | D5:0.5 D5:0.5 D5:0.5 D5:0.5 C5:1.5 Bb4:0.5 | A4 G4 F4:2`,
  },
  {
    name: "We Wish You a Merry Christmas", key: "G", minor: false, bpm: 200, beatsPerBar: 3, pickup: 1,
    melody: `D4 | G4 G4:0.5 A4:0.5 G4:0.5 F#4:0.5 | E4 E4 E4 | A4 A4:0.5 B4:0.5 A4:0.5 G4:0.5 | F#4 D4 D4 |
             B4 B4:0.5 C5:0.5 B4:0.5 A4:0.5 | G4 E4 D4:0.5 D4:0.5 | E4 A4 F#4 | G4:2`,
  },
  {
    name: "God Rest Ye Merry Gentlemen", key: "E", minor: true, bpm: 184, beatsPerBar: 4, pickup: 1,
    melody: `E4 | E4 B4 B4 A4 | G4 F#4 E4 D4 | E4 F#4 G4 A4 | B4:3`,
  },
  {
    name: "Good King Wenceslas", key: "G", minor: false, bpm: 184, beatsPerBar: 4, pickup: 0,
    melody: `G4 G4 G4 A4 | G4 G4 D4:2 | E4 D4 E4 F#4 | G4:2 G4:2 | G4 G4 G4 A4 | G4 G4 D4:2 | E4 D4 E4 F#4 | G4:2 G4:2 |
             D5 C5 B4 A4 | B4 A4 G4:2 | E4 D4 E4 F#4 | G4:2 G4:2 | D4 D4 E4 F#4 | G4 G4 A4:2 | D5 C5 B4 A4 | G4:2 C5:2 | G4:4`,
  },
  {
    name: "Joy to the World", key: "D", minor: false, bpm: 168, beatsPerBar: 4, pickup: 0,
    melody: `D5 C#5:0.75 B4:0.25 A4:1.5 G4:0.5 | F#4 E4 D4:1.5 A4:0.5 | B4:1.5 B4:0.5 C#5:1.5 C#5:0.5 | D5:3 R:1`,
  },
];

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  return PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12 * (Number(m[3]) + 1);
}
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export function parseMelody(text) {
  return text
    .split(/\s+/)
    .filter((t) => t && t !== "|")
    .map((t) => {
      const [n, d] = t.split(":");
      return { note: n === "R" ? null : midi(n), beats: d ? Number(d) : 1 };
    });
}

/** Pick a triad per bar from the key's primary chords, matching the melody notes in that bar. */
function harmonize(song, notes) {
  const tonic = PC[song.key[0]] + (song.key[1] === "#" ? 1 : song.key[1] === "b" ? -1 : 0);
  // [semitones above tonic, minor?] in order of preference
  const pool = song.minor
    ? [[0, true], [7, false], [5, true], [3, false], [10, false]] // i V iv III VII
    : [[0, false], [7, false], [5, false], [9, true]]; // I V IV vi
  const triad = ([r, mi]) => [r, r + (mi ? 3 : 4), r + 7].map((x) => (tonic + x) % 12);
  const total = notes.reduce((a, n) => a + n.beats, 0);
  const bars = Math.ceil((total - song.pickup) / song.beatsPerBar - 1e-9) + 1;
  const chords = [];
  for (let b = 0; b < bars; b++) {
    const from = song.pickup + (b - 1) * song.beatsPerBar; // bar 0 = the pickup bar
    const to = from + song.beatsPerBar;
    const weight = new Map();
    let t = 0;
    for (const n of notes) {
      const s = Math.max(t, from), e = Math.min(t + n.beats, to);
      if (n.note !== null && e > s) weight.set(n.note % 12, (weight.get(n.note % 12) ?? 0) + (e - s));
      t += n.beats;
    }
    let best = pool[0], bestScore = -1;
    for (const c of pool) {
      const tri = triad(c);
      const score = [...weight].reduce((a, [pc, w]) => a + (tri.includes(pc) ? w : 0), 0);
      if (score > bestScore + 1e-9) (best = c), (bestScore = score);
    }
    const [r, mi] = best;
    const rootPc = (tonic + r) % 12;
    chords.push({ root: rootPc, third: (rootPc + (mi ? 3 : 4)) % 12, fifth: (rootPc + 7) % 12 });
  }
  return { chords, from: (beat) => Math.floor((beat - song.pickup) / song.beatsPerBar) + 1 };
}

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

function noiseHit(ctx, out, t, { type = "highpass", freq = 7000, q = 0.7, dur = 0.12, gain = 0.1 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function kick(ctx, out, t) {
  tone(ctx, out, { freq: 150, endFreq: 45, start: t, dur: 0.16, gain: 0.55, attack: 0.002 });
}

/** Bright brassy lead ("ba-ba-ba") doubled by a bell for sparkle. */
function lead(ctx, out, freq, t, dur) {
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(freq, t);
  f.type = "lowpass";
  f.frequency.setValueAtTime(3800, t);
  f.frequency.exponentialRampToValueAtTime(1400, t + Math.max(0.08, dur));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.11, t + 0.01);
  g.gain.setValueAtTime(0.09, t + Math.max(0.02, dur - 0.03));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.08);
  tone(ctx, out, { freq: freq * 2, start: t, dur: Math.min(0.6, dur + 0.25), gain: 0.05, attack: 0.003 });
}

function scheduleSong(ctx, songOut, t0, seconds, song) {
  const out = ctx.createGain(); // the full band is louder than the old tick-tock: keep headroom
  out.gain.value = 0.6;
  out.connect(songOut);
  const end = t0 + seconds;
  const beat = 60 / song.bpm;
  const notes = parseMelody(song.melody);
  const loopBeats = notes.reduce((a, n) => a + n.beats, 0);
  const { chords, from: barOf } = harmonize(song, notes);
  const clip = (t, d) => Math.max(0.02, Math.min(d, end - t - 0.01));

  // melody, looping if the song is shorter than the countdown
  for (let b = 0, i = 0; t0 + b * beat < end - 0.05; i = (i + 1) % notes.length) {
    const n = notes[i];
    const t = t0 + b * beat;
    if (n.note !== null) lead(ctx, out, hz(n.note), t, clip(t, n.beats * beat * (n.beats <= 1 ? 0.78 : 0.9)));
    b += n.beats;
  }

  // band: per beat
  const totalBeats = Math.floor(seconds / beat + 1e-6);
  for (let k = 0; k < totalBeats; k++) {
    const t = t0 + k * beat;
    if (t >= end - 0.02) break;
    const inLoop = k % loopBeats;
    const c = chords[Math.min(chords.length - 1, Math.max(0, barOf(inLoop)))];
    const beatInBar = (((inLoop - song.pickup) % song.beatsPerBar) + song.beatsPerBar) % song.beatsPerBar;
    const bassPc = beatInBar % 2 === 0 ? c.root : c.fifth;
    // drums: boom on 1 (and 3), chick on the others
    if (beatInBar === 0 || (song.beatsPerBar === 4 && beatInBar === 2)) kick(ctx, out, t);
    else noiseHit(ctx, out, t, { type: "bandpass", freq: 1900, q: 0.9, dur: 0.11, gain: 0.22 });
    // oom-pah bass
    tone(ctx, out, { type: "triangle", freq: hz(36 + bassPc + (bassPc < 7 ? 12 : 0)), start: t, dur: clip(t, beat * 0.7), gain: 0.32, attack: 0.008 });
    // off-beat chord stab
    const ts = t + beat / 2;
    if (ts < end - 0.05) {
      for (const pc of [c.root, c.third, c.fifth]) {
        tone(ctx, out, { type: "square", freq: hz(60 + pc), start: ts, dur: clip(ts, beat * 0.28), gain: 0.022, attack: 0.004 });
      }
    }
    // sleigh bells on eighths
    noiseHit(ctx, out, t, { gain: 0.09 });
    if (ts < end - 0.02) noiseHit(ctx, out, ts, { gain: 0.05 });
    // ticking clock in the last 5 seconds
    if (end - t <= 5 + 1e-6) tone(ctx, out, { type: "square", freq: 1760, start: t, dur: 0.035, gain: 0.05 });
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
      // safety limiter so nothing ever distorts on the venue speakers
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.1;
      master.connect(limiter).connect(ctx.destination);
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
    start(secondsLeft, song = 0) {
      stop();
      if (muted || secondsLeft <= 0.3 || !ensure()) return;
      const gain = ctx.createGain();
      gain.connect(master);
      const t0 = ctx.currentTime + 0.03;
      scheduleCountdown(ctx, gain, t0, secondsLeft, song);
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
