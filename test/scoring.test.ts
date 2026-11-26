import { describe, expect, it } from "vitest";
import { computeStandings, formatCents, leaders, parsePriceToCents, scoreRound, type Bid } from "../src/scoring";

const b = (cents: number, at = 0): Bid => ({ cents, at });

describe("parsePriceToCents", () => {
  it.each([
    ["30.75", 3075],
    ["$30.75", 3075],
    [" $ 30.75 ", 3075],
    ["30,75", 3075],
    ["30", 3000],
    ["30.7", 3070],
    ["30.", 3000],
    [".5", 50],
    ["1,234.50", 123450],
    ["0.01", 1],
  ])("%s -> %i cents", (input, cents) => {
    expect(parsePriceToCents(input)).toEqual({ ok: true, cents });
  });

  it.each(["", "abc", "30.755", "-5", "0", "0.00", "30.7.5", "1e3", "99999999"])("rejects %j", (input) => {
    expect(parsePriceToCents(input).ok).toBe(false);
  });

  it("explains too many decimals", () => {
    const r = parsePriceToCents("30.755");
    expect(r.ok === false && r.reason).toMatch(/2 decimal/);
  });
});

describe("formatCents", () => {
  it("formats", () => {
    expect(formatCents(3075)).toBe("$30.75");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(123450)).toBe("$1,234.50");
  });
});

describe("scoreRound — closest without going over", () => {
  it("the example from the rules discussion: $30.70 beats $30.80 when price is $30.75", () => {
    const r = scoreRound({ 3: b(3070), 8: b(3080), 12: b(2995) }, 3075, "all-score");
    expect(r.winners).toEqual([3]);
    expect(r.entries.map((e) => [e.table, e.over, e.winner])).toEqual([
      [3, false, true],
      [12, false, false],
      [8, true, false],
    ]);
  });

  it("exact price wins", () => {
    expect(scoreRound({ 1: b(3075), 2: b(3074) }, 3075, "all-score").winners).toEqual([1]);
  });

  it("everyone over -> nobody wins", () => {
    const r = scoreRound({ 1: b(4000), 2: b(3100) }, 3075, "all-score");
    expect(r.winners).toEqual([]);
    expect(r.entries.every((e) => e.over)).toBe(true);
  });

  it("no bids -> nobody wins", () => {
    expect(scoreRound({}, 3075, "all-score").winners).toEqual([]);
  });

  it("tied top bid: all-score gives the point to every tied table", () => {
    expect(scoreRound({ 5: b(3000, 20), 2: b(3000, 10), 9: b(2000) }, 3075, "all-score").winners).toEqual([2, 5]);
  });

  it("tied top bid: earliest-wins gives it to the first submitter", () => {
    expect(scoreRound({ 5: b(3000, 10), 2: b(3000, 20) }, 3075, "earliest-wins").winners).toEqual([5]);
  });
});

describe("computeStandings", () => {
  it("ranks by wins, ties share a rank", () => {
    const r1 = scoreRound({ 3: b(100), 8: b(50) }, 100, "all-score"); // 3 wins
    const r2 = scoreRound({ 8: b(100), 3: b(200) }, 100, "all-score"); // 8 wins, 3 over
    const r3 = scoreRound({ 3: b(90), 1: b(10) }, 100, "all-score"); // 3 wins
    const s = computeStandings(15, [r1, r2, r3, undefined, undefined]);
    expect(s.slice(0, 3).map((x) => [x.table, x.wins, x.rank])).toEqual([
      [3, 2, 1],
      [8, 1, 2],
      [1, 0, 3],
    ]);
    expect(s[0].roundsWon).toEqual([1, 3]);
    expect(s[0].overBids).toBe(1);
    expect(s[0].totalUnderCents).toBe(10);
    expect(s).toHaveLength(15);
    expect(leaders(s)).toEqual([3]);
  });

  it("five different winners -> five-way tie for first (tiebreak not decided yet)", () => {
    const results = [3, 8, 12, 5, 10].map((t) => scoreRound({ [t]: b(100) }, 100, "all-score"));
    const s = computeStandings(15, results);
    expect(leaders(s)).toEqual([3, 5, 8, 10, 12]);
    expect(s.filter((x) => x.rank === 1)).toHaveLength(5);
  });

  it("nobody has won yet -> no leaders", () => {
    expect(leaders(computeStandings(15, []))).toEqual([]);
  });
});
