// Game configuration. Edit this file to change dishes, prices and rules.
//
// IMPORTANT: this file is bundled into the Worker (server side) only.
// True prices never leave the server until the host reveals a round.
// Do NOT put prices anywhere under public/ — everything there is downloadable.

/** One question: a dish, a product, a basket… anything with a price. */
export interface Dish {
  /** Shown on the big screen (and phones). */
  name: string;
  /** Optional bullet list (e.g. 3–6 key ingredients). Use [] for none. */
  ingredients: string[];
  /** Path under public/, e.g. "/dishes/k3f9a.svg". Use an unguessable file name. */
  image?: string;
  /** True total price of the ingredients, in cents. $30.75 -> 3075. */
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
  dishes: Dish[];
  /**
   * Played only if two or more tables are tied for first after all rounds.
   * Only the tied tables answer. Leave undefined to just show the tie.
   */
  tiebreaker?: Dish;
}

export const GAME_CONFIG: GameConfig = {
  title: "Guess the Ingredients Price",
  guessPrompt: "Guess the total price of the ingredients listed.",
  tables: 15,
  roundSeconds: 15,
  submitGraceMs: 750,
  rules: {
    roundTie: "all-score",
    allowResubmit: true,
    phoneShowsImage: false,
    revealAllBids: true,
  },
  // Placeholder dishes for development. Replace with the real five before the event.
  dishes: [
    {
      name: "Appetizer: Caprese Salad",
      ingredients: ["Fresh mozzarella (250 g)", "Tomatoes (4)", "Fresh basil", "Balsamic glaze"],
      image: "/dishes/demo-appetizer-7f3k.svg",
      priceCents: 1875,
    },
    {
      name: "Main 1: Beef Stir-Fry",
      ingredients: ["Flank steak (500 g)", "Broccoli", "Red bell pepper", "Oyster sauce", "Jasmine rice (1 kg)"],
      image: "/dishes/demo-main1-q9w2.svg",
      priceCents: 3075,
    },
    {
      name: "Main 2: Salmon & Asparagus",
      ingredients: ["Salmon fillets (2)", "Asparagus (1 bunch)", "Lemon", "Butter (454 g)"],
      image: "/dishes/demo-main2-m4x8.svg",
      priceCents: 2649,
    },
    {
      name: "Dessert 1: Strawberry Shortcake",
      ingredients: ["Strawberries (1 lb)", "Whipping cream (473 ml)", "Sponge cake", "Icing sugar"],
      image: "/dishes/demo-dessert1-p2z6.svg",
      priceCents: 1597,
    },
    {
      name: "Dessert 2: Chocolate Fondue",
      ingredients: ["Dark chocolate (200 g)", "Bananas", "Marshmallows", "Pound cake", "Heavy cream"],
      image: "/dishes/demo-dessert2-r8n1.svg",
      priceCents: 2233,
    },
  ],
  tiebreaker: {
    name: "Tiebreaker: Breakfast Basket",
    ingredients: ["Eggs (dozen)", "Bacon (375 g)", "Sourdough loaf", "Orange juice (1.75 L)", "Maple syrup (250 ml)"],
    image: "/dishes/demo-tiebreak-h5c3.svg",
    priceCents: 3418,
  },
};
