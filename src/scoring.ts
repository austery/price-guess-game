// Pure scoring functions. No I/O, no clock — easy to unit test.
// All money is integer cents to avoid floating point errors.

import type { Rules } from "./config";

export type ParseResult = { ok: true; cents: number } | { ok: false; reason: string };

export const MAX_CENTS = 9_999_999; // $99,999.99

/** Accepts "30.75", "$30.75", "30,75", "30", ".5", " 30.7 ". Max 2 decimals. */
export function parsePriceToCents(input: unknown): ParseResult {
  if (typeof input !== "string" && typeof input !== "number") {
    return { ok: false, reason: "Please enter a price." };
  }
  let s = String(input).trim().replace(/^\$\s*/, "").replace(/\s+/g, "");
  // Allow a comma as decimal separator ("30,75") when there is no dot.
  if (!s.includes(".") && /^\d*,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  // Allow thousands separators like "1,234.50".
  if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) s = s.replace(/,/g, "");
  if (s === "" || s === ".") return { ok: false, reason: "Please enter a price." };
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) {
    return /^\d*\.\d{3,}$/.test(s)
      ? { ok: false, reason: "Use at most 2 decimal places, e.g. 30.75." }
      : { ok: false, reason: "That doesn't look like a price. Example: 30.75" };
  }
  const dollars = m[1] === "" ? 0 : Number(m[1]);
  const cents = dollars * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return { ok: false, reason: "That price is too large." };
  if (cents <= 0) return { ok: false, reason: "Price must be more than $0." };
  return { ok: true, cents };
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

export interface Bid {
  cents: number;
  /** Server time (ms) of the submission that is currently counted. */
  at: number;
}

export interface RoundEntry {
  table: number;
  cents: number;
  /** true = bid above the true price (disqualified this round). */
  over: boolean;
  /** priceCents - cents. >= 0 for valid bids, < 0 when over. */
  diff: number;
  winner: boolean;
}

export interface RoundResult {
  priceCents: number;
  /** Valid bids first (closest first), then over-bids (least over first). */
  entries: RoundEntry[];
  winners: number[];
}

/** Closest without going over. */
export function scoreRound(
  bids: Record<number, Bid>,
  priceCents: number,
  roundTie: Rules["roundTie"],
): RoundResult {
  const all = Object.entries(bids).map(([t, b]) => ({
    table: Number(t),
    cents: b.cents,
    at: b.at,
    over: b.cents > priceCents,
    diff: priceCents - b.cents,
  }));
  const valid = all.filter((e) => !e.over).sort((a, b) => b.cents - a.cents || a.at - b.at || a.table - b.table);
  const over = all.filter((e) => e.over).sort((a, b) => a.cents - b.cents || a.at - b.at || a.table - b.table);

  let winners: number[] = [];
  if (valid.length > 0) {
    const top = valid[0].cents;
    const tied = valid.filter((e) => e.cents === top);
    winners = roundTie === "earliest-wins" ? [tied[0].table] : tied.map((e) => e.table);
  }
  const win = new Set(winners);
  const entries: RoundEntry[] = [...valid, ...over].map(({ table, cents, over, diff }) => ({
    table,
    cents,
    over,
    diff,
    winner: win.has(table),
  }));
  return { priceCents, entries, winners: [...winners].sort((a, b) => a - b) };
}

export interface Standing {
  table: number;
  wins: number;
  /** 1-based round numbers this table won. */
  roundsWon: number[];
  /** Data kept for a future tiebreak rule (not used for ranking yet). */
  validBids: number;
  overBids: number;
  /** Sum of (price - bid) over valid bids only. */
  totalUnderCents: number;
  /** Competition ranking: 1, 1, 3 ... (ties share a rank). */
  rank: number;
}

/**
 * Overall standings by number of rounds won.
 * Tiebreak for the overall winner is intentionally NOT decided yet:
 * tables with equal wins share a rank. Add a tiebreak here once the organisers agree on one.
 */
