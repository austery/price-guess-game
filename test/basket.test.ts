import { describe, expect, it } from "vitest";
import { CATALOG, GAME_CONFIG, SAMPLE_BASKETS, basket, type GameConfig } from "../src/config";
import { claim, hostView, initialState, lockNow, playerView, reveal, start, submit } from "../src/game";

const T0 = 1_700_000_000_000;
const tok = (n: number) => `token-table-${String(n).padStart(2, "0")}`;
const soup = SAMPLE_BASKETS.soupNight;
const cfg: GameConfig = { ...GAME_CONFIG, practice: [], dishes: [soup, SAMPLE_BASKETS.party] };

function playing() {
  const s = initialState(cfg);
  for (let t = 1; t <= 3; t++) claim(s, cfg, tok(t), t);
  return s;
}

describe("gift baskets", () => {
  it("adds up the price from the parts", () => {
    const b = basket("Test", [["tomato-basil-bisque", 2], ["garlic-pull-aparts", 3]]);
    expect(b.priceCents).toBe(2 * CATALOG["tomato-basil-bisque"].priceCents + 3 * CATALOG["garlic-pull-aparts"].priceCents);
    expect(b.ingredients[0]).toBe("2 × PC® Slow Simmered Tomato Basil Bisque Soup (700 ml)");
    expect(b.parts![1]).toMatchObject({ qty: 3, image: CATALOG["garlic-pull-aparts"].pack });
  });

  it("shows parts and quantities while guessing, but no unit price until reveal", () => {
    const s = playing();
    const unitLeak = () =>
      JSON.stringify([hostView(s, cfg, T0, []), playerView(s, cfg, tok(1), T0)]).match(/unitCents|subtotalCents|"priceCents"/);
    start(s, cfg, T0);
    const v = hostView(s, cfg, T0, []);
    expect(v.dish!.parts!.map((p) => p.qty)).toEqual([2, 1, 2, 1]);
    expect(v.dish!.parts![0].image).toMatch(/^\/items\//);
    expect(v.breakdown).toBeNull();
    expect(unitLeak()).toBeNull();
    submit(s, cfg, tok(1), "30", T0);
    lockNow(s, T0);
    expect(unitLeak()).toBeNull();
    reveal(s, cfg);
    const r = hostView(s, cfg, T0, []);
    expect(r.breakdown!.map((b) => b.subtotalCents)).toEqual([1500, 750, 700, 1000]);
    expect(r.breakdown!.reduce((a, b) => a + b.subtotalCents, 0)).toBe(r.result!.priceCents);
    expect(r.result!.priceCents).toBe(3950);
  });

  it("phones get the item list as text, without pictures", () => {
    const s = playing();
    start(s, cfg, T0);
    const p = playerView(s, cfg, tok(1), T0);
    expect(p.dish!.ingredients).toHaveLength(4);
    expect(p.dish!.parts!.every((x) => x.image === "")).toBe(true);
  });

  it("a question can have its own countdown length", () => {
    const long: GameConfig = { ...cfg, dishes: [basket("Big", [["beef-chili", 1]], { seconds: 25 })] };
    const s = initialState(long);
    start(s, long, T0);
    expect(s.deadline).toBe(T0 + 25_000);
    expect(hostView(s, long, T0, []).questionSeconds).toBe(25);
  });

  it("basket part images are preloaded by the host", () => {
    const v = hostView(initialState(cfg), cfg, T0, []);
    expect(v.preloadImages).toContain(CATALOG["butter-tart-pie"].images[0]);
  });
});
