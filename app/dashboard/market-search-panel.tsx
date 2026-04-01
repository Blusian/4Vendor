"use client";

import { startTransition, useEffect, useState } from "react";

import {
  getMarketSearchHelper,
  getMarketSearchPlaceholder,
  getMarketTypeLabel,
  type MarketType,
} from "@/utils/market-search";

import styles from "./dashboard.module.css";

type QuickSearch = {
  id: string;
  label: string;
  marketType: MarketType;
  query: string;
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

function formatMarketPrice(value: number | null) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatUpdatedDate(value: string | null) {
  if (!value) {
    return "No timestamp";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function MarketSearchPanel({
  initialMarketType,
  initialQuery,
  quickSearches,
  sportsEnabled,
}: {
  initialMarketType: MarketType;
  initialQuery: string;
  quickSearches: QuickSearch[];
  sportsEnabled: boolean;
}) {
  const [marketType, setMarketType] = useState<MarketType>(initialMarketType);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MarketSearchResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  const runSearch = async (nextQuery: string, nextMarketType: MarketType) => {
    const trimmedQuery = nextQuery.trim();

    if (!trimmedQuery) {
      setResults([]);
      setErrorMessage("");
      setLastQuery("");
      return;
    }

    setIsPending(true);
    setErrorMessage("");
    setLastQuery(trimmedQuery);

    try {
      const response = await fetch(
        `/api/market-search?marketType=${encodeURIComponent(nextMarketType)}&query=${encodeURIComponent(trimmedQuery)}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        results?: MarketSearchResult[];
      };

      if (!response.ok) {
        setResults([]);
        setErrorMessage(payload.error ?? "The market search failed. Try a different query.");
        return;
      }

      setResults(payload.results ?? []);
    } catch {
      setResults([]);
      setErrorMessage(`The ${getMarketTypeLabel(nextMarketType).toLowerCase()} market search could not be reached right now.`);
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    setMarketType(initialMarketType);
    setQuery(initialQuery);

    if (!initialQuery.trim()) {
      return;
    }

    startTransition(() => {
      void runSearch(initialQuery, initialMarketType);
    });
  }, [initialMarketType, initialQuery]);

  const helperText = getMarketSearchHelper(marketType, sportsEnabled);
  const placeholder = getMarketSearchPlaceholder(marketType);

  return (
    <article className={styles.panel} id="market-search">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelLabel}>Market search</p>
          <h2>Search trading-card market data</h2>
        </div>
        <span className={styles.badgeMuted}>Magic / Pokemon / Sports</span>
      </div>

      <div className={styles.marketTypeRow} role="tablist" aria-label="Market type">
        {(["magic", "pokemon", "sports"] as MarketType[]).map((type) => (
          <button
            aria-selected={marketType === type}
            className={marketType === type ? styles.marketTypeChipActive : styles.marketTypeChip}
            key={type}
            onClick={() => {
              setMarketType(type);
              setResults([]);
              setErrorMessage("");
            }}
            role="tab"
            type="button"
          >
            {getMarketTypeLabel(type)}
          </button>
        ))}
      </div>

      <form
        action={async (formData) => {
          const nextQuery = String(formData.get("market_query") ?? "");

          startTransition(() => {
            void runSearch(nextQuery, marketType);
          });
        }}
        className={styles.formStack}
      >
        <label className={styles.field}>
          <span>Search query</span>
          <input
            name="market_query"
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className={styles.inventoryFormFooter}>
          <button className={styles.primaryButton} disabled={isPending} type="submit">
            {isPending ? "Searching..." : `Search ${getMarketTypeLabel(marketType)}`}
          </button>
          <p className={styles.helperText}>{helperText}</p>
        </div>
      </form>

      {quickSearches.length ? (
        <div className={styles.quickSearchRow}>
          {quickSearches.map((search) => (
            <button
              className={styles.quickSearchChip}
              key={search.id}
              onClick={() => {
                setMarketType(search.marketType);
                setQuery(search.query);
                startTransition(() => {
                  void runSearch(search.query, search.marketType);
                });
              }}
              type="button"
            >
              {search.label}
            </button>
          ))}
        </div>
      ) : null}

      {errorMessage ? <p className={styles.helperText}>{errorMessage}</p> : null}

      {results.length ? (
        <div className={styles.listStack}>
          {results.map((result) => {
            const visiblePricePoints = result.pricePoints.filter((point) => point.amount !== null);

            return (
              <div className={styles.listRow} key={`${result.marketType}-${result.id}`}>
                <div className={styles.marketResultSummary}>
                  <div className={styles.inventoryTitleRow}>
                    <strong>{result.name}</strong>
                    <span className={styles.badgeMuted}>{getMarketTypeLabel(result.marketType)}</span>
                    <span className={styles.badgeMuted}>{result.sourceLabel}</span>
                  </div>
                  <p>
                    {result.setName ?? "Unknown set"}
                    {result.setCode ? ` / ${result.setCode.toUpperCase()}` : ""}
                    {result.number ? ` / #${result.number}` : ""}
                    {result.note ? ` / ${result.note}` : ""}
                  </p>
                </div>
                <div className={styles.listMetrics}>
                  <div className={styles.marketPriceRow}>
                    {visiblePricePoints.length ? (
                      visiblePricePoints.map((point) => (
                        <span className={styles.metricBadge} key={`${result.id}-${point.label}`}>
                          {point.label}: {formatMarketPrice(point.amount)}
                        </span>
                      ))
                    ) : (
                      <span className={styles.metricBadge}>No price data yet</span>
                    )}
                  </div>
                  <span>{formatUpdatedDate(result.lastUpdated)} lookup</span>
                  {result.sourceUrl ? (
                    <a href={result.sourceUrl} rel="noreferrer" target="_blank">
                      {result.sourceUrlLabel ?? `Open on ${result.sourceLabel}`}
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : lastQuery ? (
        <div className={styles.emptyState}>
          <strong>No market matches yet</strong>
          <p>
            Nothing came back for <span className={styles.inlineCode}>{lastQuery}</span>. Try a broader{" "}
            {getMarketTypeLabel(marketType).toLowerCase()} card name or add the set.
          </p>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <strong>Search your item against the market</strong>
          <p>Pick one of your active items above or type a Magic, Pokemon, or Sports card to compare live pricing.</p>
        </div>
      )}
    </article>
  );
}
