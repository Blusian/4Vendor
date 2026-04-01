import type { Metadata } from "next";
import Link from "next/link";

import {
  buildMarketQuery,
  coerceMarketType,
  getMarketTypeLabel,
  guessMarketTypeFromItem,
} from "@/utils/market-search";

import {
  archiveItemAction,
  recordAdjustmentAction,
  recordPurchaseAction,
  updateItemAction,
} from "../actions";
import {
  formatCurrency,
  formatDate,
  formatLabel,
  formatQuantity,
  formatSignedPercent,
  loadDashboardData,
  reasonCodeOptions,
  toDateTimeLocalValue,
} from "../data";
import styles from "../dashboard.module.css";
import { MarketSearchPanel } from "../market-search-panel";
import { BackendSetupCard, DashboardNoticeBanner, DashboardPageIntro } from "../shared";

export const metadata: Metadata = {
  title: "Dashboard Inventory | 4Vendor",
  description: "Review inventory in a compact sheet, edit items directly, and compare cards against market data.",
};

function toMoneyInputValue(cents: number | null | undefined) {
  if (cents === null || cents === undefined) {
    return "";
  }

  return (cents / 100).toFixed(2);
}

export default async function DashboardInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; marketType?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const data = await loadDashboardData({
    inventoryLimit: 1000,
    itemLimit: 1000,
    marketComparisonLimit: 1000,
  });
  const defaultOccurredAt = toDateTimeLocalValue();
  const activeItems = data.items.filter((item) => item.is_active && item.current_status === "active");
  const archivedItems = data.items.filter((item) => !item.is_active || item.current_status !== "active");
  const comparisonByItemId = new Map(
    data.marketComparisons
      .filter((row) => row.item_id)
      .map((row) => [row.item_id as string, row]),
  );
  const quickSearches = activeItems.slice(0, 12).map((item) => {
    const marketType = guessMarketTypeFromItem(item);

    return {
      id: item.id,
      label: item.name,
      marketType,
      query: buildMarketQuery(item, marketType),
    };
  });
  const initialMarketType = coerceMarketType(params.marketType);

  if (data.backendMissing) {
    return (
      <>
        <DashboardNoticeBanner notice={params.notice} />
        <BackendSetupCard />
      </>
    );
  }

  return (
    <>
      <DashboardNoticeBanner notice={params.notice} />

      <section className={styles.gridSection}>
        <DashboardPageIntro
          eyebrow="Inventory"
          title="See every item in a compact sheet first, then edit or remove it without digging through correction forms."
          text="The active inventory is intentionally denser now, closer to a spreadsheet than a stack of cards. Use the editor for catalog changes, compare items against Magic, Pokemon, or Sports pricing, and only use the ledger forms below when quantity actually changes."
        />

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Inventory list</p>
              <h2>Active items</h2>
            </div>
            <span className={styles.badgeMuted}>{activeItems.length} active items</span>
          </div>

          {activeItems.length ? (
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.inventoryTable}`}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Details</th>
                    <th>On hand</th>
                    <th>Reserved</th>
                    <th>Cost</th>
                    <th>Market</th>
                    <th>Last sold</th>
                    <th>Delta</th>
                    <th>Last move</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeItems.map((item) => {
                    const inventoryRow = data.inventoryByItemId.get(item.id);
                    const comparison = comparisonByItemId.get(item.id);
                    const onHandQuantity = Number(inventoryRow?.on_hand_quantity ?? 0);
                    const reservedQuantity = Number(inventoryRow?.reserved_quantity ?? 0);
                    const canArchive = onHandQuantity <= 0 && reservedQuantity <= 0;
                    const marketType = guessMarketTypeFromItem(item);

                    return (
                      <tr key={item.id}>
                        <td className={styles.inventoryItemCell}>
                          <div className={styles.inventoryItemPrimary}>
                            <strong>{item.name}</strong>
                            <span className={styles.badgeMuted}>{formatLabel(item.inventory_type)}</span>
                            <span className={styles.badgeMuted}>{getMarketTypeLabel(marketType)}</span>
                          </div>
                          {item.notes ? <p className={styles.inventoryCellNote}>{item.notes}</p> : null}
                        </td>
                        <td>
                          <div className={styles.inventoryMetaStack}>
                            <span>{item.sku}</span>
                            <span>{item.set_name ?? "No set"}</span>
                            <span>
                              {item.condition ?? "Condition not set"} / {(item.language ?? "en").toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className={styles.inventoryNumericCell}>{formatQuantity(inventoryRow?.on_hand_quantity)}</td>
                        <td className={styles.inventoryNumericCell}>{formatQuantity(inventoryRow?.reserved_quantity)}</td>
                        <td className={styles.inventoryNumericCell}>
                          {formatCurrency(inventoryRow?.weighted_unit_cost_cents)}
                        </td>
                        <td className={styles.inventoryNumericCell}>
                          {item.marketPriceCents !== null ? formatCurrency(item.marketPriceCents) : "No market"}
                        </td>
                        <td className={styles.inventoryNumericCell}>
                          {comparison?.last_sold_unit_price_cents !== null &&
                          comparison?.last_sold_unit_price_cents !== undefined
                            ? formatCurrency(comparison.last_sold_unit_price_cents)
                            : data.marketComparisonMissing
                              ? "Unavailable"
                              : "No sale"}
                        </td>
                        <td className={styles.inventoryNumericCell}>
                          {comparison?.sold_vs_market_percent !== null &&
                          comparison?.sold_vs_market_percent !== undefined
                            ? formatSignedPercent(comparison.sold_vs_market_percent)
                            : "No delta"}
                        </td>
                        <td className={styles.inventoryNumericCell}>{formatDate(inventoryRow?.last_movement_at)}</td>
                        <td className={styles.inventoryTableActions}>
                          <Link
                            className={`${styles.secondaryButton} ${styles.compactButton}`}
                            href={`/dashboard/inventory?marketType=${marketType}&market=${encodeURIComponent(buildMarketQuery(item, marketType))}#market-search`}
                          >
                            Check market
                          </Link>

                          <details className={styles.inventoryCompactEditor}>
                            <summary
                              className={`${styles.secondaryButton} ${styles.inlineSummaryButton} ${styles.compactButton}`}
                            >
                              Edit
                            </summary>

                            <form action={updateItemAction} className={styles.formStack}>
                              <input name="item_id" type="hidden" value={item.id} />

                              <div className={styles.formGrid}>
                                <label className={styles.field}>
                                  <span>SKU</span>
                                  <input name="sku" defaultValue={item.sku} required />
                                </label>
                                <label className={styles.field}>
                                  <span>Item name</span>
                                  <input name="name" defaultValue={item.name} required />
                                </label>
                                <label className={styles.field}>
                                  <span>Set name</span>
                                  <input name="set_name" defaultValue={item.set_name ?? ""} />
                                </label>
                                <label className={styles.field}>
                                  <span>Set code</span>
                                  <input name="set_code" defaultValue={item.set_code ?? ""} />
                                </label>
                                <label className={styles.field}>
                                  <span>Inventory type</span>
                                  <select name="inventory_type" defaultValue={item.inventory_type}>
                                    <option value="single">Single</option>
                                    <option value="sealed">Sealed</option>
                                    <option value="bundle">Bundle</option>
                                    <option value="lot">Lot</option>
                                    <option value="service">Service</option>
                                  </select>
                                </label>
                                <label className={styles.field}>
                                  <span>Rarity</span>
                                  <input name="rarity" defaultValue={item.rarity ?? ""} />
                                </label>
                                <label className={styles.field}>
                                  <span>Condition</span>
                                  <input name="condition" defaultValue={item.condition ?? ""} />
                                </label>
                                <label className={styles.field}>
                                  <span>Language</span>
                                  <input name="language" defaultValue={item.language ?? "en"} />
                                </label>
                                <label className={styles.field}>
                                  <span>Market price ($)</span>
                                  <input
                                    name="market_price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={toMoneyInputValue(item.marketPriceCents)}
                                  />
                                </label>
                                <label className={styles.field}>
                                  <span>Market source</span>
                                  <input name="market_price_source" defaultValue={item.marketPriceSource ?? ""} />
                                </label>
                              </div>

                              <label className={styles.field}>
                                <span>Notes</span>
                                <textarea name="notes" rows={3} defaultValue={item.notes ?? ""} />
                              </label>

                              <div className={styles.inventoryFormFooter}>
                                <button className={`${styles.primaryButton} ${styles.compactButton}`} type="submit">
                                  Save item
                                </button>
                                <p className={styles.helperText}>
                                  This only updates catalog details. Stock counts stay untouched until you post a
                                  purchase or adjustment below.
                                </p>
                              </div>
                            </form>
                          </details>

                          <form action={archiveItemAction} className={styles.inlineActionForm}>
                            <input name="item_id" type="hidden" value={item.id} />
                            <button
                              className={`${styles.secondaryButton} ${styles.compactButton}`}
                              disabled={!canArchive}
                              type="submit"
                            >
                              Remove
                            </button>
                          </form>

                          <p className={styles.inventoryActionHint}>
                            {canArchive
                              ? "Archives the row but keeps the ledger history."
                              : "Zero out on-hand and reserved stock before removing it."}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No active items yet</strong>
              <p>Create your first item in Setup, then it will show up here with direct edit and remove controls.</p>
            </div>
          )}
        </article>

        <MarketSearchPanel
          initialMarketType={initialMarketType}
          initialQuery={params.market ?? ""}
          quickSearches={quickSearches}
          sportsEnabled={Boolean(process.env.PRICECHARTING_API_TOKEN?.trim())}
        />

        {archivedItems.length ? (
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Archived items</p>
                <h2>Removed from the active list</h2>
              </div>
              <span className={styles.badgeMuted}>{archivedItems.length} archived</span>
            </div>

            <div className={styles.listStack}>
              {archivedItems.map((item) => (
                <div className={styles.listRow} key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {item.sku} / {item.set_name ?? "No set"} / {formatLabel(item.current_status)}
                    </p>
                  </div>
                  <div className={styles.listMetrics}>
                    <span>{item.marketPriceCents !== null ? formatCurrency(item.marketPriceCents) : "No market price"}</span>
                    <span>Hidden from new sale and stock forms</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}
      </section>

      <section className={styles.gridSection}>
        <DashboardPageIntro
          eyebrow="Ledger actions"
          title="Post quantity changes only when stock really moved."
          text="Purchases create lots. Adjustments are for count corrections, shrink, and returns. The item editor above is for catalog changes only."
        />

        <div className={styles.operationsGrid}>
          <article className={styles.panel} id="purchases">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Inventory intake</p>
                <h2>Record a purchase</h2>
              </div>
              <span className={styles.badge}>Creates lots</span>
            </div>
            <form action={recordPurchaseAction} className={styles.formStack}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Item</span>
                  <select name="item_id" disabled={!activeItems.length} required>
                    <option value="">{activeItems.length ? "Select an item" : "Create an active item first"}</option>
                    {activeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} / {item.sku}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Quantity</span>
                  <input name="quantity" type="number" step="1" min="0.001" placeholder="1" disabled={!activeItems.length} required />
                </label>
                <label className={styles.field}>
                  <span>Unit cost ($)</span>
                  <input name="unit_cost" type="number" step="0.01" min="0" placeholder="18.60" disabled={!activeItems.length} required />
                </label>
                <label className={styles.field}>
                  <span>Date and time</span>
                  <input name="occurred_at" type="datetime-local" defaultValue={defaultOccurredAt} disabled={!activeItems.length} />
                </label>
                <label className={styles.field}>
                  <span>Counterparty</span>
                  <input name="counterparty_name" placeholder="Collection buy" disabled={!activeItems.length} />
                </label>
                <label className={styles.field}>
                  <span>Description</span>
                  <input name="description" placeholder="Inventory intake" disabled={!activeItems.length} />
                </label>
              </div>
              <label className={styles.field}>
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Optional note for the purchase intake." disabled={!activeItems.length} />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={!activeItems.length}>
                Record purchase
              </button>
            </form>
          </article>

          <article className={styles.panel} id="adjustments">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Correction</p>
                <h2>Adjust inventory</h2>
              </div>
              <span className={styles.badgeMuted}>Reason code required</span>
            </div>
            <form action={recordAdjustmentAction} className={styles.formStack}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Item</span>
                  <select name="item_id" disabled={!activeItems.length} required>
                    <option value="">{activeItems.length ? "Select an item" : "Create an active item first"}</option>
                    {activeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} / {item.sku}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Quantity delta</span>
                  <input name="quantity_delta" type="number" step="1" placeholder="-1 or 2" disabled={!activeItems.length} required />
                </label>
                <label className={styles.field}>
                  <span>Reason code</span>
                  <select name="reason_code" defaultValue="inventory_count" disabled={!activeItems.length}>
                    {reasonCodeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Unit cost ($)</span>
                  <input name="unit_cost" type="number" step="0.01" min="0" placeholder="18.60" disabled={!activeItems.length} />
                </label>
                <label className={styles.field}>
                  <span>Date and time</span>
                  <input name="occurred_at" type="datetime-local" defaultValue={defaultOccurredAt} disabled={!activeItems.length} />
                </label>
                <label className={styles.field}>
                  <span>Description</span>
                  <input name="description" placeholder="Cycle count correction" disabled={!activeItems.length} />
                </label>
              </div>
              <label className={styles.field}>
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Explain why the stock changed." disabled={!activeItems.length} />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={!activeItems.length}>
                Record adjustment
              </button>
            </form>
          </article>
        </div>
      </section>
    </>
  );
}
