import { describe, expect, it } from "vitest";
import { GAME_CONFIG, type GameConfig } from "../src/config";
import {
  GameError,
  claim,
  hostView,
  initialState,
  lockNow,
  next,
  playerView,
  reveal,
  start,
  resetRound,
  startTiebreak,
  submit,
  type GameState,
} from "../src/game";
import { scoreTiebreak, type Bid } from "../src/scoring";

const cfg: GameConfig = GAME_CONFIG;
const T0 = 1_700_000_000_000;
const tok = (n: number) => `token-table-${String(n).padStart(2, "0")}`;
const b = (cents: number, at = 0): Bid => ({ cents, at });

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof GameError) return e.code;
    throw e;
  }
}

describe("scoreTiebreak — agreed three steps", () => {
  const tied = [3, 8, 12];

  it("step 1: closest without going over wins", () => {
    const r = scoreTiebreak({ 3: b(1950), 8: b(1800), 12: b(2100) }, 2000, tied);
    expect([r.winners, r.decidedBy]).toEqual([[3], "under"]);
  });

  it("step 2: everyone over -> closest to the price wins", () => {
    const r = scoreTiebreak({ 3: b(2300), 8: b(2100), 12: b(2500) }, 2000, tied);
    expect([r.winners, r.decidedBy]).toEqual([[8], "closest"]);
  });

  it("step 3: same top valid bid -> draw lots between those tables", () => {
    const r = scoreTiebreak({ 3: b(1900), 8: b(1900), 12: b(1500) }, 2000, tied, () => 0.99);
    expect([r.winners, r.decidedBy, r.lotFrom]).toEqual([[8], "lot", [3, 8]]);
  });

  it("step 3: everyone over by the same amount -> draw lots", () => {
    const r = scoreTiebreak({ 3: b(2100), 8: b(2100) }, 2000, [3, 8], () => 0);
    expect([r.winners, r.decidedBy, r.lotFrom]).toEqual([[3], "lot", [3, 8]]);
  });

  it("a table that doesn't answer loses", () => {
    const r = scoreTiebreak({ 8: b(2600) }, 2000, tied);
    expect([r.winners, r.decidedBy]).toEqual([[8], "closest"]);
  });

  it("nobody answers -> draw lots among all tied tables", () => {
    const r = scoreTiebreak({}, 2000, tied, () => 0.5);
    expect([r.winners, r.decidedBy, r.lotFrom]).toEqual([[8], "lot", [3, 8, 12]]);
  });

  it("bids from tables that were not tied are ignored", () => {
    const r = scoreTiebreak({ 3: b(1000), 5: b(2000) }, 2000, tied);
    expect(r.winners).toEqual([3]);
    expect(r.entries.map((e) => e.table)).toEqual([3]);
  });

  it("only the drawn table is marked winner even when bids are equal", () => {
    const r = scoreTiebreak({ 3: b(1900), 8: b(1900) }, 2000, [3, 8], () => 0);
    expect(r.entries.filter((e) => e.winner).map((e) => e.table)).toEqual([3]);
  });
});

/** Play all regular rounds; round r is won by winners[r] (they bid 1 cent, everyone else is way over). */
function playRounds(winners: number[][]): GameState {
  const s = initialState();
  for (let t = 1; t <= cfg.tables; t++) claim(s, cfg, tok(t), t);
  let now = T0;
  winners.forEach((ws) => {
    start(s, cfg, now);
    for (let t = 1; t <= cfg.tables; t++) submit(s, cfg, tok(t), ws.includes(t) ? "0.01" : "99999", now);
    lockNow(s, now);
    reveal(s, cfg);
    next(s, cfg);
    now += 30_000;
  });
  return s;
}

