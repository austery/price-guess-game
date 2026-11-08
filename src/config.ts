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
   * Played only if two or more tables are tied for first after all rounds.
   * Only the tied tables answer. Leave undefined to just show the tie.
   */
  tiebreaker?: Dish;
}

// ---------------------------------------------------------------------------
// All candidate products (from Candidate_Items.pptx + item_list_and_price.xlsx).
// Images: the product pictures from each slide (price cards left out).
// Prices: shelf price "ea", before tax, as in the spreadsheet.
// ⚠ Three were ON SALE when captured (sale price used): beef-chili, tomato-basil-bisque,
//   tidystack-containers. The default line-up avoids them.
// ---------------------------------------------------------------------------
export const CATALOG = {
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
    priceCents: 1300,
  },
  "santas-ice-cream": {
    name: "PC® Scoop Shop Santa's Milk and Cookies Ice Cream",
    ingredients: ["946 ml"],
    images: ["/items/santas-ice-cream-a-14344e.jpg", "/items/santas-ice-cream-b-9cee82.jpg"],
    priceCents: 500,
  },
  "garlic-pull-aparts": {
    name: "PC® Garlic Parmesan Sourdough Pull-Aparts",
    ingredients: ["355 g"],
    images: ["/items/garlic-pull-aparts-b-3828e5.jpg", "/items/garlic-pull-aparts-a-3c382c.jpg"],
    pack: "/items/garlic-pull-aparts-a-3c382c.jpg",
    priceCents: 350,
  },
  "beef-chili": {
    name: "PC® Slow Simmered Beef Chili",
    ingredients: ["700 g"],
    images: ["/items/beef-chili-b-d0c24b.jpg", "/items/beef-chili-a-86e648.jpg"],
    priceCents: 750, // sale price (regular $9.00)
  },
  "tomato-basil-bisque": {
    name: "PC® Slow Simmered Tomato Basil Bisque Soup",
    ingredients: ["700 ml"],
    images: ["/items/tomato-basil-bisque-a-68019d.jpg", "/items/tomato-basil-bisque-b-73e9c9.jpg"],
    priceCents: 750, // sale price (regular $9.00)
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
    ingredients: ["11 in"],
    images: ["/items/ceraware-skillet-a-5cca1a.jpg", "/items/ceraware-skillet-b-8cca95.jpg"],
    priceCents: 2000,
  },
  "tidystack-containers": {
    name: "PC® TidyStack Glass Containers",
    ingredients: ["3 pack"],
    images: ["/items/tidystack-containers-a-6bf6a1.jpg", "/items/tidystack-containers-b-ad2275.jpg"],
    priceCents: 2000, // sale price (regular $21.00)
  },
  "probiotic-yogurt": {
    name: "PC® Lactose Free Strawberry and Blueberry Probiotic Yogurt",
    ingredients: ["8 × 100 g"],
    images: ["/items/probiotic-yogurt-a-118e17.jpg", "/items/probiotic-yogurt-b-697af6.jpg"],
    priceCents: 400,
  },
} satisfies Record<string, Dish>;

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
    ingredients: parts.map((p) => `${p.qty} × ${p.name}${p.size ? ` (${p.size})` : ""}`),
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
  guessPrompt: "Guess the shelf price of this item (before tax).",
  tables: 15,
  roundSeconds: 15,
  submitGraceMs: 750,
  rules: {
    roundTie: "all-score",
    allowResubmit: true,
    phoneShowsImage: false,
    revealAllBids: true,
  },
  // ---- Line-up: change the IDs to swap products (the editor autocompletes them). ----
  // Practice: cheap, simple items so everyone learns the flow. Doesn't count.
  practice: pick("probiotic-yogurt", "garlic-pull-aparts"),
  // Real rounds: as many rounds as items listed here.
  dishes: pick("beef-wellie-bites", "santas-ice-cream", "ceraware-skillet", "black-label-pinsa", "milk-chocolate-truffles"),
  // Only used if tables are tied for first.
  tiebreaker: CATALOG["buttermilk-turkey"],
};
