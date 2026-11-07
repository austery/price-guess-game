import { describe, expect, it } from "vitest";
import { GAME_CONFIG, type GameConfig } from "../src/config";
import {
  GameError,
  claim,
  hostView,
  initialState,
  lockNow,
  next,
  normalizeState,
  playerView,
  resetGame,
  resetRound,
  reveal,
  skipPractice,
  start,
  submit,
  type GameState,
} from "../src/game";

const cfg: GameConfig = GAME_CONFIG;
const T0 = 1_700_000_000_000;
const tok = (n: number) => `token-table-${String(n).padStart(2, "0")}`;

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof GameError) return e.code;
    throw e;
  }
}

function fresh(): GameState {
  const s = initialState(cfg);
  for (let t = 1; t <= cfg.tables; t++) claim(s, cfg, tok(t), t);
  return s;
}

/** Table `winner` bids 1 cent; everyone else goes way over. */
function playRound(s: GameState, winner: number, now = T0) {
  start(s, cfg, now);
  for (let t = 1; t <= cfg.tables; t++) submit(s, cfg, tok(t), t === winner ? "0.01" : "99999", now);
  lockNow(s, now);
  reveal(s, cfg);
}

describe("practice rounds", () => {
  it("a fresh game starts in practice round 1 of 2", () => {
    const v = hostView(fresh(), cfg, T0, []);
    expect(cfg.practice).toHaveLength(2);
    expect([v.isPractice, v.practiceNumber, v.practiceTotal, v.practiceDone]).toEqual([true, 1, 2, false]);
  });

  it("practice shows its own item and reveals a winner, but never counts", () => {
    const s = fresh();
    start(s, cfg, T0);
    expect(playerView(s, cfg, tok(1), T0).dish!.name).toBe(cfg.practice[0].name);
    for (let t = 1; t <= cfg.tables; t++) submit(s, cfg, tok(t), t === 7 ? "0.01" : "99999", T0);
    lockNow(s, T0);
    expect(JSON.stringify(playerView(s, cfg, tok(1), T0))).not.toContain(`"priceCents":${cfg.practice[0].priceCents}`);
    reveal(s, cfg);
    const v = hostView(s, cfg, T0, []);
    expect(v.result!.winners).toEqual([7]);
    expect(v.result!.priceCents).toBe(cfg.practice[0].priceCents);
    expect(v.standings.every((x) => x.wins === 0)).toBe(true);
    expect(v.roundWinners).toEqual([]);
  });

  it("after 2 practice rounds the real game starts at round 1 with a clean scoreboard", () => {
    const s = fresh();
    playRound(s, 7);
    next(s, cfg);
    expect(hostView(s, cfg, T0, []).practiceNumber).toBe(2);
    playRound(s, 8);
    next(s, cfg);
    const v = hostView(s, cfg, T0, []);
    expect([v.isPractice, v.practiceDone, v.phase, v.roundNumber]).toEqual([false, true, "waiting", 1]);
    expect(v.submittedTables).toEqual([]); // practice bids don't leak into round 1
    start(s, cfg, T0);
    expect(playerView(s, cfg, tok(1), T0).dish!.name).toBe(cfg.dishes[0].name);
    expect(playerView(s, cfg, tok(7), T0).myBid).toBeNull();
  });

  it("host can skip the remaining practice", () => {
    const s = fresh();
    playRound(s, 7);
    skipPractice(s); // straight from the practice reveal
    const v = hostView(s, cfg, T0, []);
    expect([v.isPractice, v.practiceDone, v.roundNumber, v.phase]).toEqual([false, true, 1, "waiting"]);
    expect(code(() => skipPractice(s))).toBe("bad_phase");
  });

  it("can't skip in the middle of an open round", () => {
    const s = fresh();
    start(s, cfg, T0);
    expect(code(() => skipPractice(s))).toBe("bad_phase");
  });

  it("redo a practice round", () => {
    const s = fresh();
    playRound(s, 7);
    resetRound(s);
    expect([s.phase, s.practiceRound, s.bids["p0"]]).toEqual(["waiting", 0, undefined]);
  });

  it("reset game goes back to practice 1", () => {
    const s = fresh();
    skipPractice(s);
    playRound(s, 3);
    resetGame(s, true, cfg);
    expect([s.practiceRound, s.practiceDone, Object.keys(s.results).length]).toEqual([0, false, 0]);
    expect(Object.keys(s.claims)).toHaveLength(15);
  });

  it("no practice configured -> starts directly at round 1", () => {
    const noPractice: GameConfig = { ...cfg, practice: [] };
    const v = hostView(initialState(noPractice), noPractice, T0, []);
    expect([v.isPractice, v.roundNumber]).toEqual([false, 1]);
  });

  it("an older saved game (before practice existed) loads as a real game", () => {
    const old = { ...initialState(), round: 2 } as Partial<GameState>;
    delete old.practiceRound;
    delete old.practiceDone;
    const s = normalizeState(old, cfg);
    expect([s.practiceRound, s.round]).toEqual([null, 2]);
  });

  it("number of real rounds = number of items in dishes", () => {
    const three: GameConfig = { ...cfg, practice: [], dishes: cfg.dishes.slice(0, 3) };
    const s = initialState(three);
    claim(s, three, tok(1), 1);
    for (let r = 0; r < 3; r++) {
      start(s, three, T0);
      lockNow(s, T0);
      reveal(s, three);
      next(s, three);
    }
    expect(hostView(s, three, T0, []).phase).toBe("final");
  });
});

describe("intro screens", () => {
  it("join -> welcome -> rules, back works, and starting ends the intro", async () => {
    const { introStep } = await import("../src/game");
    const s = fresh();
    expect(s.introStep).toBe(0);
    introStep(s, 1);
    introStep(s, 1);
    expect(hostView(s, cfg, T0, []).introStep).toBe(2);
    introStep(s, 1); // already on the last intro screen: stays
    expect(s.introStep).toBe(2);
    introStep(s, -1);
    expect(s.introStep).toBe(1);
    start(s, cfg, T0);
    expect([s.introStep, hostView(s, cfg, T0, []).isPractice]).toEqual([3, true]);
    expect(code(() => introStep(s, 1))).toBe("bad_phase");
  });

  it("reset game shows the intro again; an old saved game skips it", () => {
    const s = fresh();
    start(s, cfg, T0);
    resetGame(s, true, cfg);
    expect(s.introStep).toBe(0);
    const old = { ...initialState(cfg) } as Partial<GameState>;
    delete old.introStep;
    expect(normalizeState(old, cfg).introStep).toBe(3);
  });
});
