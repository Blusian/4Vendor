import { type NextRequest, NextResponse } from "next/server";

const SCRYFALL_SEARCH_URL = "https://api.scryfall.com/cards/search";
const SCRYFALL_HEADERS = {
  Accept: "application/json;q=0.9,*/*;q=0.8",
  "User-Agent": "4Vendor/0.1 (+https://github.com/Blusian/4Vendor)",
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

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ error: "Search query is required." }, { status: 400 });
  }

  if (query.length > 160) {
    return NextResponse.json({ error: "Keep the search query under 160 characters." }, { status: 400 });
  }

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
    object?: string;
    warnings?: string[];
  };

  if (response.status === 404) {
    return NextResponse.json({ results: [] });
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        error: payload.details ?? payload.warnings?.[0] ?? "Market search failed.",
      },
      { status: response.status },
    );
  }

  const results = (payload.data ?? []).slice(0, 8).map((card) => ({
    collectorNumber: card.collector_number ?? null,
    id: card.id,
    lastUpdated: new Date().toISOString(),
    name: card.name,
    scryfallUrl: card.scryfall_uri,
    setCode: card.set ?? null,
    setName: card.set_name ?? null,
    usd: card.prices?.usd ?? null,
    usdEtched: card.prices?.usd_etched ?? null,
    usdFoil: card.prices?.usd_foil ?? null,
  }));

  return NextResponse.json({ results });
}
