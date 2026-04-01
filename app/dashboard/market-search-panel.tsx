"use client";

import { startTransition, useEffect, useState } from "react";

import styles from "./dashboard.module.css";

type QuickSearch = {
  id: string;
  label: string;
  query: string;
};

type MarketSearchResult = {
  collectorNumber: string | null;
  id: string;
  lastUpdated: string | null;
  name: string;
  scryfallUrl: string;
  setCode: string | null;
  setName: string | null;
  usd: string | null;
  usdEtched: string | null;
  usdFoil: string | null;
};

function formatMarketPrice(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(numericValue);
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
  initialQuery,
  quickSearches,
}: {
  initialQuery: string;
  quickSearches: QuickSearch[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MarketSearchResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  const runSearch = async (nextQuery: string) => {
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
      const response = await fetch(`/api/market-search?query=${encodeURIComponent(trimmedQuery)}`, {
        cache: "no-store",
      });
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
      setErrorMessage("The market search could not reach Scryfall right now. Try again shortly.");
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    setQuery(initialQuery);

    if (!initialQuery.trim()) {
      return;
    }

    startTransition(() => {
      void runSearch(initialQuery);
    });
  }, [initialQuery]);

  return (
    <article className={styles.panel} id="market-search">
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelLabel}>Market search</p>
          <h2>Search MTG market data</h2>
        </div>
        <span className={styles.badgeMuted}>Scryfall, MTG only</span>
      </div>

      <form
        action={async (formData) => {
          const nextQuery = String(formData.get("market_query") ?? "");

          startTransition(() => {
            void runSearch(nextQuery);
          });
        }}
        className={styles.formStack}
      >
        <label className={styles.field}>
          <span>Search query</span>
          <input
            name="market_query"
            placeholder='Try "Lightning Bolt" or !"Lightning Bolt" set:lea'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className={styles.inventoryFormFooter}>
          <button className={styles.primaryButton} disabled={isPending} type="submit">
            {isPending ? "Searching..." : "Search market"}
          </button>
          <p className={styles.helperText}>
            This lookup uses Scryfall, so it works for Magic items right now. Use the quick buttons or search by card
            name, set code, or Scryfall query syntax.
          </p>
        </div>
      </form>

      {quickSearches.length ? (
        <div className={styles.quickSearchRow}>
          {quickSearches.map((search) => (
            <button
              className={styles.quickSearchChip}
              key={search.id}
              onClick={() => {
                setQuery(search.query);
                startTransition(() => {
                  void runSearch(search.query);
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
          {results.map((result) => (
            <div className={styles.listRow} key={result.id}>
              <div>
                <strong>{result.name}</strong>
                <p>
                  {result.setName ?? "Unknown set"}
                  {result.setCode ? ` / ${result.setCode.toUpperCase()}` : ""}
                  {result.collectorNumber ? ` / #${result.collectorNumber}` : ""}
                </p>
              </div>
              <div className={styles.listMetrics}>
                <span>{formatMarketPrice(result.usd)} USD</span>
                <span>{formatMarketPrice(result.usdFoil)} foil</span>
                <span>{formatMarketPrice(result.usdEtched)} etched</span>
                <span>{formatUpdatedDate(result.lastUpdated)} lookup</span>
                <a href={result.scryfallUrl} rel="noreferrer" target="_blank">
                  Open on Scryfall
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : lastQuery ? (
        <div className={styles.emptyState}>
          <strong>No market matches yet</strong>
          <p>
            Nothing came back for <span className={styles.inlineCode}>{lastQuery}</span>. Try a broader MTG card name
            or add a set code.
          </p>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <strong>Search your item against the market</strong>
          <p>Pick one of your active items above or type an MTG card name to compare against live market data.</p>
        </div>
      )}
    </article>
  );
}
