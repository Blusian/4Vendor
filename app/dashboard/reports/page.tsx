import type { Metadata } from "next";

import {
  formatCurrency,
  formatDate,
  formatLabel,
  formatPercentFromBps,
  formatSignedPercent,
  formatQuantity,
  loadDashboardData,
} from "../data";
import styles from "../dashboard.module.css";
import { BackendSetupCard, DashboardNoticeBanner, DashboardPageIntro } from "../shared";

export const metadata: Metadata = {
  title: "Dashboard Reports | 4Vendor",
  description: "Review reconciliation, profit snapshots, audit events, inventory, and integrity alerts.",
};

export default async function DashboardReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const params = await searchParams;
  const data = await loadDashboardData();

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
          eyebrow="Reports"
          title="Review the books, the stock, and the audit trail without cluttering the transaction forms."
          text="This page is for the deeper read: reconciliation, profitability, inventory carrying cost, recent audit events, and integrity checks."
        />
      </section>

      <section className={styles.reportGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Sales vs market</p>
              <h2>What I sold it for vs what it markets for</h2>
            </div>
            <span className={styles.badgeMuted}>
              {data.marketComparisonMissing ? "Migration needed" : `${data.marketComparisons.length} tracked items`}
            </span>
          </div>

          {data.marketComparisonMissing ? (
            <div className={styles.emptyState}>
              <strong>Market comparison reporting is not enabled yet</strong>
              <p>
                Run the latest Supabase migration for market pricing, then this section will compare finalized sale
                prices against your saved benchmark.
              </p>
            </div>
          ) : data.marketComparisons.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Last sold</th>
                    <th>Market</th>
                    <th>Delta</th>
                    <th>Average sold</th>
                    <th>Last sold at</th>
                  </tr>
                </thead>
                <tbody>
                  {data.marketComparisons.map((row) => (
                    <tr key={row.item_id}>
                      <td>
                        {row.name}
                        <br />
                        <small>{row.sku ?? "No SKU"}</small>
                      </td>
                      <td>{formatCurrency(row.last_sold_unit_price_cents)}</td>
                      <td>{formatCurrency(row.market_price_cents)}</td>
                      <td>
                        {row.sold_vs_market_cents === null
                          ? "No benchmark"
                          : `${formatCurrency(row.sold_vs_market_cents)} (${formatSignedPercent(row.sold_vs_market_percent)})`}
                      </td>
                      <td>{formatCurrency(row.average_sold_unit_price_cents)}</td>
                      <td>{formatDate(row.last_sold_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No market comparison rows yet</strong>
              <p>Set a market benchmark in Setup and record a sale to compare sold price against the market number.</p>
            </div>
          )}
        </article>
      </section>

      <section className={styles.reportGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Reconciliation</p>
              <h2>Cash and receivables</h2>
            </div>
            <span className={styles.badgeMuted}>{data.reconciliation.length} rows</span>
          </div>

          {data.reconciliation.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Channel</th>
                    <th>Payment</th>
                    <th>Sales</th>
                    <th>Purchases</th>
                    <th>Refunds</th>
                    <th>Expected cash</th>
                    <th>Processor due</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reconciliation.map((row) => (
                    <tr key={`${row.business_day}-${row.channel_name ?? "direct"}`}>
                      <td>{formatDate(row.business_day)}</td>
                      <td>{row.channel_name ?? "Direct"}</td>
                      <td>{formatLabel(row.payment_method)}</td>
                      <td>{row.sale_count ?? 0}</td>
                      <td>{row.purchase_count ?? 0}</td>
                      <td>{row.refund_count ?? 0}</td>
                      <td>{formatCurrency(row.expected_cash_cents)}</td>
                      <td>{formatCurrency(row.processor_receivable_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No reconciliation rows yet</strong>
              <p>As finalized transactions are posted, this view turns into your daily cash and processor checkpoint.</p>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Profit snapshots</p>
              <h2>Daily rollups</h2>
            </div>
            <span className={styles.badgeMuted}>{data.snapshots.length} rows</span>
          </div>

          {data.snapshots.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Channel</th>
                    <th>Revenue</th>
                    <th>Taxes</th>
                    <th>Fees</th>
                    <th>Net profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.snapshots.map((row) => (
                    <tr key={`${row.business_day}-${row.channel_name ?? "direct"}`}>
                      <td>{formatDate(row.business_day)}</td>
                      <td>{row.channel_name ?? "Direct"}</td>
                      <td>{formatCurrency(row.gross_revenue_cents)}</td>
                      <td>{formatCurrency(row.taxes_cents)}</td>
                      <td>{formatCurrency(row.fees_cents)}</td>
                      <td>{formatCurrency(row.net_profit_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No profit rollups yet</strong>
              <p>Once you record sales and purchases, the reporting view will summarize daily profitability here.</p>
            </div>
          )}
        </article>
      </section>

      <section className={styles.reportGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Catalog detail</p>
              <h2>Items and carrying cost</h2>
            </div>
            <span className={styles.badgeMuted}>{data.items.length} items</span>
          </div>

          {data.items.length ? (
            <div className={styles.listStack}>
              {data.items.map((item) => {
                const inventoryRow = data.inventoryByItemId.get(item.id);

                return (
                  <div className={styles.listRow} key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <p>
                        {item.sku} / {item.set_name ?? "No set"} / {formatLabel(item.inventory_type)}
                      </p>
                    </div>
                    <div className={styles.listMetrics}>
                      <span>{formatQuantity(inventoryRow?.on_hand_quantity)} on hand</span>
                      <span>{formatCurrency(inventoryRow?.weighted_unit_cost_cents)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No catalog items yet</strong>
              <p>Add items from the Setup page to start tracking stock and carrying cost here.</p>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Channel setup</p>
              <h2>Taxes and fee defaults</h2>
            </div>
            <span className={styles.badgeMuted}>{data.channels.length} channels</span>
          </div>

          {data.channels.length ? (
            <div className={styles.listStack}>
              {data.channels.map((channel) => (
                <div className={styles.listRow} key={channel.id}>
                  <div>
                    <strong>{channel.name}</strong>
                    <p>
                      {formatLabel(channel.channel_type)} / {formatLabel(channel.payment_method)} /{" "}
                      {formatLabel(channel.default_tax_mode)}
                    </p>
                  </div>
                  <div className={styles.listMetrics}>
                    <span>{formatPercentFromBps(channel.default_tax_rate_bps)} tax default</span>
                    <span>{formatDate(channel.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No channels configured</strong>
              <p>Create a booth, marketplace, online, or store channel to automate default tax and fee handling.</p>
            </div>
          )}
        </article>
      </section>

      <section className={styles.reportGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Audit feed</p>
              <h2>Recent changes</h2>
            </div>
            <span className={styles.badgeMuted}>{data.auditEvents.length} events</span>
          </div>

          {data.auditEvents.length ? (
            <div className={styles.listStack}>
              {data.auditEvents.map((event) => (
                <div className={styles.alertRow} key={event.id}>
                  <strong>
                    {formatLabel(event.action)} {formatLabel(event.entity_type)}
                  </strong>
                  <p>{event.note ?? "No note recorded."}</p>
                  <small>
                    {formatDate(event.created_at)}
                    {event.reason_code ? ` / ${formatLabel(event.reason_code)}` : ""}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No audit events yet</strong>
              <p>Finalized transactions, reversals, and corrections will show up here as they happen.</p>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Integrity monitor</p>
              <h2>Alerts</h2>
            </div>
            <span className={styles.badgeMuted}>{data.alerts.length} checks</span>
          </div>

          {data.alerts.length ? (
            <div className={styles.listStack}>
              {data.alerts.map((alert) => (
                <div className={styles.alertRow} key={`${alert.entity_type}-${alert.entity_id}`}>
                  <strong>{formatLabel(alert.alert_type)}</strong>
                  <p>{alert.message}</p>
                  <small>{formatDate(alert.observed_at)}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No integrity alerts</strong>
              <p>The current ledger has no negative inventory, out-of-bounds lots, or movement mismatches.</p>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
