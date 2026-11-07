// Game state machine. Pure functions over a plain JSON state object,
// so the Durable Object can persist it as-is and tests can drive it with a fake clock.
//
// Phases for each round (round index r, 0-based):
//   waiting  --start-->  open  --(deadline+grace | host "lock")-->  locked  --reveal-->  revealed
//   revealed --next-->   waiting (r+1)          ... after the last round:  revealed --next--> final

import type { GameConfig } from "./config";
import {
  computeStandings,
  leaders,
  parsePriceToCents,
  scoreRound,
  type Bid,
  type RoundResult,
  type Standing,
} from "./scoring";

export type Phase = "waiting" | "open" | "locked" | "revealed" | "final";

export interface GameState {
  phase: Phase;
  /** 0-based index of the current round. */
  round: number;
  /** Server ms when the countdown reaches 0 (only while open/locked). */
  deadline: number | null;
  /** table number -> player token currently holding it. */
  claims: Record<string, string>;
  /** round index -> table number -> bid. */
  bids: Record<string, Record<string, Bid>>;
  /** round index -> result, filled on reveal. */
  results: Record<string, RoundResult>;
  /** Bumped on every change; handy for debugging and clients. */
  version: number;
}

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function initialState(): GameState {
  return { phase: "waiting", round: 0, deadline: null, claims: {}, bids: {}, results: {}, version: 0 };
}

function bump(s: GameState) {
  s.version++;
}

export function tableOf(s: GameState, token: string): number | null {
  for (const [t, tok] of Object.entries(s.claims)) if (tok === token) return Number(t);
  return null;
}

/** Time after which bids are refused and the round locks. */
export function lockTime(s: GameState, cfg: GameConfig): number | null {
  return s.deadline === null ? null : s.deadline + cfg.submitGraceMs;
}

// ---------- player actions ----------

export function claim(s: GameState, cfg: GameConfig, token: string, table: number) {
  if (!Number.isInteger(table) || table < 1 || table > cfg.tables) {
    throw new GameError("bad_table", `Pick a table between 1 and ${cfg.tables}.`);
  }
  const holder = s.claims[table];
  if (holder === token) return;
  if (holder) throw new GameError("table_taken", `Table ${table} is already joined on another phone. Ask the host to release it.`);
  const current = tableOf(s, token);
  if (current !== null) delete s.claims[current];
  s.claims[table] = token;
  bump(s);
}

export function submit(s: GameState, cfg: GameConfig, token: string, priceInput: unknown, now: number): Bid {
  const table = tableOf(s, token);
  if (table === null) throw new GameError("no_table", "Choose your table first.");
  if (s.phase !== "open") {
    throw new GameError("not_open", s.phase === "locked" || s.phase === "revealed" ? "Time's up for this round." : "The round hasn't started yet.");
  }
  const lt = lockTime(s, cfg);
  if (lt !== null && now > lt) throw new GameError("not_open", "Time's up for this round.");
  const parsed = parsePriceToCents(priceInput);
  if (!parsed.ok) throw new GameError("bad_price", parsed.reason);
  const roundBids = (s.bids[s.round] ??= {});
  if (roundBids[table] && !cfg.rules.allowResubmit) {
    throw new GameError("already_submitted", "Your table has already submitted for this round.");
  }
  const bid: Bid = { cents: parsed.cents, at: now };
  roundBids[table] = bid;
  bump(s);
  return bid;
}

// ---------- host actions ----------

export function start(s: GameState, cfg: GameConfig, now: number) {
  if (s.phase !== "waiting") throw new GameError("bad_phase", "A round is already in progress.");
  if (s.round >= cfg.dishes.length) throw new GameError("bad_phase", "No more rounds.");
  s.bids[s.round] = {};
  delete s.results[s.round];
  s.phase = "open";
  s.deadline = now + cfg.roundSeconds * 1000;
  bump(s);
}

/** Lock automatically once deadline + grace has passed. Returns true if state changed. */
export function maybeLock(s: GameState, cfg: GameConfig, now: number): boolean {
  const lt = lockTime(s, cfg);
  if (s.phase === "open" && lt !== null && now >= lt) {
    s.phase = "locked";
    bump(s);
    return true;
  }
  return false;
}

/** Host ends the round early (e.g. every table has answered). */
export function lockNow(s: GameState, now: number) {
  if (s.phase !== "open") throw new GameError("bad_phase", "No open round to lock.");
  s.phase = "locked";
  s.deadline = Math.min(s.deadline ?? now, now);
  bump(s);
}

