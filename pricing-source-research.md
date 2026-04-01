# Card Pricing Source Research

Date: 2026-03-31

## Executive Summary

If the goal is "correct pricing" for TCG cards, do not rely on a plain average of whatever numbers are easiest to fetch.

Different sources represent different things:

- sold-market estimates
- active listing prices
- buylist prices
- graded values
- ungraded values

Those should not all be averaged together.

Best practical MVP for a new build:

1. Use `PriceCharting` as the easiest paid cross-game current-value source.
2. Use `CardTrader` as a live marketplace listing source.
3. Use `Scryfall` as an MTG-only enrichment and fallback source.
4. Treat `TCGplayer` and `eBay sold-history` as later-stage sources unless you already have access.

Best product behavior:

- show each source price separately
- show a derived `market_estimate`
- show a confidence score
- keep the raw source records for audit/explainability

That fits the PRD's "Explain My Number" and ledger-first direction.

## Key Findings

### 1. TCGplayer is strong, but new API access is closed

What the official docs show:

- TCGplayer pricing endpoints expose `market`, `low/mid/high`, and `buylist` style data.
- TCGplayer's getting-started guide currently says they are not granting new API access.

Implication:

- If the team already has legacy API credentials, TCGplayer should be a top source for US pricing.
- If not, do not make MVP depend on it.

### 2. eBay sold-history data exists, but official access is restricted

What the official docs show:

- eBay's public `Browse API` supports listing search.
- eBay's `Marketplace Insights API` is the sold-history source.
- eBay marks limited-release APIs as restricted to approved developers/applications.
- eBay's own getting-started guide describes Marketplace Insights as sold history.

Implication:

- eBay sold comps are valuable, but not a safe MVP dependency for a fresh project.
- If later approved, eBay sold history would be one of the best truth sources for cross-market comps.

### 3. PriceCharting is practical today

What the official docs show:

- Paid API with static token auth.
- Supports TCG categories including Pokemon, Magic, YuGiOh, Lorcana, One Piece, and more.
- API limit is `1 call per second`.
- Daily CSV download is available for higher-volume syncs.
- API returns current item values only; historic prices/sales are not supported through the API.
- Product pages surface recent eBay-linked sales data, but the API is explicitly current-values only.

Implication:

- This is a practical first paid source for a new system.
- It is better for "current fair value" than for building your own sold-comps engine.

### 4. CardTrader is a good live-listings source

What the official docs show:

- REST API with bearer-token auth from the user's profile.
- Rate limit of `200 requests per 10 seconds`.
- Marketplace product endpoints return products with price, condition, quantity, and vendor data.
- Supports many relevant games including Pokemon, Magic, Yu-Gi-Oh!, One Piece, Lorcana, Digimon, Star Wars Unlimited, and more.

Implication:

- CardTrader is a good accessible source for current listing signals.
- It is not the same as sold-market truth, so treat it as a listing source, not a sold source.

### 5. Cardmarket is useful if EU data matters

What the official docs show:

- Public data tables expose `Price Guides` and `Product Catalog`.
- Cardmarket supports many TCGs including Magic, Pokemon, Yu-Gi-Oh!, One Piece, Lorcana, Flesh and Blood, Star Wars Unlimited, Digimon, and more.
- Official API documentation is live and currently notes the base URL migration to `apiv2.cardmarket.com` by `May 1, 2026`.
- API docs also describe request limitations and marketplace-specific caps.

Implication:

- Cardmarket is strong if you want EU market signal.
- It is probably phase 2 for a US-first MVP unless the user base is cross-border from day one.

### 6. Scryfall is excellent for MTG-only enrichment

What the official docs show:

- Scryfall's official FAQ says to keep traffic under `10 requests per second`.
- Scryfall recommends bulk data for large lookup workloads.
- Scryfall requires proper headers and discourages redundant live lookups.

Inference:

- Scryfall is excellent for exact MTG card identity matching and MTG-specific enrichment.
- It can also supplement pricing, but it should be treated as an MTG-only source and validated in implementation against the exact fields needed.

## Recommended MVP Source Stack

### If you need something buildable right now

Use this stack:

1. `PriceCharting`
2. `CardTrader`
3. `Scryfall` for MTG only

Later, add:

4. `TCGplayer` if you already have credentials
5. `eBay Marketplace Insights` if approved
6. `Cardmarket` for EU support

### Why this order

- `PriceCharting` gives cross-game current values fast.
- `CardTrader` gives live listing signal and wide TCG coverage.
- `Scryfall` helps MTG identity resolution and MTG-specific fallback.
- `TCGplayer` and `eBay sold-history` are great, but current access constraints make them risky MVP dependencies.

## Recommended Pricing Model

### Do not compute one blind average

Instead compute three different outputs:

1. `market_estimate`
2. `sell_floor`
3. `buy_estimate`

Reason:

- `market_estimate` answers "what is this card roughly worth right now?"
- `sell_floor` answers "what is a competitive listing price?"
- `buy_estimate` answers "what should I pay when buying inventory?"

Those are different business questions.

### Normalize before comparing

Two prices are only comparable if these match:

- game
- card name
- set
- collector number
- finish (`nonfoil`, `foil`, `etched`, etc.)
- language
- condition
- edition / first edition flags where relevant
- graded vs ungraded
- grading company and grade

If those are not normalized first, the price math will be noisy and untrustworthy.