export function computeStandings(tables: number, results: (RoundResult | undefined)[]): Standing[] {
  const rows: Standing[] = [];
  for (let t = 1; t <= tables; t++) {
    rows.push({ table: t, wins: 0, roundsWon: [], validBids: 0, overBids: 0, totalUnderCents: 0, rank: 0 });
  }
  results.forEach((r, i) => {
    if (!r) return;
    for (const e of r.entries) {
      const row = rows[e.table - 1];
      if (!row) continue;
      if (e.over) row.overBids++;
      else {
        row.validBids++;
        row.totalUnderCents += e.diff;
      }
      if (e.winner) {
        row.wins++;
        row.roundsWon.push(i + 1);
      }
    }
  });
  rows.sort((a, b) => b.wins - a.wins || a.table - b.table);
  rows.forEach((row, i) => {
    row.rank = i > 0 && rows[i - 1].wins === row.wins ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

/** Tables currently tied for first place (only meaningful when someone has at least 1 win). */
export function leaders(standings: Standing[]): number[] {
  if (standings.length === 0 || standings[0].wins === 0) return [];
  return standings.filter((s) => s.rank === 1).map((s) => s.table);
}

// ---------- tiebreaker (overall winner) ----------

/**
 * How the tiebreaker was decided:
 *  - "under":   one table closest without going over (normal rule)
 *  - "closest": every tied table went over -> closest to the price wins
 *  - "again":   still tied, and another tiebreak basket is left -> the still-tied tables play it
 *  - "lot":     still tied on the last tiebreak basket (same top bid / same distance / nobody answered) -> random draw
 */
export type TiebreakDecision = "under" | "closest" | "again" | "lot";

export interface TiebreakResult extends RoundResult {
  /** Tables that were tied for first and played the tiebreaker. */
  participants: number[];
  decidedBy: TiebreakDecision;
  /** Tables still tied: the lot was drawn from them ("lot"), or they play the next basket ("again"). */
  lotFrom: number[];
}

/**
 * Agreed rule:
 *  1. closest without going over wins;
 *  2. if all tied tables went over, the one closest to the price wins;
 *  3. if still tied (or nobody answered): the still-tied tables play the next tiebreak basket
 *     (`playAgain`), or, on the last one, a lot is drawn among them.
 * A table that doesn't answer loses (it can only win through the "nobody answered" draw).
 * With "again" there is no winner yet: `winners` is empty.
 */
export function scoreTiebreak(
  bids: Record<number, Bid>,
  priceCents: number,
  participants: number[],
  rand: () => number = Math.random,
  playAgain = false,
): TiebreakResult {
  const allowed = new Set(participants);
  const own: Record<number, Bid> = {};
  for (const [t, b] of Object.entries(bids)) if (allowed.has(Number(t))) own[Number(t)] = b;

  const base = scoreRound(own, priceCents, "all-score");
  let winner: number | null = null;
  let decidedBy: TiebreakDecision;
  let lotFrom: number[] = [];

  if (base.winners.length === 1) {
    winner = base.winners[0];
    decidedBy = "under";
  } else if (base.winners.length > 1) {
    // Same top valid bid -> same distance -> straight to the draw.
    decidedBy = "lot";
    lotFrom = base.winners;
  } else if (base.entries.length > 0) {
    // Everyone over: closest to the price (= the lowest bid) wins.
    const best = Math.min(...base.entries.map((e) => Math.abs(e.diff)));
    const closest = base.entries.filter((e) => Math.abs(e.diff) === best).map((e) => e.table);
    if (closest.length === 1) {
      winner = closest[0];
      decidedBy = "closest";
    } else {
      decidedBy = "lot";
      lotFrom = closest;
    }
  } else {
    decidedBy = "lot";
    lotFrom = [...participants];
  }

  if (winner === null) {
    lotFrom = [...lotFrom].sort((a, b) => a - b);
    if (playAgain) decidedBy = "again";
    else winner = lotFrom[Math.min(lotFrom.length - 1, Math.floor(rand() * lotFrom.length))];
  }
  return {
    priceCents,
    entries: base.entries.map((e) => ({ ...e, winner: e.table === winner })),
    winners: winner === null ? [] : [winner],
    participants: [...participants].sort((a, b) => a - b),
    decidedBy,
    lotFrom,
  };
}
