import { describe, expect, it } from "vitest";
import { GAME_CONFIG, type GameConfig } from "../src/config";
import {
  GameError,
  claim,
  hostView,
  initialState,
  lockNow,
  maybeLock,
  next,
  playerView,
  release,
  resetGame,
  resetRound,
  reveal,
  start,
  submit,
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
  return undefined;
}

function withAllTables() {
  const s = initialState();
  for (let t = 1; t <= cfg.tables; t++) claim(s, cfg, tok(t), t);
  return s;
}

describe("joining tables", () => {
  it("a table can only be held by one phone", () => {
    const s = initialState();
    claim(s, cfg, tok(1), 3);
    expect(code(() => claim(s, cfg, tok(2), 3))).toBe("table_taken");
    claim(s, cfg, tok(1), 3); // re-claim by same phone is fine
  });

  it("switching tables releases the old one", () => {
    const s = initialState();
    claim(s, cfg, tok(1), 3);
    claim(s, cfg, tok(1), 4);
    expect(s.claims).toEqual({ 4: tok(1) });
  });

  it("host can release a table so a new phone can take over", () => {
    const s = initialState();
    claim(s, cfg, tok(1), 3);
    release(s, 3);
    claim(s, cfg, tok(2), 3);
    expect(s.claims[3]).toBe(tok(2));
  });

  it("rejects out-of-range tables", () => {
    expect(code(() => claim(initialState(), cfg, tok(1), 0))).toBe("bad_table");
    expect(code(() => claim(initialState(), cfg, tok(1), cfg.tables + 1))).toBe("bad_table");
  });
});

describe("a round", () => {
  it("cannot bid before start or without a table", () => {
    const s = initialState();
    claim(s, cfg, tok(1), 1);
    expect(code(() => submit(s, cfg, tok(1), "10", T0))).toBe("not_open");
    start(s, cfg, T0);
    expect(code(() => submit(s, cfg, "stranger-token", "10", T0))).toBe("no_table");
  });

  it("15 second countdown, grace period, then locked", () => {
    const s = withAllTables();
    start(s, cfg, T0);
    expect(s.deadline).toBe(T0 + cfg.roundSeconds * 1000);
    submit(s, cfg, tok(1), "10", T0 + cfg.roundSeconds * 1000 + cfg.submitGraceMs); // inside grace: accepted
    expect(code(() => submit(s, cfg, tok(2), "10", T0 + cfg.roundSeconds * 1000 + cfg.submitGraceMs + 1))).toBe("not_open");
    expect(maybeLock(s, cfg, T0 + 14_000)).toBe(false);
    expect(maybeLock(s, cfg, T0 + cfg.roundSeconds * 1000 + cfg.submitGraceMs)).toBe(true);
    expect(s.phase).toBe("locked");
    expect(code(() => submit(s, cfg, tok(3), "10", T0 + 1000))).toBe("not_open");
  });

  it("resubmission: last bid counts", () => {
    const s = withAllTables();
    start(s, cfg, T0);
    submit(s, cfg, tok(1), "10", T0 + 1000);
    submit(s, cfg, tok(1), "12.50", T0 + 2000);
    expect(s.bids[0][1]).toEqual({ cents: 1250, at: T0 + 2000 });
  });

  it("resubmission can be disabled", () => {
    const strict: GameConfig = { ...cfg, rules: { ...cfg.rules, allowResubmit: false } };
    const s = withAllTables();
    start(s, strict, T0);
    submit(s, strict, tok(1), "10", T0 + 1000);
    expect(code(() => submit(s, strict, tok(1), "11", T0 + 2000))).toBe("already_submitted");
  });

  it("invalid price is rejected with a reason", () => {
    const s = withAllTables();
    start(s, cfg, T0);
    expect(code(() => submit(s, cfg, tok(1), "abc", T0))).toBe("bad_price");
  });

  it("host can lock early; reveal only after lock", () => {
    const s = withAllTables();
    start(s, cfg, T0);
    expect(code(() => reveal(s, cfg))).toBe("bad_phase");
    lockNow(s, T0 + 5000);
    expect(s.phase).toBe("locked");
    reveal(s, cfg);
    expect(s.phase).toBe("revealed");
  });

  it("reset round discards bids and returns to waiting on the same dish", () => {
    const s = withAllTables();
    start(s, cfg, T0);
    submit(s, cfg, tok(1), "10", T0);
    resetRound(s);
    expect(s.phase).toBe("waiting");
    expect(s.round).toBe(0);
    expect(s.bids[0]).toBeUndefined();
  });
});

