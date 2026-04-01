import { type NextRequest, NextResponse } from "next/server";

import { coerceMarketType, type MarketType } from "@/utils/market-search";

const SCRYFALL_SEARCH_URL = "https://api.scryfall.com/cards/search";
const POKEMON_CARDS_URL = "https://api.pokemontcg.io/v2/cards";
const PRICECHARTING_PRODUCT_URL = "https://www.pricecharting.com/api/product";
const PRICECHARTING_TOKEN = process.env.PRICECHARTING_API_TOKEN?.trim() ?? "";
const POKEMON_TCG_API_KEY = process.env.POKEMON_TCG_API_KEY?.trim() ?? "";

const SCRYFALL_HEADERS = {
  Accept: "application/json;q=0.9,*/*;q=0.8",
  "User-Agent": "4Vendor/0.1 (+https://github.com/Blusian/4Vendor)",
};

type MarketPricePoint = {
  amount: number | null;
  label: string;
};

type MarketSearchResult = {
  id: string;
  lastUpdated: string | null;
  marketType: MarketType;
  name: string;
  note: string | null;
  number: string | null;
  pricePoints: MarketPricePoint[];
  setCode: string | null;
  setName: string | null;
  sourceLabel: string;
  sourceUrl: string | null;
  sourceUrlLabel: string | null;
};

type ScryfallCard = {
  collector_number?: string | null;
  id: string;
  name: string;
  prices?: {
    usd?: string | null;
    usd_etched?: string | null;
    usd_foil?: string | null;
  } | null;
  scryfall_uri: string;
  set?: string | null;
  set_name?: string | null;
};

type PokemonPriceVariant = {
  high?: number | null;
  low?: number | null;
  market?: number | null;
  mid?: number | null;
};

type PokemonCard = {
  id: string;
  name: string;
  number?: string | null;
  rarity?: string | null;
  set?: {
    id?: string | null;
    name?: string | null;
    ptcgoCode?: string | null;
  } | null;
  tcgplayer?: {
    prices?: Record<string, PokemonPriceVariant | undefined> | null;
    updatedAt?: string | null;
    url?: string | null;
  } | null;
};

type PriceChartingProduct = {
  "console-name"?: string;
  "error-message"?: string;
  "graded-price"?: number;
  id?: string;
  "loose-price"?: number;
  "manual-only-price"?: number;
  "product-name"?: string;
  status?: string;
};

export const dynamic = "force-dynamic";

