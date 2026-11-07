// One Durable Object instance = one game room. It is the single source of truth:
// it holds the state, enforces the deadline with an alarm, and pushes views to every
// connected screen/phone over WebSockets (Hibernation API, so idle sockets cost nothing).

import { DurableObject } from "cloudflare:workers";
import { GAME_CONFIG, type GameConfig } from "./config";
import {
  GameError,
  claim,
  hostView,
  initialState,
  lockNow,
  normalizeState,
  lockTime,
  maybeLock,
  next,
  playerView,
  release,
  reveal,
  resetGame,
  resetRound,
  skipPractice,
  start,
  startTiebreak,
  submit,
  tableOf,
  type GameState,
} from "./game";

type Role = "host" | "player";
interface Attachment {
  role: Role;
  token: string;
}

const STATE_KEY = "state";

export class GameRoom extends DurableObject<Env> {
  private state: GameState = initialState();
  private cfg: GameConfig = GAME_CONFIG;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = normalizeState(await ctx.storage.get<GameState>(STATE_KEY), this.cfg);
    });
    // Keep-alive pings are answered without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const role = request.headers.get("X-Role") as Role | null;
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (role !== "host" && role !== "player") return new Response("Bad role", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role, token } satisfies Attachment);

    await this.tick();
    this.sendView(server, { role, token });
    if (role === "player") this.broadcast({ hostsOnly: true }); // update "connected" dots
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const att = ws.deserializeAttachment() as Attachment;
    let msg: { t?: string; [k: string]: unknown };
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      return this.sendError(ws, "bad_message", "Malformed message.");
    }
    const now = Date.now();
    maybeLock(this.state, this.cfg, now);
    const before = this.state.version;
    try {
      if (att.role === "player") this.handlePlayer(att, msg, now, ws);
      else this.handleHost(msg, now);
    } catch (err) {
      if (err instanceof GameError) this.sendError(ws, err.code, err.message);
      else {
        console.error(err);
        this.sendError(ws, "internal", "Something went wrong. Please try again.");
      }
    }
    if (this.state.version !== before) await this.persistAndBroadcast();
    else if (msg.t === "sync") this.sendView(ws, att);
  }

  async webSocketClose(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.role === "player") this.broadcast({ hostsOnly: true, exclude: ws });
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  async alarm() {
    if (maybeLock(this.state, this.cfg, Date.now())) await this.persistAndBroadcast();
    else await this.scheduleAlarm(); // fired early? re-arm
  }

  // ---------- handlers ----------

  private handlePlayer(att: Attachment, msg: Record<string, unknown>, now: number, ws: WebSocket) {
    switch (msg.t) {
      case "claim":
        claim(this.state, this.cfg, att.token, Number(msg.table));
        return;
      case "submit":
        submit(this.state, this.cfg, att.token, msg.price, now);
        this.send(ws, { t: "ack", what: "submit" });
        return;
      case "sync":
        return;
      default:
        throw new GameError("bad_message", "Unknown action.");
    }
  }

  private handleHost(msg: Record<string, unknown>, now: number) {
    switch (msg.t) {
      case "start":
        return start(this.state, this.cfg, now);
      case "lock":
        return lockNow(this.state, now);
      case "reveal":
        return reveal(this.state, this.cfg);
      case "next":
        return next(this.state, this.cfg);
      case "startTiebreak":
        return startTiebreak(this.state, this.cfg);
      case "resetRound":
        return resetRound(this.state);
      case "resetGame":
        return resetGame(this.state, msg.keepClaims !== false, this.cfg);
      case "skipPractice":
        return skipPractice(this.state);
      case "release":
        return release(this.state, Number(msg.table));
      case "sync":
        return;
      default:
        throw new GameError("bad_message", "Unknown action.");
    }
  }

  // ---------- plumbing ----------

  /** Catch up on a deadline that passed while hibernating. */
  private async tick() {
    if (maybeLock(this.state, this.cfg, Date.now())) await this.persistAndBroadcast();
  }

  private async persistAndBroadcast() {
    await this.ctx.storage.put(STATE_KEY, this.state);
    await this.scheduleAlarm();
    this.broadcast({});
  }

  private async scheduleAlarm() {
    const lt = lockTime(this.state, this.cfg);
    if (this.state.phase === "open" && lt !== null) await this.ctx.storage.setAlarm(lt);
    else await this.ctx.storage.deleteAlarm();
  }

  private connectedTables(exclude?: WebSocket): number[] {
    const set = new Set<number>();
    for (const ws of this.ctx.getWebSockets("player")) {
      if (ws === exclude || ws.readyState !== WebSocket.OPEN) continue;
      const att = ws.deserializeAttachment() as Attachment;
      const t = tableOf(this.state, att.token);
      if (t !== null) set.add(t);
    }
    return [...set];
  }

  private broadcast(opts: { hostsOnly?: boolean; exclude?: WebSocket }) {
    const sockets = opts.hostsOnly ? this.ctx.getWebSockets("host") : this.ctx.getWebSockets();
    const connected = this.connectedTables(opts.exclude);
    for (const ws of sockets) {
      if (ws === opts.exclude) continue;
      this.sendView(ws, ws.deserializeAttachment() as Attachment, connected);
    }
  }

  private sendView(ws: WebSocket, att: Attachment, connected?: number[]) {
    const now = Date.now();
    const view =
      att.role === "host"
        ? hostView(this.state, this.cfg, now, connected ?? this.connectedTables())
        : playerView(this.state, this.cfg, att.token, now);
    this.send(ws, { t: "state", view });
  }

  private sendError(ws: WebSocket, code: string, message: string) {
    this.send(ws, { t: "error", code, message });
  }

  private send(ws: WebSocket, data: unknown) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      // socket already closed; ignore
    }
  }
}
