// Game configuration. Edit this file to change the line-up, prices and rules.
//
// IMPORTANT: this file is bundled into the Worker (server side) only.
// True prices never leave the server until the host reveals a round.
// Do NOT put prices anywhere under public/ — everything there is downloadable.

/** One question: a dish, a product, a basket… anything with a price. */
export interface Dish {
  /** Shown on the big screen (and phones). */
  name: string;
  /** Optional short facts shown as a list, e.g. the package size. Use [] for none. */
  ingredients: string[];
  /**
   * Paths under public/, e.g. "/items/k3f9a.jpg". Use unguessable file names.
   * The first is shown big (usually the package); a second one is overlapped beside it.
   */
  images: string[];
  /** Package-only photo used when this item is inside a basket (default: images[0]). */
  pack?: string;
  /** True price in cents. $30.75 -> 3075. For a basket this is the sum of its parts. */
  priceCents: number;
  /** Basket questions only: what's inside. Shown with photos + quantities; prices only on reveal. */
  parts?: Part[];
  /** Optional countdown for this question, in seconds (default: roundSeconds). */
  seconds?: number;
}

/** One line of a basket: e.g. 2 × soup at $7.50 each. */
export interface Part {
  name: string;
  /** Package size, e.g. "700 ml". */
  size: string;
  /** Package photo under public/. */
  image: string;
  qty: number;
  /** Shelf price of ONE, in cents. */
  unitCents: number;
}

export interface Rules {
  /**
   * Same top valid bid at two tables in one round:
   *  - "all-score":     every tied table gets the point (agreed default)
   *  - "earliest-wins": the table that submitted that amount first gets it
   */
  roundTie: "all-score" | "earliest-wins";
  /** May a table change its bid until time is up? Last submission counts. */
  allowResubmit: boolean;
  /** Show the dish image on phones too (default: text only). */
  phoneShowsImage: boolean;
  /** On reveal, show every table's bid (sorted). If false, only winners + own result. */
  revealAllBids: boolean;
}

export interface GameConfig {
  title: string;
  /** One line telling players what to guess, shown on the join screen and phones. */
  guessPrompt: string;
  tables: number;
  roundSeconds: number;
  /** Extra time the server still accepts bids after the countdown hits 0 (network latency). */
  submitGraceMs: number;
  rules: Rules;
  /**
   * Warm-up rounds played before the real ones so everyone learns the flow.
   * Results are revealed as usual but never count. Use [] for none.
   */
  practice: Dish[];
  dishes: Dish[];
  /**
   * Played only if two or more tables are tied for first after all rounds; only the tied tables answer.
   * If they are still tied after one, the still-tied tables play the next; after the last, lots are drawn.
   * Use [] to just show the tie.
   */
  tiebreakers: Dish[];
}

import { MAGAZINE } from "./magazine";