function parseDecimalPrice(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function centsToDollarAmount(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return value / 100;
}

function looksLikeAdvancedPokemonQuery(query: string) {
  return /[:()[\]{}]|(^|[\s!])name:|(^|[\s!])set\./i.test(query);
}

function normalizePokemonQuery(query: string) {
  if (looksLikeAdvancedPokemonQuery(query)) {
    return query;
  }

  const normalizedQuery = query.replaceAll('"', '\\"').trim();
  return `name:"${normalizedQuery}"`;
}

function formatPokemonVariantLabel(value: string) {
  return value
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replace("1st Edition", "1st Ed.")
    .replace("Holofoil", "Holo");
}

function selectPokemonVariant(
  variants: Record<string, PokemonPriceVariant | undefined> | null | undefined,
) {
  if (!variants) {
    return null;
  }

  const priority = [
    "normal",
    "holofoil",
    "reverseHolofoil",
    "1stEditionHolofoil",
    "1stEditionNormal",
    "unlimitedHolofoil",
    "unlimitedNormal",
  ];

  for (const key of priority) {
    if (variants[key]) {
      return {
        label: formatPokemonVariantLabel(key),
        prices: variants[key] ?? null,
      };
    }
  }

  const [firstKey] = Object.keys(variants);

  if (!firstKey || !variants[firstKey]) {
    return null;
  }

  return {
    label: formatPokemonVariantLabel(firstKey),
    prices: variants[firstKey] ?? null,
  };
}

function isLikelySportsConsole(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();

  if (
    normalizedValue.includes("pokemon") ||
    normalizedValue.includes("magic") ||
    normalizedValue.includes("yugioh") ||
    normalizedValue.includes("lorcana") ||
    normalizedValue.includes("one piece") ||
    normalizedValue.includes("digimon")
  ) {
    return false;
  }

  return (
    normalizedValue.includes("card") ||
    normalizedValue.includes("baseball") ||
    normalizedValue.includes("basketball") ||
    normalizedValue.includes("football") ||
    normalizedValue.includes("hockey") ||
    normalizedValue.includes("soccer") ||
    normalizedValue.includes("wrestling")
  );
}

async function searchMagic(query: string): Promise<MarketSearchResult[]> {
  const url = new URL(SCRYFALL_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("unique", "prints");

  const response = await fetch(url, {
    cache: "no-store",
    headers: SCRYFALL_HEADERS,
  });

  const payload = (await response.json()) as {
    data?: ScryfallCard[];
    details?: string;
    warnings?: string[];
  };

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(payload.details ?? payload.warnings?.[0] ?? "Magic market search failed.");
  }

  return (payload.data ?? []).slice(0, 8).map((card) => ({
    id: card.id,
    lastUpdated: new Date().toISOString(),
    marketType: "magic",
    name: card.name,
    note: null,
    number: card.collector_number ?? null,
    pricePoints: [
      { amount: parseDecimalPrice(card.prices?.usd), label: "Market" },
      { amount: parseDecimalPrice(card.prices?.usd_foil), label: "Foil" },
      { amount: parseDecimalPrice(card.prices?.usd_etched), label: "Etched" },
    ],
    setCode: card.set ?? null,
    setName: card.set_name ?? null,
    sourceLabel: "Scryfall",
    sourceUrl: card.scryfall_uri,
    sourceUrlLabel: "Open on Scryfall",
  }));
}

async function searchPokemon(query: string): Promise<MarketSearchResult[]> {
  const url = new URL(POKEMON_CARDS_URL);
  url.searchParams.set("q", normalizePokemonQuery(query));
  url.searchParams.set("pageSize", "8");
  url.searchParams.set("orderBy", "-set.releaseDate,name");
  url.searchParams.set("select", "id,name,number,rarity,set,tcgplayer");

  const headers = POKEMON_TCG_API_KEY ? { "X-Api-Key": POKEMON_TCG_API_KEY } : undefined;
  const response = await fetch(url, {
    cache: "no-store",
    headers,
  });

  const payload = (await response.json()) as {
    data?: PokemonCard[];
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Pokemon market search failed.");
  }

  return (payload.data ?? []).slice(0, 8).map((card) => {
    const variant = selectPokemonVariant(card.tcgplayer?.prices);
    const variantSuffix = variant?.label ? ` (${variant.label})` : "";

    return {
      id: card.id,
      lastUpdated: card.tcgplayer?.updatedAt ?? null,
      marketType: "pokemon" as const,
      name: card.name,
      note: variant?.label ?? card.rarity ?? null,
      number: card.number ?? null,
      pricePoints: [
        { amount: variant?.prices?.market ?? null, label: `Market${variantSuffix}` },
        { amount: variant?.prices?.low ?? null, label: `Low${variantSuffix}` },
        { amount: variant?.prices?.high ?? null, label: `High${variantSuffix}` },
      ],
      setCode: card.set?.ptcgoCode ?? card.set?.id ?? null,
      setName: card.set?.name ?? null,
      sourceLabel: "Pokemon TCG API",
      sourceUrl: card.tcgplayer?.url ?? null,
      sourceUrlLabel: card.tcgplayer?.url ? "Open on TCGplayer" : null,
    };
  });
}

async function searchSports(query: string): Promise<MarketSearchResult[]> {
  if (!PRICECHARTING_TOKEN) {
    throw new Error("Sports market search needs PRICECHARTING_API_TOKEN in the server environment.");
  }

  const url = new URL(PRICECHARTING_PRODUCT_URL);
  url.searchParams.set("t", PRICECHARTING_TOKEN);
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    cache: "no-store",
  });

  const payload = (await response.json()) as PriceChartingProduct;

  if (!response.ok || payload.status === "error") {
    throw new Error(payload["error-message"] ?? "Sports market search failed.");
  }

  if (!payload.id || !payload["product-name"] || !isLikelySportsConsole(payload["console-name"])) {
    return [];
  }

  return [
    {
      id: payload.id,
      lastUpdated: new Date().toISOString(),
      marketType: "sports",
      name: payload["product-name"],
      note: "Best PriceCharting match",
      number: null,
      pricePoints: [
        { amount: centsToDollarAmount(payload["loose-price"]), label: "Ungraded" },
        { amount: centsToDollarAmount(payload["graded-price"]), label: "PSA 9" },
        { amount: centsToDollarAmount(payload["manual-only-price"]), label: "PSA 10" },
      ],
      setCode: null,
      setName: payload["console-name"] ?? null,
      sourceLabel: "PriceCharting",
      sourceUrl: null,
      sourceUrlLabel: null,
    },
  ];
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  const marketType = coerceMarketType(request.nextUrl.searchParams.get("marketType"));

  if (!query) {
    return NextResponse.json({ error: "Search query is required." }, { status: 400 });
  }

  if (query.length > 160) {
    return NextResponse.json({ error: "Keep the search query under 160 characters." }, { status: 400 });
  }

  try {
    let results: MarketSearchResult[] = [];

    if (marketType === "pokemon") {
      results = await searchPokemon(query);
    } else if (marketType === "sports") {
      results = await searchSports(query);
    } else {
      results = await searchMagic(query);
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Market search failed.",
      },
      { status: 503 },
    );
  }
}
