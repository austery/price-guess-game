// End-to-end simulation: 1 host + 15 table phones over real WebSockets.
//
//   npm run dev                         # in one terminal
//   npm run simulate                    # in another (defaults to http://127.0.0.1:8787)
//   BASE_URL=https://xxx.workers.dev HOST_KEY=... npm run simulate   # against a deployment
//
// WARNING: this resets the game in that room. Don't run it against the live event.

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const HOST_KEY = process.env.HOST_KEY || "dev-host-key";
const TABLES = 15;
const WS_BASE = BASE.replace(/^http/, "ws");

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.log(`  ✗ ${msg}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(name, params) {
    this.name = name;
    this.params = params;
    this.view = null;
    this.errors = [];
    this.sawPrice = false;
    this.waiters = [];
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_BASE}/ws?${new URLSearchParams(this.params)}`);
      this.ws.onmessage = (ev) => {
        if (ev.data === "pong") return;
        const msg = JSON.parse(ev.data);
        if (msg.t === "state") {
          this.view = msg.view;
          this.viewAt = Date.now();
          // Before reveal, the current round's price must not be anywhere in the view.
          const v = msg.view;
          if (v.phase !== "revealed" && v.phase !== "final" &&
              (v.result || v.roundWinners.some((w) => w.roundNumber === v.roundNumber))) this.sawPrice = true;
        } else if (msg.t === "error") this.errors.push(msg);
        for (const w of [...this.waiters]) if (w.pred(this)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(); }
      };
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(new Error(`${this.name} failed to connect`));
    });
  }
  send(obj) { this.ws.send(JSON.stringify(obj)); }
  waitFor(pred, ms = 5000, what = "condition") {
    if (pred(this)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const w = { pred, resolve };
      this.waiters.push(w);
      setTimeout(() => { if (this.waiters.includes(w)) reject(new Error(`${this.name}: timeout waiting for ${what}`)); }, ms);
    });
  }
  close() { this.ws.close(); }
}

const rnd = (min, max) => Math.round(min + Math.random() * (max - min));