describe("tiebreaker flow", () => {
  it("no tie -> champion decided by rounds, no tiebreaker offered", () => {
    const s = playRounds([[3], [3], [8], [12], [3]]);
    const v = hostView(s, cfg, T0, []);
    expect(v.champion).toEqual({ table: 3, how: "rounds" });
    expect(v.canStartTiebreak).toBe(false);
    expect(code(() => startTiebreak(s, cfg))).toBe("bad_phase");
  });

  it("five different winners -> tiebreaker among those five only", () => {
    const s = playRounds([[3], [8], [12], [5], [10]]);
    const v = hostView(s, cfg, T0, []);
    expect(v.champion).toBeNull();
    expect(v.canStartTiebreak).toBe(true);

    startTiebreak(s, cfg);
    expect(s.phase).toBe("waiting");
    expect(s.tiebreak).toEqual({ tables: [3, 5, 8, 10, 12], index: 0 });
    expect(playerView(s, cfg, tok(1), T0).dish).toBeNull(); // hidden until start

    const now = T0 + 999_000;
    start(s, cfg, now);
    const pv = playerView(s, cfg, tok(3), now);
    expect(pv.isTiebreak).toBe(true);
    expect(pv.dish?.name).toBe(cfg.tiebreakers[0].name);
    expect(code(() => submit(s, cfg, tok(1), "10", now))).toBe("not_in_tiebreak");
    const price = cfg.tiebreakers[0].priceCents;
    submit(s, cfg, tok(8), ((price - 50) / 100).toFixed(2), now);
    submit(s, cfg, tok(3), ((price - 300) / 100).toFixed(2), now);
    submit(s, cfg, tok(12), ((price + 10) / 100).toFixed(2), now);

    // price stays secret until reveal
    lockNow(s, now);
    expect(JSON.stringify(playerView(s, cfg, tok(8), now))).not.toContain(`"priceCents":${price}`);

    reveal(s, cfg);
    const rv = hostView(s, cfg, now, []);
    expect(rv.result).toMatchObject({ winners: [8], decidedBy: "under" });
    expect(rv.champion).toEqual({ table: 8, how: "under" });

    next(s, cfg);
    const fv = hostView(s, cfg, now, []);
    expect(fv.phase).toBe("final");
    expect(fv.champion).toEqual({ table: 8, how: "under" });
    expect(fv.canStartTiebreak).toBe(false); // decided: no more tiebreakers
    expect(code(() => startTiebreak(s, cfg))).toBe("bad_phase");
    // regular standings are untouched by the tiebreaker
    expect(fv.standings.find((x) => x.table === 8)!.wins).toBe(1);
  });

  it("2-2 tie at the top: only those two play", () => {
    const s = playRounds([[3], [8], [3], [8], [12]]);
    startTiebreak(s, cfg);
    expect(s.tiebreak!.tables).toEqual([3, 8]);
  });

  it("still tied after a tiebreaker -> the still-tied tables play the next basket; lots only after the last", () => {
    expect(cfg.tiebreakers.length).toBe(3);
    const s = playRounds([[3], [8], [12], [5], [10]]);
    let now = T0 + 999_000;
    const playTb = (bids: Record<number, number>) => {
      start(s, cfg, now);
      const price = cfg.tiebreakers[s.tiebreak!.index].priceCents;
      for (const [t, off] of Object.entries(bids)) submit(s, cfg, tok(Number(t)), ((price + off) / 100).toFixed(2), now);
      lockNow(s, now);
      reveal(s, cfg, () => 0);
      return hostView(s, cfg, now, []);
    };

    startTiebreak(s, cfg);
    // tables 3 and 8 give the same best guess; 12 is further off
    let v = playTb({ 3: -100, 8: -100, 12: -500 });
    expect(v.result).toMatchObject({ winners: [], decidedBy: "again", lotFrom: [3, 8] });
    expect(v.champion).toBeNull();
    next(s, cfg);
    v = hostView(s, cfg, now, []);
    expect(v.phase).toBe("final");
    expect(v.champion).toBeNull();
    expect(v.canStartTiebreak).toBe(true);

    startTiebreak(s, cfg);
    expect(s.tiebreak).toEqual({ tables: [3, 8], index: 1 });
    now += 100_000;
    start(s, cfg, now);
    expect(hostView(s, cfg, now, []).dish!.name).toBe(cfg.tiebreakers[1].name);
    expect(code(() => submit(s, cfg, tok(12), "10", now))).toBe("not_in_tiebreak");
    resetRound(s);

    // nobody answers basket 2 -> again; basket 3 tied again -> drawn by lot
    v = playTb({});
    expect(v.result).toMatchObject({ decidedBy: "again", lotFrom: [3, 8] });
    next(s, cfg);
    startTiebreak(s, cfg);
    expect(s.tiebreak).toEqual({ tables: [3, 8], index: 2 });
    now += 100_000;
    v = playTb({ 3: 200, 8: 200 });
    expect(v.result).toMatchObject({ decidedBy: "lot", lotFrom: [3, 8], winners: [3] });
    expect(v.champion).toEqual({ table: 3, how: "lot" });
    next(s, cfg);
    expect(hostView(s, cfg, now, []).canStartTiebreak).toBe(false);
    expect(code(() => startTiebreak(s, cfg))).toBe("bad_phase");
  });

  it("without a configured tiebreaker the tie is just shown", () => {
    const noTb: GameConfig = { ...cfg, tiebreakers: [] };
    const s = playRounds([[3], [8], [12], [5], [10]]);
    expect(hostView(s, noTb, T0, []).canStartTiebreak).toBe(false);
    expect(code(() => startTiebreak(s, noTb))).toBe("no_tiebreaker");
  });
});