export function reveal(s: GameState, cfg: GameConfig) {
  if (s.phase !== "locked") throw new GameError("bad_phase", "Lock the round before revealing.");
  const dish = cfg.dishes[s.round];
  s.results[s.round] = scoreRound(s.bids[s.round] ?? {}, dish.priceCents, cfg.rules.roundTie);
  s.phase = "revealed";
  bump(s);
}

export function next(s: GameState, cfg: GameConfig) {
  if (s.phase !== "revealed") throw new GameError("bad_phase", "Reveal the round first.");
  s.deadline = null;
  if (s.round >= cfg.dishes.length - 1) s.phase = "final";
  else {
    s.round++;
    s.phase = "waiting";
  }
  bump(s);
}

/** Throw away the current round's bids/result and go back to "waiting" for the same dish. */
export function resetRound(s: GameState) {
  if (s.phase === "final") throw new GameError("bad_phase", "The game is over. Use Reset game instead.");
  delete s.bids[s.round];
  delete s.results[s.round];
  s.phase = "waiting";
  s.deadline = null;
  bump(s);
}

/** Start over from round 1. Table claims are kept so phones don't need to rejoin. */
export function resetGame(s: GameState, keepClaims = true) {
  const claims = keepClaims ? s.claims : {};
  const version = s.version;
  Object.assign(s, initialState(), { claims, version: version + 1 });
}

export function release(s: GameState, table: number) {
  if (s.claims[table] === undefined) return;
  delete s.claims[table];
  bump(s);
}

// ---------- views (what each client is allowed to see) ----------

export interface DishView {
  name: string;
  ingredients: string[];
  image?: string;
}

export interface CommonView {
  title: string;
  phase: Phase;
  /** 1-based for display. */
  roundNumber: number;
  totalRounds: number;
  roundSeconds: number;
  deadline: number | null;
  serverNow: number;
  tables: number;
  claimedTables: number[];
  submittedTables: number[];
  dish: DishView | null;
  result: RoundResult | null;
  standings: Standing[];
  leaders: number[];
  /** Results of every revealed round so far (for the final screen). */
  roundWinners: { roundNumber: number; dishName: string; priceCents: number; winners: number[] }[];
  version: number;
}

export interface HostView extends CommonView {
  role: "host";
  connectedTables: number[];
  bidCount: number;
}

export interface PlayerView extends CommonView {
  role: "player";
  myTable: number | null;
  myBid: Bid | null;
}

function dishVisible(s: GameState) {
  return s.phase === "open" || s.phase === "locked" || s.phase === "revealed";
}

function common(s: GameState, cfg: GameConfig, now: number): CommonView {
  const results = cfg.dishes.map((_, i) => s.results[i]);
  const standings = computeStandings(cfg.tables, results);
  const dish = cfg.dishes[s.round];
  return {
    title: cfg.title,
    phase: s.phase,
    roundNumber: s.round + 1,
    totalRounds: cfg.dishes.length,
    roundSeconds: cfg.roundSeconds,
    deadline: s.deadline,
    serverNow: now,
    tables: cfg.tables,
    claimedTables: Object.keys(s.claims).map(Number).sort((a, b) => a - b),
    submittedTables: Object.keys(s.bids[s.round] ?? {}).map(Number).sort((a, b) => a - b),
    dish: dish && dishVisible(s) ? { name: dish.name, ingredients: dish.ingredients, image: dish.image } : null,
    // The true price only leaves the server inside a revealed result.
    result: s.phase === "revealed" ? (s.results[s.round] ?? null) : null,
    standings,
    leaders: leaders(standings),
    roundWinners: results.flatMap((r, i) =>
      r ? [{ roundNumber: i + 1, dishName: cfg.dishes[i].name, priceCents: r.priceCents, winners: r.winners }] : [],
    ),
    version: s.version,
  };
}

export function hostView(s: GameState, cfg: GameConfig, now: number, connectedTables: number[]): HostView {
  return {
    ...common(s, cfg, now),
    role: "host",
    connectedTables: [...connectedTables].sort((a, b) => a - b),
    bidCount: Object.keys(s.bids[s.round] ?? {}).length,
  };
}

export function playerView(s: GameState, cfg: GameConfig, token: string, now: number): PlayerView {
  const view = common(s, cfg, now);
  const myTable = tableOf(s, token);
  if (view.dish && !cfg.rules.phoneShowsImage) view.dish = { ...view.dish, image: undefined };
  if (view.result && !cfg.rules.revealAllBids) {
    view.result = {
      ...view.result,
      entries: view.result.entries.filter((e) => e.winner || e.table === myTable),
    };
  }
  return {
    ...view,
    role: "player",
    myTable,
    myBid: myTable !== null ? (s.bids[s.round]?.[myTable] ?? null) : null,
  };
}