// ---------------------------------------------------------------------------
// Products from Candidate_Items.pptx (better photos), prices checked against the
// PC Insiders Report Holiday 2026 magazine. ~80 more magazine products are in magazine.ts.
// Images: the product pictures from each slide (price cards left out).
// Prices: shelf price "ea", before tax, as in the spreadsheet.
// The magazine prints the soups at $7.50 ("Only $7.50!") and TidyStack at $20 ("3 for $20!").
// ---------------------------------------------------------------------------
const SLIDE_ITEMS = {
  "beef-wellie-bites": {
    name: "PC® Beef Wellie Bites",
    ingredients: ["288 g"],
    images: ["/items/beef-wellie-bites-a-3ae184.jpg", "/items/beef-wellie-bites-b-97f061.jpg"],
    priceCents: 1000,
  },
  "fish-chips-stacks": {
    name: "PC® The Chip Shop Fish and Chips Stacks",
    ingredients: ["270 g"],
    images: ["/items/fish-chips-stacks-a-a38436.jpg", "/items/fish-chips-stacks-b-ca4770.jpg"],
    priceCents: 1000,
  },
  "goat-cheese-pack": {
    name: "PC® The G.O.A.T. Soft Fresh Goat's Cheeses Variety Pack",
    ingredients: ["420 g"],
    images: ["/items/goat-cheese-pack-a-59ed00.jpg", "/items/goat-cheese-pack-b-e47972.jpg"],
    priceCents: 1200,
  },
  "buttermilk-turkey": {
    name: "PC® Buttermilk-Brined Young Turkey",
    ingredients: ["Whole turkey, 5–7 kg"],
    images: ["/items/buttermilk-turkey-b-ee8ed1.jpg", "/items/buttermilk-turkey-a-783a0d.jpg"],
    priceCents: 4000,
  },
  "cottage-roast": {
    name: "PC® The Great Canadian Cottage Roast",
    ingredients: ["1 kg"],
    images: ["/items/cottage-roast-b-4c7011.jpg", "/items/cottage-roast-a-ca65aa.jpg"],
    priceCents: 1400,
  },
  "butter-tart-pie": {
    name: "PC® Our Ultimate Butter-Tart Pie with Canadian Cranberries",
    ingredients: ["497 g"],
    images: ["/items/butter-tart-pie-a-430161.jpg", "/items/butter-tart-pie-b-dfd164.jpg"],
    priceCents: 1000,
  },
  "milk-chocolate-truffles": {
    name: "PC® Classic Belgian Milk Chocolate Covered Truffles",
    ingredients: ["600 g"],
    images: ["/items/milk-chocolate-truffles-a-219a5d.jpg", "/items/milk-chocolate-truffles-b-5fa3c8.jpg"],
    priceCents: 1500, // magazine p.15 says $15 (the old spreadsheet's $13 is the Praline Collection)
  },
  "santas-ice-cream": {
    name: "PC® Scoop Shop Santa's Milk and Cookies Ice Cream",
    ingredients: ["946 ml"],
    images: ["/items/santas-ice-cream-a-14344e.jpg", "/items/santas-ice-cream-b-9cee82.jpg"],
    priceCents: 500,
  },
  "garlic-pull-aparts": {
    name: "PC® Garlic Parmesan Sourdough Pull-Aparts",
    ingredients: ["365 g"],
    images: ["/items/garlic-pull-aparts-b-3828e5.jpg", "/items/garlic-pull-aparts-a-3c382c.jpg"],
    pack: "/items/garlic-pull-aparts-a-3c382c.jpg",
    priceCents: 350,
  },
  "beef-chili": {
    name: "PC® Slow Simmered Beef Chili",
    ingredients: ["700 g"],
    images: ["/items/beef-chili-b-d0c24b.jpg", "/items/beef-chili-a-86e648.jpg"],
    priceCents: 750,
  },
  "tomato-basil-bisque": {
    name: "PC® Slow Simmered Tomato Basil Bisque Soup",
    ingredients: ["700 ml"],
    images: ["/items/tomato-basil-bisque-a-68019d.jpg", "/items/tomato-basil-bisque-b-73e9c9.jpg"],
    priceCents: 750,
  },
  "charcuterie-board": {
    name: "PC® Oversized Acacia Charcuterie Board",
    ingredients: ["1 board"],
    images: ["/items/charcuterie-board-a-bf89d7.jpg", "/items/charcuterie-board-b-28df1f.jpg"],
    priceCents: 4000,
  },
  "black-label-pinsa": {
    name: "PC® Black Label Stracciatella e Speck Pinsa",
    ingredients: ["325 g"],
    images: ["/items/black-label-pinsa-a-71a1b6.jpg", "/items/black-label-pinsa-b-69efb4.jpg"],
    priceCents: 900,
  },
  "ceraware-skillet": {
    name: "PC® CeraWare Ceramic Non-Stick Cast Aluminum Skillet",
    ingredients: ["11.5 in"],
    images: ["/items/ceraware-skillet-a-5cca1a.jpg", "/items/ceraware-skillet-b-8cca95.jpg"],
    priceCents: 2000,
  },
  "tidystack-containers": {
    name: "PC® TidyStack Glass Containers",
    ingredients: ["3 pack"],
    images: ["/items/tidystack-containers-a-6bf6a1.jpg", "/items/tidystack-containers-b-ad2275.jpg"],
    priceCents: 2000, // "3 for $20" set
  },
  "probiotic-yogurt": {
    name: "PC® Lactose Free Strawberry and Blueberry Probiotic Yogurt",
    ingredients: ["8 × 100 g"],
    images: ["/items/probiotic-yogurt-a-118e17.jpg", "/items/probiotic-yogurt-b-697af6.jpg"],
    priceCents: 400,
  },
} satisfies Record<string, Dish>;

/** Every product the game can use, by ID. */
export const CATALOG = { ...MAGAZINE, ...SLIDE_ITEMS } satisfies Record<string, Dish>;

export type ItemId = keyof typeof CATALOG;
const pick = (...ids: ItemId[]): Dish[] => ids.map((id) => CATALOG[id]);

/**
 * A gift-basket question: list catalog items with how many of each. The answer is added up for you.
 *   basket("Soup Night", [["tomato-basil-bisque", 2], ["garlic-pull-aparts", 1]])
 * `hero`: optional photo of the whole basket/dish; without one the big screen draws a basket of the items.
 */
export function basket(
  name: string,
  items: [ItemId, number][],
  opts: { hero?: string; seconds?: number } = {},
): Dish {
  const parts: Part[] = items.map(([id, qty]) => {
    const item: Dish = CATALOG[id];
    return { name: item.name, size: item.ingredients[0] ?? "", image: item.pack ?? item.images[0], qty, unitCents: item.priceCents };
  });
  return {
    name,
    ingredients: parts.map((p) => `${p.qty > 1 ? `${p.qty} × ` : ""}${p.name}${p.size ? ` (${p.size})` : ""}`),
    images: opts.hero ? [opts.hero] : [],
    priceCents: parts.reduce((sum, p) => sum + p.qty * p.unitCents, 0),
    parts,
    ...(opts.seconds ? { seconds: opts.seconds } : {}),
  };
}