describe("secrecy: true price never reaches clients before reveal", () => {
  it("not in any view while waiting/open/locked; present after reveal", () => {
    const s = withAllTables();
    const price = String(cfg.dishes[0].priceCents);
    const leak = () =>
      JSON.stringify([hostView(s, cfg, T0, []), playerView(s, cfg, tok(1), T0)]).includes(`"priceCents":${price}`);
    expect(leak()).toBe(false);
    start(s, cfg, T0);
    submit(s, cfg, tok(1), "1", T0);
    expect(leak()).toBe(false);
    lockNow(s, T0);
    expect(leak()).toBe(false);
    reveal(s, cfg);
    expect(leak()).toBe(true);
  });

  it("dish is hidden while waiting, shown once the round starts", () => {
    const s = withAllTables();
    expect(playerView(s, cfg, tok(1), T0).dish).toBeNull();
    start(s, cfg, T0);
    const d = playerView(s, cfg, tok(1), T0).dish!;
    expect(d.name).toBe(cfg.dishes[0].name);
    expect(d.images).toEqual([]); // phones show text only by default
    expect(hostView(s, cfg, T0, []).dish!.images).toEqual(cfg.dishes[0].images);
  });

  it("other tables' amounts are not visible to players before reveal", () => {
    const s = withAllTables();
    start(s, cfg, T0);
    submit(s, cfg, tok(2), "77.77", T0);
    const v = playerView(s, cfg, tok(1), T0);
    expect(v.submittedTables).toEqual([2]);
    expect(JSON.stringify(v)).not.toContain("7777");
  });
});

describe("full game: 15 tables x 5 rounds", () => {
  it("plays through to final standings", () => {
    const s = withAllTables();
    let now = T0;
    for (let r = 0; r < cfg.dishes.length; r++) {
      expect(s.phase).toBe("waiting");
      start(s, cfg, now);
      const price = cfg.dishes[r].priceCents;
      // table (r+1) bids exactly the price, table 15 always goes over by 1 cent, others are far under
      for (let t = 1; t <= cfg.tables; t++) {
        const cents = t === r + 1 ? price : t === 15 ? price + 1 : Math.floor(price / 2);
        submit(s, cfg, tok(t), (cents / 100).toFixed(2), now + 1000 + t);
      }
      now += cfg.roundSeconds * 1000 + 5_000;
      expect(maybeLock(s, cfg, now)).toBe(true);
      reveal(s, cfg);
      expect(s.results[r].winners).toEqual([r + 1]);
      next(s, cfg);
    }
    expect(s.phase).toBe("final");
    const v = hostView(s, cfg, now, []);
    expect(v.leaders).toEqual([1, 2, 3, 4, 5]); // five different winners -> tie, rule pending
    expect(v.roundWinners.map((x) => x.winners)).toEqual([[1], [2], [3], [4], [5]]);
    expect(v.standings.find((x) => x.table === 15)!.overBids).toBe(5);
  });

  it("reset game keeps table claims", () => {
    const s = withAllTables();
    start(s, cfg, T0);
    resetGame(s);
    expect(s.phase).toBe("waiting");
    expect(Object.keys(s.claims)).toHaveLength(15);
  });
});
