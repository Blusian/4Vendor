export const marketTypeOptions = ["magic", "pokemon", "sports"] as const;

export type MarketType = (typeof marketTypeOptions)[number];

type MarketableItem = {
  name: string;
  notes?: string | null;
  rarity?: string | null;
  set_code?: string | null;
  set_name?: string | null;
  sku?: string | null;
};

const pokemonHints = [
  "pokemon",
  "evolving skies",
  "paldea",
  "scarlet",
  "violet",
  "crown zenith",
  "surging sparks",
  "twilight masquerade",
  "temporal forces",
];

const sportsHints = [
  "baseball",
  "basketball",
  "football",
  "hockey",
  "soccer",
  "wrestling",
  "prizm",
  "topps",
  "bowman",
  "panini",
  "donruss",
  "optic",
  "mosaic",
  "select",
  "upper deck",
  "stadium club",
  "finest",
];

function normalizeHaystack(item: MarketableItem) {
  return [item.name, item.notes, item.rarity, item.set_code, item.set_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function escapeQueryValue(value: string) {
  return value.replaceAll('"', '\\"').trim();
}

export function coerceMarketType(value: string | null | undefined): MarketType {
  if (value === "pokemon" || value === "sports") {
    return value;
  }

  return "magic";
}

export function getMarketTypeLabel(type: MarketType) {
  switch (type) {
    case "pokemon":
      return "Pokemon";
    case "sports":
      return "Sports";
    default:
      return "Magic";
  }
}

export function getMarketSearchPlaceholder(type: MarketType) {
  switch (type) {
    case "pokemon":
      return 'Try Charizard ex or name:"Umbreon VMAX" set.name:"Evolving Skies"';
    case "sports":
      return "Try Victor Wembanyama Prizm RC";
    default:
      return 'Try "Lightning Bolt" or !"Lightning Bolt" set:lea';
  }
}

export function getMarketSearchHelper(type: MarketType, sportsEnabled: boolean) {
  switch (type) {
    case "pokemon":
      return "Pokemon search uses the official Pokemon TCG API. Search by card name, or add set.name for a tighter match.";
    case "sports":
      return sportsEnabled
        ? "Sports search uses PriceCharting on the server and returns the best current card match with ungraded and graded values."
        : "Sports search is wired up, but it needs PRICECHARTING_API_TOKEN in the server environment before it can return pricing.";
    default:
      return "Magic search uses Scryfall. Search by name, set code, or full Scryfall query syntax.";
  }
}

export function guessMarketTypeFromItem(item: MarketableItem): MarketType {
  const sku = item.sku?.trim().toUpperCase() ?? "";

  if (sku.startsWith("PKM-") || sku.startsWith("POK-")) {
    return "pokemon";
  }

  if (
    sku.startsWith("SPT-") ||
    sku.startsWith("SP-") ||
    sku.startsWith("MLB-") ||
    sku.startsWith("NBA-") ||
    sku.startsWith("NFL-") ||
    sku.startsWith("NHL-")
  ) {
    return "sports";
  }

  const haystack = normalizeHaystack(item);

  if (sportsHints.some((hint) => haystack.includes(hint))) {
    return "sports";
  }

  if (pokemonHints.some((hint) => haystack.includes(hint))) {
    return "pokemon";
  }

  return "magic";
}

export function buildMarketQuery(item: MarketableItem, marketType: MarketType) {
  const normalizedName = escapeQueryValue(item.name);

  switch (marketType) {
    case "pokemon": {
      const setName = item.set_name?.trim();

      if (setName) {
        return `name:"${normalizedName}" set.name:"${escapeQueryValue(setName)}"`;
      }

      return `name:"${normalizedName}"`;
    }
    case "sports":
      return [item.name, item.set_name].filter(Boolean).join(" ").trim();
    default: {
      const normalizedSetCode = item.set_code?.trim().toLowerCase();

      if (normalizedSetCode) {
        return `!"${normalizedName}" set:${normalizedSetCode}`;
      }

      return item.name;
    }
  }
}