/** Example baskets made from the catalog (for previews; not in the line-up below). */
export const SAMPLE_BASKETS = {
  soupNight: basket("Holiday Soup Night Basket", [
    ["tomato-basil-bisque", 2],
    ["beef-chili", 1],
    ["garlic-pull-aparts", 2],
    ["butter-tart-pie", 1],
  ]),
  party: basket("Holiday Party Basket", [
    ["beef-wellie-bites", 2],
    ["goat-cheese-pack", 1],
    ["black-label-pinsa", 1],
    ["milk-chocolate-truffles", 1],
    ["charcuterie-board", 1],
  ]),
};

export const GAME_CONFIG: GameConfig = {
  title: "Guess the Price",
  guessPrompt: "Guess the total shelf price of everything shown (before tax).",
  tables: 20, // room for extra tables; unused ones just stay empty
  roundSeconds: 45, // baskets: time to read, add up and agree
  submitGraceMs: 750,
  rules: {
    roundTie: "all-score",
    allowResubmit: true,
    phoneShowsImage: false,
    revealAllBids: true,
  },
  // ---- Line-up. Every product comes from the PC Insiders Report Holiday 2026 (prices as printed there).
  // Change items/quantities freely; basket totals are added up automatically.
  // Practice (doesn't count): two baskets so everyone learns how it works.
  // One of each item: tables guess each product's price, no multiplying (time is short).
  practice: [
    basket("Soup Night Basket", [
      ["lobster-bisque", 1],
      ["tomato-basil-bisque", 1],
      ["thai-chicken", 1],
      ["beef-chili", 1],
      ["loaded-baked-potato", 1],
      ["sourdough-crisps-sea-salt", 1],
    ]), // $40.50
    basket("Holiday Sweets Basket", [
      ["butter-tart-pie", 1],
      ["eggnog-ice-cream", 1],
      ["tiramisu-ice-cream-bars", 1],
      ["santas-ice-cream", 1],
      ["ajwa-whole-dates", 1],
    ]), // $34.50
  ],
  // Real rounds: as many rounds as baskets listed here.
  dishes: [
    basket("Holiday Party Snacks", [
      ["beef-wellie-bites", 1],
      ["fish-chips-stacks", 1],
      ["bombas", 1],
      ["shrimp-chips", 1],
      ["gochujang-caramel-popcorn", 1],
      ["pepperoni-pizza-chips", 1],
    ]), // $41.00
    basket("Favourite Things Gift Box", [
      ["hand-cream-trio", 1],
      ["epsom-salts", 1],
      ["acne-patches", 1],
      ["toner-pads-cica-chic-soothing", 1],
    ]), // $47.00
    basket("Cheese Board", [
      ["goat-cheese-pack", 1],
      ["amarena-goat-cheese", 1],
      ["white-fox", 1],
      ["isle-of-man", 1],
      ["lactose-free-mozzarella", 1],
      ["lactose-free-cheese-stick", 1],
    ]), // $46.50
    basket("Bakery Basket", [
      ["sourdough-focaccia-rosemary-sea-salt", 1],
      ["sourdough-focaccia-green-olive", 1],
      ["sourdough-baguette", 1],
      ["garlic-pull-aparts", 1],
      ["all-butter-croissants", 1],
      ["protein-muffins-banana-chocolate-chip", 1],
    ]), // $29.00
    basket("Chocolate Lover's Basket", [
      ["milk-chocolate-truffles", 1],
      ["rice-cakes-milk-chocolate-caramel", 1],
      ["rice-cakes-dark-chocolate-raspberry", 1],
      ["choc-almonds-milk-chocolate", 1],
      ["choc-almonds-dark-chocolate", 1],
      ["candy-cane-ice-cream", 1],
    ]), // $31.50
  ],
  // Only used if tables are tied for first: still tied after one -> the next; after the last, lots are drawn.
  tiebreakers: [
    basket("Kitchen & Home Basket", [
      ["charcuterie-board", 1],
      ["honeycomb-clad-roaster", 1],
      ["ceraware-skillet", 1],
      ["tidystack-containers", 1],
    ]), // $130.00
    basket("Pampered Pets Basket", [
      ["dog-food-digestive", 1],
      ["dog-food-skin-coat", 1],
      ["dog-food-mobility", 1],
      ["cat-food", 1],
    ]), // $104.00
    basket("Pasta Night Basket", [
      ["bolognese-ravioli", 1],
      ["burrata-ravioli", 1],
      ["solerama-tomatoes", 1],
      ["truffle-ricotta-gnocchi", 1],
    ]), // $24.00
  ],
};
