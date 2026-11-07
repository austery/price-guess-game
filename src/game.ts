// Game state machine. Pure functions over a plain JSON state object,
// so the Durable Object can persist it as-is and tests can drive it with a fake clock.
//
// Phases for each round (round index r, 0-based):
//   waiting  --start-->  open  --(deadline+grace | host "lock")-->  locked  --reveal-->  revealed
//   revealed --next-->   waiting (r+1)          ... after the last round:  revealed --next--> final
//
// Practice: if cfg.practice is non-empty, a fresh game starts with practiceRound = 0. Practice rounds
// use the same phases, but results are kept apart and never count. After the last practice round
// (or "skipPractice"), the real game starts at round 0.
//
// Tiebreaker: if 2+ tables are tied for first at "final", the host can start one extra round
// (round index = dishes.length) that only the tied tables answer:
//   final --startTiebreak--> waiting --start--> open --> locked --reveal--> revealed --next--> final

import type { GameConfig } from "./config";
import {
  computeStandings,
  leaders,
  parsePriceToCents,
  scoreRound,
  scoreTiebreak,
  type Bid,
  type RoundResult,
  type Standing,
  type TiebreakDecision,
  type TiebreakResult,
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
  /** Index into cfg.practice while practising; null once the real game has started. */
  practiceRound: number | null;
  /** true once practice has been played or skipped (for the "now it counts" banner). */
  practiceDone: boolean;
  practiceResults: Record<string, RoundResult>;
  /** round key (see roundKey) -> table number -> bid. */
  bids: Record<string, Record<string, Bid>>;
  /** round index -> result, filled on reveal. */
  results: Record<string, RoundResult>;
  /** Set when the tiebreaker starts: the tables tied for first. */
  tiebreak: { tables: number[] } | null;
  tiebreakResult: TiebreakResult | null;
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

export function initialState(cfg?: GameConfig): GameState {
  return {
    phase: "waiting",
    round: 0,
    practiceRound: cfg && cfg.practice.length > 0 ? 0 : null,
    practiceDone: false,
    practiceResults: {},
    deadline: null,
    claims: {},
    bids: {},
    results: {},
    tiebreak: null,
    tiebreakResult: null,
    version: 0,
  };
}

/** Fill fields added in later versions when loading an older saved state. */
export function normalizeState(saved: Partial<GameState> | undefined, cfg?: GameConfig): GameState {
  if (!saved) return initialState(cfg);
  return { ...initialState(), ...saved };
}

export function isPractice(s: GameState): boolean {
  return s.practiceRound !== null;
}

export function isTiebreakRound(s: GameState, cfg: GameConfig): boolean {
  return !isPractice(s) && s.round >= cfg.dishes.length;
}

/** Key for this round's bids: "p0", "p1" for practice, "0".."4" for real rounds, "5" for the tiebreaker. */
function roundKey(s: GameState): string {
  return isPractice(s) ? `p${s.practiceRound}` : String(s.round);
}

function currentDish(s: GameState, cfg: GameConfig) {
  if (isPractice(s)) return cfg.practice[s.practiceRound!];
  return isTiebreakRound(s, cfg) ? cfg.tiebreaker : cfg.dishes[s.round];
}

function standingsOf(s: GameState, cfg: GameConfig): Standing[] {
  return computeStandings(cfg.tables, cfg.dishes.map((_, i) => s.results[i]));
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
  if (isTiebreakRound(s, cfg) && !s.tiebreak?.tables.includes(table)) {
    throw new GameError("not_in_tiebreak", "Only the tied tables answer the tiebreaker.");
  }
  const parsed = parsePriceToCents(priceInput);
  if (!parsed.ok) throw new GameError("bad_price", parsed.reason);
  const roundBids = (s.bids[roundKey(s)] ??= {});
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
  if (isTiebreakRound(s, cfg) && !(s.tiebreak && cfg.tiebreaker)) throw new GameError("bad_phase", "No more rounds.");
  s.bids[roundKey(s)] = {};
  if (isPractice(s)) delete s.practiceResults[s.practiceRound!];
  else if (isTiebreakRound(s, cfg)) s.tiebreakResult = null;
  else delete s.results[s.round];
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

export function reveal(s: GameState, cfg: GameConfig, rand: () => number = Math.random) {
  if (s.phase !== "locked") throw new GameError("bad_phase", "Lock the round before revealing.");
  const bids = s.bids[roundKey(s)] ?? {};
  if (isPractice(s)) {
    const p = s.practiceRound!;
    s.practiceResults[p] = scoreRound(bids, cfg.practice[p].priceCents, cfg.rules.roundTie);
  } else if (isTiebreakRound(s, cfg)) {
    s.tiebreakResult = scoreTiebreak(bids, cfg.tiebreaker!.priceCents, s.tiebreak!.tables, rand);
  } else {
    s.results[s.round] = scoreRound(bids, cfg.dishes[s.round].priceCents, cfg.rules.roundTie);
  }
  s.phase = "revealed";
  bump(s);
}

export function next(s: GameState, cfg: GameConfig) {
  if (s.phase !== "revealed") throw new GameError("bad_phase", "Reveal the round first.");
  s.deadline = null;
  if (isPractice(s)) {
    if (s.practiceRound! < cfg.practice.length - 1) s.practiceRound!++;
    else endPractice(s);
    s.phase = "waiting";
  } else if (s.round >= cfg.dishes.length - 1) s.phase = "final"; // last regular round, or the tiebreaker
  else {
    s.round++;
    s.phase = "waiting";
  }
  bump(s);
}

function endPractice(s: GameState) {
  s.practiceRound = null;
  s.practiceDone = true;
  s.round = 0;
}

/** Host skips the remaining practice rounds and starts the real game. */
export function skipPractice(s: GameState) {
  if (!isPractice(s)) throw new GameError("bad_phase", "Practice is already over.");
  if (s.phase === "open" || s.phase === "locked") throw new GameError("bad_phase", "Finish or redo this practice round first.");
  endPractice(s);
  s.phase = "waiting";
  s.deadline = null;
  bump(s);
}

/** After all rounds, if 2+ tables share first place: only they play one extra round. */
export function startTiebreak(s: GameState, cfg: GameConfig) {
  if (s.phase !== "final") throw new GameError("bad_phase", "The tiebreaker comes after the last round.");
  if (!cfg.tiebreaker) throw new GameError("no_tiebreaker", "No tiebreaker question is configured.");
  if (s.tiebreak) throw new GameError("bad_phase", "The tiebreaker has already been played.");
  const tied = leaders(standingsOf(s, cfg));
  if (tied.length < 2) throw new GameError("bad_phase", "There is no tie for first place.");
  s.tiebreak = { tables: tied };
  s.round = cfg.dishes.length;
  s.phase = "waiting";
  s.deadline = null;
  bump(s);
}

/** Throw away the current round's bids/result and go back to "waiting" for the same dish. */
export function resetRound(s: GameState) {
  if (s.phase === "final") throw new GameError("bad_phase", "The game is over. Use Reset game instead.");
  delete s.bids[roundKey(s)];
  if (isPractice(s)) delete s.practiceResults[s.practiceRound!];
  else if (s.tiebreak) s.tiebreakResult = null; // tiebreak is only ever set while in the tiebreaker round
  else delete s.results[s.round];
  s.phase = "waiting";
  s.deadline = null;
  bump(s);
}

/** Start over (with practice, if configured). Table claims are kept so phones don't need to rejoin. */
export function resetGame(s: GameState, keepClaims = true, cfg?: GameConfig) {
  const claims = keepClaims ? s.claims : {};
  const version = s.version;
  Object.assign(s, initialState(cfg), { claims, version: version + 1 });
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

export interface Champion {
  table: number;
  /** "rounds" = most round wins outright; otherwise how the tiebreaker was decided. */
  how: "rounds" | TiebreakDecision;
}

export interface CommonView {
  title: string;
  guessPrompt: string;
  phase: Phase;
  /** true while the tiebreaker round is being played. */
  isTiebreak: boolean;
  /** Practice round info while practising (results never count). */
  isPractice: boolean;
  /** 1-based practice round number, or null. */
  practiceNumber: number | null;
  practiceTotal: number;
  /** Practice has been played/skipped and the real game has begun. */
  practiceDone: boolean;
  /** Tables playing the tiebreaker (null if none). */
  tiebreakTables: number[] | null;
  tiebreakResult: TiebreakResult | null;
  /** Set once the overall winner is known. */
  champion: Champion | null;
  /** Host may start the tiebreaker now. */
  canStartTiebreak: boolean;
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
  result: RoundResult | TiebreakResult | null;
  standings: Standing[];
  leaders: number[];
  /** Results of every revealed round so far (for the final screen). */
  roundWinners: { roundNumber: number; dishName: string; priceCents: number; winners: number[] }[];
  version: number;
}

export interface HostView extends CommonView {
  role: "host";
  /** Every item image, so the big screen can load them in advance (host only). */
  preloadImages: string[];
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
  const lead = leaders(standings);
  const dish = currentDish(s, cfg);
  const tiebreakRound = isTiebreakRound(s, cfg);
  let champion: Champion | null = null;
  if (s.phase === "final" || (tiebreakRound && s.phase === "revealed")) {
    if (lead.length === 1) champion = { table: lead[0], how: "rounds" };
    else if (s.tiebreakResult) champion = { table: s.tiebreakResult.winners[0], how: s.tiebreakResult.decidedBy };
  }
  return {
    title: cfg.title,
    guessPrompt: cfg.guessPrompt,
    phase: s.phase,
    isTiebreak: tiebreakRound,
    isPractice: isPractice(s),
    practiceNumber: isPractice(s) ? s.practiceRound! + 1 : null,
    practiceTotal: cfg.practice.length,
    practiceDone: s.practiceDone,
    tiebreakTables: s.tiebreak?.tables ?? null,
    tiebreakResult: s.tiebreakResult,
    champion,
    canStartTiebreak: s.phase === "final" && lead.length > 1 && !!cfg.tiebreaker && !s.tiebreak,
    roundNumber: s.round + 1,
    totalRounds: cfg.dishes.length,
    roundSeconds: cfg.roundSeconds,
    deadline: s.deadline,
    serverNow: now,
    tables: cfg.tables,
    claimedTables: Object.keys(s.claims).map(Number).sort((a, b) => a - b),
    submittedTables: Object.keys(s.bids[roundKey(s)] ?? {}).map(Number).sort((a, b) => a - b),
    dish: dish && dishVisible(s) ? { name: dish.name, ingredients: dish.ingredients, image: dish.image } : null,
    // The true price only leaves the server inside a revealed result.
    result:
      s.phase !== "revealed"
        ? null
        : ((isPractice(s) ? s.practiceResults[s.practiceRound!] : tiebreakRound ? s.tiebreakResult : s.results[s.round]) ?? null),
    standings,
    leaders: lead,
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
    preloadImages: [...cfg.practice, ...cfg.dishes, ...(cfg.tiebreaker ? [cfg.tiebreaker] : [])].flatMap((d) =>
      d.image ? [d.image] : [],
    ),
    connectedTables: [...connectedTables].sort((a, b) => a - b),
    bidCount: Object.keys(s.bids[roundKey(s)] ?? {}).length,
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
    myBid: myTable !== null ? (s.bids[roundKey(s)]?.[myTable] ?? null) : null,
  };
}
