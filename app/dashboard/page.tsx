import type { Metadata } from "next";

import { formatCurrency, formatDate, formatLabel, formatQuantity, loadDashboardData } from "./data";
import styles from "./dashboard.module.css";
import { BackendSetupCard, DashboardNoticeBanner, DashboardPageIntro } from "./shared";

export const metadata: Metadata = {
  title: "Dashboard Overview | 4Vendor",
  description: "High-level view of sales, inventory, cash expectations, and recent ledger activity.",
};

export default async function DashboardOverviewPage({
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

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Overview</p>
          <h1>Keep the big picture clear without opening every tool at once.</h1>
          <p>
            This page is the quick read on the business. Use the other sections when you want to post
            transactions, edit setup, or dive into reporting.
          </p>
        </div>

        <div className={styles.statGrid}>
          <article className={styles.statCard}>
            <span>Gross revenue</span>
            <strong>{formatCurrency(data.overview.revenue)}</strong>
            <small>{data.overview.transactions} finalized transactions</small>
          </article>
          <article className={styles.statCard}>
            <span>Net profit</span>
            <strong>{formatCurrency(data.overview.profit)}</strong>
            <small>{formatCurrency(data.overview.fees)} in total fees</small>
          </article>
          <article className={styles.statCard}>
            <span>On-hand units</span>
            <strong>{formatQuantity(data.totalOnHand)}</strong>
            <small>{data.lowStockCount} items at or below one unit</small>
          </article>
          <article className={styles.statCard}>
            <span>Expected cash</span>
            <strong>{formatCurrency(data.expectedCash)}</strong>
            <small>{data.channels.length} channels configured</small>
          </article>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Recent activity</p>
              <h2>Latest transactions</h2>
            </div>
            <span className={styles.badge}>{data.transactions.length} recent rows</span>
          </div>

          {data.transactions.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Channel</th>
                    <th>Gross</th>
                    <th>Fees</th>
                    <th>Net</th>
                    <th>Profit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((transaction) => (
                    <tr key={transaction.transaction_id}>
                      <td>{formatDate(transaction.occurred_at)}</td>
                      <td>{formatLabel(transaction.type ?? transaction.effective_type)}</td>
                      <td>{transaction.channel_name ?? transaction.counterparty_name ?? "Direct"}</td>
                      <td>{formatCurrency(transaction.subtotal_cents)}</td>
                      <td>{formatCurrency(transaction.fee_cents)}</td>
                      <td>{formatCurrency(transaction.net_payout_cents)}</td>
                      <td>{formatCurrency(transaction.gross_profit_cents)}</td>
                      <td>{formatLabel(transaction.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No transactions yet</strong>
              <p>Use the Transactions page to record purchases, sales, adjustments, and reversals.</p>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Inventory position</p>
              <h2>Top on-hand items</h2>
            </div>
            <span className={styles.badgeMuted}>{data.inventory.length} tracked items</span>
          </div>

          {data.inventory.length ? (
            <div className={styles.listStack}>
              {data.inventory.map((item) => (
                <div className={styles.listRow} key={item.item_id}>
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {item.sku} / {item.set_name ?? "No set"} / {formatLabel(item.inventory_type)}
                    </p>
                  </div>
                  <div className={styles.listMetrics}>
                    <span>{formatQuantity(item.on_hand_quantity)} on hand</span>
                    <span>{item.lot_count ?? 0} lots</span>
                    <span>{formatCurrency(item.remaining_cost_cents)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No inventory yet</strong>
              <p>Record a purchase or load demo data to create FIFO lots and inventory movement history.</p>
            </div>
          )}
        </article>
      </section>

      <section className={styles.reportGrid}>
        <article className={styles.panel}>
          <DashboardPageIntro
            eyebrow="Reporting"
            title="Recent daily rollups"
            text="This keeps the high-level reporting visible without forcing you into the full reports view."
          />

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
              <p>Once you post sales and purchases, this page will show the recent daily summary automatically.</p>
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
