import type { Metadata } from "next";
import Link from "next/link";

import {
  recordAdjustmentAction,
  recordPurchaseAction,
  updateMarketBenchmarkAction,
} from "../actions";
import {
  formatCurrency,
  formatDate,
  formatLabel,
  formatQuantity,
  loadDashboardData,
  reasonCodeOptions,
  toDateTimeLocalValue,
} from "../data";
import styles from "../dashboard.module.css";
import { BackendSetupCard, DashboardNoticeBanner, DashboardPageIntro } from "../shared";

export const metadata: Metadata = {
  title: "Dashboard Inventory | 4Vendor",
  description: "Manage stock intake, inventory adjustments, and market benchmarks.",
};

export default async function DashboardInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const params = await searchParams;
  const data = await loadDashboardData({
    inventoryLimit: 64,
    itemLimit: 64,
    marketComparisonLimit: 64,
  });
  const defaultOccurredAt = toDateTimeLocalValue();
  const comparisonByItemId = new Map(
    data.marketComparisons
      .filter((row) => row.item_id)
      .map((row) => [row.item_id as string, row]),
  );

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
          title="Handle stock work in one place, from intake to corrections to market benchmarks."
          text="Use this page when the job is inventory-specific: receive new stock, correct counts, and keep each item's market benchmark current."
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
                  <select name="item_id" disabled={!data.items.length} required>
                    <option value="">{data.items.length ? "Select an item" : "Create an item first"}</option>
                    {data.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} / {item.sku}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Quantity</span>
                  <input name="quantity" type="number" step="1" min="0.001" placeholder="1" disabled={!data.items.length} required />
                </label>
                <label className={styles.field}>
                  <span>Unit cost ($)</span>
                  <input name="unit_cost" type="number" step="0.01" min="0" placeholder="18.60" disabled={!data.items.length} required />
                </label>
                <label className={styles.field}>
                  <span>Date and time</span>
                  <input name="occurred_at" type="datetime-local" defaultValue={defaultOccurredAt} disabled={!data.items.length} />
                </label>
                <label className={styles.field}>
                  <span>Counterparty</span>
                  <input name="counterparty_name" placeholder="Collection buy" disabled={!data.items.length} />
                </label>
                <label className={styles.field}>
                  <span>Description</span>
                  <input name="description" placeholder="Inventory intake" disabled={!data.items.length} />
                </label>
              </div>
              <label className={styles.field}>
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Optional note for the purchase intake." disabled={!data.items.length} />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={!data.items.length}>
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
                  <select name="item_id" disabled={!data.items.length} required>
                    <option value="">{data.items.length ? "Select an item" : "Create an item first"}</option>
                    {data.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} / {item.sku}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Quantity delta</span>
                  <input name="quantity_delta" type="number" step="1" placeholder="-1 or 2" disabled={!data.items.length} required />
                </label>
                <label className={styles.field}>
                  <span>Reason code</span>
                  <select name="reason_code" defaultValue="inventory_count" disabled={!data.items.length}>
                    {reasonCodeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Unit cost ($)</span>
                  <input name="unit_cost" type="number" step="0.01" min="0" placeholder="18.60" disabled={!data.items.length} />
                </label>
                <label className={styles.field}>
                  <span>Date and time</span>
                  <input name="occurred_at" type="datetime-local" defaultValue={defaultOccurredAt} disabled={!data.items.length} />
                </label>
                <label className={styles.field}>
                  <span>Description</span>
                  <input name="description" placeholder="Cycle count correction" disabled={!data.items.length} />
                </label>
              </div>
              <label className={styles.field}>
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Explain why the stock changed." disabled={!data.items.length} />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={!data.items.length}>
                Record adjustment
              </button>
            </form>
          </article>

          <article className={styles.panel} id="benchmarks">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Market benchmark</p>
                <h2>Update inventory pricing</h2>
              </div>
              <span className={styles.badgeMuted}>Manual benchmark</span>
            </div>
            <form action={updateMarketBenchmarkAction} className={styles.formStack}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Item</span>
                  <select name="item_id" disabled={!data.items.length} required>
                    <option value="">{data.items.length ? "Select an item" : "Create an item first"}</option>
                    {data.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} / {item.sku}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Market price ($)</span>
                  <input name="market_price" type="number" step="0.01" min="0" placeholder="52.00" disabled={!data.items.length} required />
                </label>
                <label className={styles.field}>
                  <span>Market source</span>
                  <input name="market_price_source" placeholder="TCGplayer low" disabled={!data.items.length} />
                </label>
              </div>
              <button className={styles.primaryButton} type="submit" disabled={!data.items.length}>
                Save market benchmark
              </button>
            </form>
          </article>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Current stock</p>
              <h2>Inventory position</h2>
            </div>
            <span className={styles.badgeMuted}>{data.inventory.length} tracked items</span>
          </div>

          {data.inventory.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>On hand</th>
                    <th>Reserved</th>
                    <th>Sold</th>
                    <th>Lots</th>
                    <th>Unit cost</th>
                    <th>Market</th>
                    <th>Last movement</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventory.map((item) => {
                    const catalogItem = data.items.find((candidate) => candidate.id === item.item_id);

                    return (
                      <tr key={item.item_id}>
                        <td>
                          {item.name}
                          <br />
                          <small>{item.sku ?? "No SKU"}</small>
                        </td>
                        <td>{formatQuantity(item.on_hand_quantity)}</td>
                        <td>{formatQuantity(item.reserved_quantity)}</td>
                        <td>{formatQuantity(item.sold_quantity)}</td>
                        <td>{item.lot_count ?? 0}</td>
                        <td>{formatCurrency(item.weighted_unit_cost_cents)}</td>
                        <td>
                          {catalogItem?.marketPriceCents !== null
                            ? formatCurrency(catalogItem?.marketPriceCents)
                            : "No benchmark"}
                        </td>
                        <td>{formatDate(item.last_movement_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No inventory rows yet</strong>
              <p>Record a purchase here or create items in Setup to start tracking stock.</p>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Pricing context</p>
              <h2>Latest sold vs market</h2>
            </div>
            <span className={styles.badgeMuted}>
              {data.marketComparisonMissing ? "Migration needed" : `${data.marketComparisons.length} comparisons`}
            </span>
          </div>

          {data.marketComparisonMissing ? (
            <div className={styles.emptyState}>
              <strong>Market comparison reporting is not enabled yet</strong>
              <p>Run the latest market pricing migration and this inventory page will show sold-versus-market context too.</p>
            </div>
          ) : data.inventory.length ? (
            <div className={styles.listStack}>
              {data.inventory.map((item) => {
                const comparison = item.item_id ? comparisonByItemId.get(item.item_id) : null;
                const catalogItem = data.items.find((candidate) => candidate.id === item.item_id);

                return (
                  <div className={styles.listRow} key={`${item.item_id}-pricing`}>
                    <div>
                      <strong>{item.name}</strong>
                      <p>
                        {item.sku} / {formatLabel(item.inventory_type)}
                      </p>
                    </div>
                    <div className={styles.listMetrics}>
                      <span>
                        {catalogItem?.marketPriceCents !== null
                          ? `${formatCurrency(catalogItem?.marketPriceCents)} market`
                          : "No market price"}
                      </span>
                      <span>
                        {comparison?.last_sold_unit_price_cents !== null && comparison?.last_sold_unit_price_cents !== undefined
                          ? `${formatCurrency(comparison.last_sold_unit_price_cents)} last sold`
                          : "No sale yet"}
                      </span>
                      <span>
                        {comparison?.sold_vs_market_cents !== null && comparison?.sold_vs_market_cents !== undefined
                          ? `${formatCurrency(comparison.sold_vs_market_cents)} delta`
                          : "No delta yet"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No pricing context yet</strong>
              <p>Create items in <Link href="/dashboard/setup">Setup</Link>, add stock here, and record sales from Transactions.</p>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
