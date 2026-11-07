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
  /** Path under public/, e.g. "/items/k3f9a.jpg". Use an unguessable file name. */
  image?: string;
  /** True price in cents. $30.75 -> 3075. */
  priceCents: number;
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
// Images are the slides with the price cards removed.
// Prices: shelf price "ea", before tax, as in the spreadsheet.
// ⚠ Three were ON SALE when captured (sale price used): beef-chili, tomato-basil-bisque,
//   tidystack-containers. The default line-up avoids them.
// ---------------------------------------------------------------------------
export const CATALOG = {
  "beef-wellie-bites": {
    name: "PC® Beef Wellie Bites",
    ingredients: ["288 g"],
    image: "/items/beef-wellie-bites-5d90d5.jpg",
    priceCents: 1000,
  },
  "fish-chips-stacks": {
    name: "PC® The Chip Shop Fish and Chips Stacks",
    ingredients: ["270 g"],
    image: "/items/fish-chips-stacks-e9207c.jpg",
    priceCents: 1000,
  },
  "goat-cheese-pack": {
    name: "PC® The G.O.A.T. Soft Fresh Goat's Cheeses Variety Pack",
    ingredients: ["420 g"],
    image: "/items/goat-cheese-pack-2c7f68.jpg",
    priceCents: 1200,
  },
  "buttermilk-turkey": {
    name: "PC® Buttermilk-Brined Young Turkey",
    ingredients: ["Whole turkey, 5–7 kg"],
    image: "/items/buttermilk-turkey-0919ec.jpg",
    priceCents: 4000,
  },
  "cottage-roast": {
    name: "PC® The Great Canadian Cottage Roast",
    ingredients: ["1 kg"],
    image: "/items/cottage-roast-0cf335.jpg",
    priceCents: 1400,
  },
  "butter-tart-pie": {
    name: "PC® Our Ultimate Butter-Tart Pie with Canadian Cranberries",
    ingredients: ["497 g"],
    image: "/items/butter-tart-pie-f6034e.jpg",
    priceCents: 1000,
  },
  "milk-chocolate-truffles": {
    name: "PC® Classic Belgian Milk Chocolate Covered Truffles",
    ingredients: ["600 g"],
    image: "/items/milk-chocolate-truffles-ec0298.jpg",
    priceCents: 1300,
  },
  "santas-ice-cream": {
    name: "PC® Scoop Shop Santa's Milk and Cookies Ice Cream",
    ingredients: ["946 ml"],
    image: "/items/santas-ice-cream-c11b47.jpg",
    priceCents: 500,
  },
  "garlic-pull-aparts": {
    name: "PC® Garlic Parmesan Sourdough Pull-Aparts",
    ingredients: ["355 g"],
    image: "/items/garlic-pull-aparts-d849a6.jpg",
    priceCents: 350,
  },
  "beef-chili": {
    name: "PC® Slow Simmered Beef Chili",
    ingredients: ["700 g"],
    image: "/items/beef-chili-09d756.jpg",
    priceCents: 750, // sale price (regular $9.00)
  },
  "tomato-basil-bisque": {
    name: "PC® Slow Simmered Tomato Basil Bisque Soup",
    ingredients: ["700 ml"],
    image: "/items/tomato-basil-bisque-cba14f.jpg",
    priceCents: 750, // sale price (regular $9.00)
  },
  "charcuterie-board": {
    name: "PC® Oversized Acacia Charcuterie Board",
    ingredients: ["1 board"],
    image: "/items/charcuterie-board-6c05af.jpg",
    priceCents: 4000,
  },
  "black-label-pinsa": {
    name: "PC® Black Label Stracciatella e Speck Pinsa",
    ingredients: ["325 g"],
    image: "/items/black-label-pinsa-3ece3c.jpg",
    priceCents: 900,
  },
  "ceraware-skillet": {
    name: "PC® CeraWare Ceramic Non-Stick Cast Aluminum Skillet",
    ingredients: ["11 in"],
    image: "/items/ceraware-skillet-d85a15.jpg",
    priceCents: 2000,
  },
  "tidystack-containers": {
    name: "PC® TidyStack Glass Containers",
    ingredients: ["3 pack"],
    image: "/items/tidystack-containers-a72402.jpg",
    priceCents: 2000, // sale price (regular $21.00)
  },
  "probiotic-yogurt": {
    name: "PC® Lactose Free Strawberry and Blueberry Probiotic Yogurt",
    ingredients: ["8 × 100 g"],
    image: "/items/probiotic-yogurt-197ce7.jpg",
    priceCents: 400,
  },
} satisfies Record<string, Dish>;

export type ItemId = keyof typeof CATALOG;
const pick = (...ids: ItemId[]): Dish[] => ids.map((id) => CATALOG[id]);

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