async function main() {
  console.log(`Simulating against ${BASE}`);
  const host = new Client("host", { role: "host", key: HOST_KEY });
  await host.open();
  await host.waitFor((c) => c.view, 5000, "host view");
  host.send({ t: "resetGame", keepClaims: false });
  await host.waitFor((c) => c.view.claimedTables.length === 0 && c.view.phase === "waiting" && c.view.roundNumber === 1, 5000, "clean reset");

  console.log("\n[join] 15 phones scan and pick a table");
  const players = [];
  for (let t = 1; t <= TABLES; t++) {
    const p = new Client(`table${t}`, { role: "player", token: `sim-${t}-${crypto.randomUUID()}` });
    players.push(p);
  }
  await Promise.all(players.map((p) => p.open()));
  players.forEach((p, i) => p.send({ t: "claim", table: i + 1 }));
  await host.waitFor((c) => c.view.claimedTables.length === TABLES && c.view.connectedTables.length === TABLES, 5000, "all joined");
  ok(true, "host sees 15/15 tables joined and online");

  const intruder = new Client("intruder", { role: "player", token: `sim-x-${crypto.randomUUID()}` });
  await intruder.open();
  intruder.send({ t: "claim", table: 7 });
  await intruder.waitFor((c) => c.errors.length > 0, 3000, "claim error");
  ok(intruder.errors[0].code === "table_taken", "a 16th phone can't take an already-joined table");
  intruder.close();

  const badHost = await fetch(`${BASE}/api/host-check?key=wrong`);
  ok(badHost.status === 403, "wrong host key is rejected");

  const totalRounds = host.view.totalRounds;
  const wins = new Map();
  for (let r = 1; r <= totalRounds; r++) {
    console.log(`\n[round ${r}/${totalRounds}]`);
    const myBids = new Map();
    const startedAt = Date.now();
    host.send({ t: "start" });
    await Promise.all(players.map((p) => p.waitFor((c) => c.view.phase === "open" && c.view.roundNumber === r, 5000, "open")));
    const spread = Math.max(...players.map((p) => p.viewAt)) - startedAt;
    ok(true, `all 15 phones saw the dish within ${spread} ms`);
    ok(players.every((p) => p.view.dish && p.view.dish.image === undefined), "phones get dish text, no image");
    ok(players.every((p) => p.view.deadline - p.view.serverNow > 14000), "deadline is ~15 s ahead");

    // Every table guesses; some include $ or a comma decimal like real people would type.
    for (const [i, p] of players.entries()) {
      const cents = rnd(800, 4500);
      myBids.set(i + 1, cents);
      const s = (cents / 100).toFixed(2);
      p.send({ t: "submit", price: i % 5 === 0 ? `$${s}` : i % 7 === 0 ? s.replace(".", ",") : s });
    }
    await host.waitFor((c) => c.view.submittedTables.length === TABLES, 5000, "all submitted");
    ok(true, "host sees 15/15 answered");

    // Table 2 changes its mind.
    const revised = rnd(800, 4500);
    myBids.set(2, revised);
    players[1].send({ t: "submit", price: (revised / 100).toFixed(2) });
    await players[1].waitFor((c) => c.view.myBid?.cents === revised, 3000, "resubmit");
    ok(true, "table 2 resubmitted; last guess counts");

    // Table 9 loses connection mid-round and comes back on the same phone.
    players[8].close();
    await sleep(300);
    const back = new Client("table9-back", players[8].params);
    await back.open();
    await back.waitFor((c) => c.view, 3000, "reconnect view");
    ok(back.view.myTable === 9 && back.view.myBid?.cents === myBids.get(9), "table 9 reconnects with its table and guess intact");
    players[8] = back;

    if (r === 1) {
      // Let the real 15-second countdown run out.
      await host.waitFor((c) => c.view.phase === "locked", 20000, "auto lock");
      const lockedAfter = Date.now() - startedAt;
      ok(lockedAfter >= 15000 && lockedAfter < 17500, `server auto-locked after ${(lockedAfter / 1000).toFixed(2)} s`);
      players[3].send({ t: "submit", price: "1.00" });
      await players[3].waitFor((c) => c.errors.length > 0, 3000, "late error");
      ok(players[3].errors.at(-1).code === "not_open", "late guess after time's up is rejected");
    } else {
      host.send({ t: "lock" });
      await host.waitFor((c) => c.view.phase === "locked", 3000, "lock");
    }
    ok(players.every((p) => !p.sawPrice) && !host.sawPrice, "true price not sent to anyone before reveal");

    host.send({ t: "reveal" });
    await Promise.all([host, ...players].map((p) => p.waitFor((c) => c.view.phase === "revealed", 5000, "revealed")));
    const res = host.view.result;
    const price = res.priceCents;
    const valid = [...myBids].filter(([, c]) => c <= price);
    const best = valid.length ? Math.max(...valid.map(([, c]) => c)) : null;
    const expected = valid.filter(([, c]) => c === best).map(([t]) => t).sort((a, b) => a - b);
    ok(JSON.stringify(res.winners) === JSON.stringify(expected),
      `price ${(price / 100).toFixed(2)} → winner(s) ${expected.join(",") || "none"} (closest without going over)`);
    ok(res.entries.every((e) => e.cents === myBids.get(e.table)), "server recorded exactly the guesses sent (incl. $ and comma input)");
    ok(res.entries.filter((e) => e.over).every((e) => e.cents > price && !e.winner), "every over-bid is disqualified");
    for (const t of expected) wins.set(t, (wins.get(t) ?? 0) + 1);

    host.send({ t: "next" });
    await host.waitFor((c) => (r === totalRounds ? c.view.phase === "final" : c.view.phase === "waiting" && c.view.roundNumber === r + 1), 3000, "next");
  }

  console.log("\n[final]");
  await Promise.all(players.map((p) => p.waitFor((c) => c.view.phase === "final", 5000, "final")));
  const st = host.view.standings;
  ok(st.every((s) => s.wins === (wins.get(s.table) ?? 0)), "standings match the round winners");
  const top = Math.max(0, ...wins.values());
  console.log(`  leaders: table(s) ${host.view.leaders.join(", ") || "none"} with ${top} round win(s)`);

  [host, ...players].forEach((c) => c.close());
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