### Recommended aggregation logic

Inference:

For this product, a robust blended estimator is better than a simple average.

Suggested flow:

1. Resolve the exact card identity.
2. Fetch all candidate prices.
3. Convert everything to a comparable currency.
4. Separate by price type:
   - sold-market
   - live-listing
   - buylist
5. Remove obvious mismatches and outliers.
6. Compute source-specific normalized values.
7. Derive output values.

Suggested formulas:

- `market_estimate`
  - Prefer median of sold-market sources.
  - If no sold-market sources exist, use trimmed mean of live-listing sources.
- `sell_floor`
  - Use the lower competitive band of live listings, not the absolute cheapest outlier.
- `buy_estimate`
  - Derive from market estimate and liquidity rules, not from retail list prices.

### Better default than average: median or trimmed mean

Inference:

- `median` is best when you have a small number of sources and one may be wrong.
- `trimmed mean` is fine if you have a larger set of listing observations.
- plain `average` is easiest to explain, but easiest to skew.

Practical recommendation:

- Use `median` when you have 2-5 comparable source values.
- Use `trimmed mean` when you have many listing observations.
- Only show a plain average if the UI labels it clearly as `source_average`.

## Suggested Confidence Model

Give each derived price a confidence score from `0.0` to `1.0`.

Suggested contributors:

- exact identity match quality
- number of sources
- source freshness
- source type quality
- price spread

Example interpretation:

- `0.90+` high confidence: exact match, 3+ agreeing sources
- `0.70-0.89` medium confidence: exact match, 2 decent sources
- `0.40-0.69` low confidence: sparse or wide-spread data
- `<0.40` very low confidence: likely mismatch or only one weak source

## Suggested Data Contract

The PRD strongly suggests storing every source observation so any number can be explained later.

Example:

```json
{
  "card_identity": {
    "game": "pokemon",
    "name": "Charizard",
    "set_name": "Base Set",
    "collector_number": "4",
    "finish": "nonfoil",
    "language": "en",
    "condition": "near_mint",
    "is_graded": false,
    "grade_company": null,
    "grade_value": null
  },
  "source_observations": [
    {
      "source": "pricecharting",
      "source_type": "sold_market_estimate",
      "source_item_id": "12345",
      "currency": "USD",
      "amount": 245.00,
      "observed_at": "2026-03-31T17:00:00Z",
      "freshness_hours": 2,
      "match_confidence": 0.97
    },
    {
      "source": "cardtrader",
      "source_type": "live_listing_median",
      "source_item_id": "67890",
      "currency": "USD",
      "amount": 259.00,
      "observed_at": "2026-03-31T17:02:00Z",
      "freshness_hours": 0.1,
      "match_confidence": 0.94
    }
  ],
  "derived_prices": {
    "market_estimate": 252.00,
    "sell_floor": 249.00,
    "buy_estimate": 176.00,
    "source_average": 252.00,
    "confidence": 0.84
  }
}
```

## Product Recommendation

For the UI, do this:

- show the final `market_estimate`
- show `2-4` source rows underneath
- label each row by source and type
- show `last updated`
- show `confidence`
- let the user click into "Why this price?"

That directly supports the PRD's trust model.

## Recommendation for the Other Agents

### Backend

Build the pricing layer around source adapters, not one pricing table.

Recommended shape:

- `pricing_sources`
- `pricing_observations`
- `pricing_snapshots`
- `card_identity_map`

### Frontend

Do not present one naked price with no explanation.

Show:

- final estimate
- confidence
- source breakdown
- timestamp
- card identity fields that were matched

### Business logic

Keep these separate:

- retail market value
- buylist value
- internal buy offer
- listing recommendation

If those get mixed together, trust will collapse fast.

## Final Recommendation

If I were choosing the research-backed MVP approach today, I would do this:

1. Ship with `PriceCharting + CardTrader + Scryfall(MTG only)`.
2. Compute `market_estimate` with median/trimmed-mean logic, not blind average.
3. Store every raw source observation.
4. Expose source rows and confidence in the UI.
5. Add `TCGplayer` only if the team already has grandfathered API access.
6. Add `eBay sold-history` only if the business later gets approved access.

## Source Links

- TCGplayer getting started: https://docs.tcgplayer.com/docs/getting-started
- TCGplayer pricing endpoints: https://docs.tcgplayer.com/reference/pricing
- eBay Browse API resources: https://developer.ebay.com/api-docs/buy/browse/resources/methods
- eBay guide mentioning Marketplace Insights sold history: https://developer.ebay.com/develop/get-started/get-started-on-a-buying-application
- eBay limited release guide: https://developer.ebay.com/develop/guides-v2
- PriceCharting API docs: https://www.pricecharting.com/api-documentation
- PriceCharting sample card page with eBay-linked sales history: https://www.pricecharting.com/game/pokemon-promo/eevee-133
- CardTrader API overview: https://www.cardtrader.com/en/docs/api
- CardTrader API reference: https://www.cardtrader.com/en/docs/api/full/reference
- Cardmarket data tables: https://www.cardmarket.com/en/Magic/Data
- Cardmarket API docs: https://api.cardmarket.com/ws/documentation
- Scryfall API FAQ / rate-limit guidance: https://scryfall.com/docs/faqs/i-m-having-trouble-accessing-the-scryfall-api-or-i-m-blocked-17
