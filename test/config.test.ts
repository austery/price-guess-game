import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, GAME_CONFIG } from "../src/config";
import { hostView, initialState, playerView } from "../src/game";

const all = [...GAME_CONFIG.practice, ...GAME_CONFIG.dishes, ...GAME_CONFIG.tiebreakers];

describe("game config", () => {
  it("every item image exists under public/", () => {
    for (const item of Object.values(CATALOG) as { name: string; images: string[]; pack?: string }[]) {
      expect(item.images.length, item.name).toBeGreaterThan(0);
      if (item.pack) expect(existsSync(join(__dirname, "..", "public", item.pack)), item.pack).toBe(true);
      for (const img of item.images) expect(existsSync(join(__dirname, "..", "public", img)), img).toBe(true);
    }
  });

  it("prices are positive whole cents", () => {
    for (const item of Object.values(CATALOG)) {
      expect(Number.isInteger(item.priceCents) && item.priceCents > 0, item.name).toBe(true);
    }
  });

  it("no item is used twice in one game", () => {
    expect(new Set(all).size).toBe(all.length);
  });

  it("basket totals add up from their parts", () => {
    for (const d of all) {
      if (d.parts) expect(d.parts.reduce((a, p) => a + p.qty * p.unitCents, 0), d.name).toBe(d.priceCents);
    }
  });

  it("image file names don't give away the price", () => {
    for (const item of all) {
      const dollars = String(Math.floor(item.priceCents / 100));
      for (const img of [...item.images, ...(item.parts ?? []).map((p) => p.image)]) {
        expect(img.replace(/-[0-9a-f]{6}\.jpg$/, ""), img).not.toMatch(new RegExp(`(^|\\D)${dollars}(\\D|$)`));
      }
    }
  });

  it("host preloads every image; phones never get the preload list", () => {
    const s = initialState(GAME_CONFIG);
    const expected = [...new Set(all.flatMap((d) => [...d.images, ...(d.parts ?? []).map((p) => p.image)]))];
    expect(hostView(s, GAME_CONFIG, 0, []).preloadImages).toEqual(expected);
    expect(playerView(s, GAME_CONFIG, "x".repeat(10), 0)).not.toHaveProperty("preloadImages");
  });
});
