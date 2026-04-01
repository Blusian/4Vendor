import type { Metadata } from "next";

import {
  recordSaleAction,
  reverseTransactionAction,
} from "../actions";
import {
  formatCurrency,
  formatDate,
  formatLabel,
  loadDashboardData,
  reasonCodeOptions,
  toDateTimeLocalValue,
} from "../data";
import styles from "../dashboard.module.css";
import { BackendSetupCard, DashboardNoticeBanner, DashboardPageIntro } from "../shared";

export const metadata: Metadata = {
  title: "Dashboard Transactions | 4Vendor",
  description: "Record sales and transaction reversals.",
};

export default async function DashboardTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const params = await searchParams;
  const data = await loadDashboardData();
  const defaultOccurredAt = toDateTimeLocalValue();
  const activeItems = data.items.filter((item) => item.is_active && item.current_status === "active");

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
          eyebrow="Transactions"
          title="Post day-to-day ledger activity without burying it in one giant screen."
          text="This page now focuses on outbound activity and ledger corrections. Inventory intake and stock adjustments live on the Inventory page."
        />

        <div className={styles.operationsGrid}>
          <article className={styles.panel} id="sales">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Outbound sale</p>
                <h2>Record a sale</h2>
              </div>
              <span className={styles.badge}>FIFO cost basis</span>
            </div>
            <form action={recordSaleAction} className={styles.formStack}>
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
                  <span>Unit price ($)</span>
                  <input name="unit_price" type="number" step="0.01" min="0" placeholder="44.00" disabled={!activeItems.length} required />
                </label>
                <label className={styles.field}>
                  <span>Channel</span>
                  <select name="channel_id" disabled={!activeItems.length}>
                    <option value="">Direct / no channel</option>
                    {data.channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Date and time</span>
                  <input name="occurred_at" type="datetime-local" defaultValue={defaultOccurredAt} disabled={!activeItems.length} />
                </label>
                <label className={styles.field}>
                  <span>Counterparty</span>
                  <input name="counterparty_name" placeholder="Walk-up customer" disabled={!activeItems.length} />
                </label>
                <label className={styles.field}>
                  <span>Description</span>
                  <input name="description" placeholder="Sale" disabled={!activeItems.length} />
                </label>
              </div>
              <label className={styles.field}>
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Optional customer or sale note." disabled={!activeItems.length} />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={!activeItems.length}>
                Record sale
              </button>
            </form>
          </article>

          <article className={styles.panel} id="reversals">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Reversal</p>
                <h2>Reverse a finalized transaction</h2>
              </div>
              <span className={styles.badgeMuted}>{data.reversibleTransactions.length} reversible</span>
            </div>
            <form action={reverseTransactionAction} className={styles.formStack}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Transaction</span>
                  <select name="transaction_id" disabled={!data.reversibleTransactions.length} required>
                    <option value="">
                      {data.reversibleTransactions.length ? "Select a transaction" : "No reversible transactions yet"}
                    </option>
                    {data.reversibleTransactions.map((transaction) => (
                      <option key={transaction.transaction_id} value={transaction.transaction_id ?? ""}>
                        {formatLabel(transaction.type ?? transaction.effective_type ?? "transaction")} /{" "}
                        {formatDate(transaction.occurred_at)} / {formatCurrency(transaction.subtotal_cents)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Reason code</span>
                  <select name="reason_code" defaultValue="vendor_correction" disabled={!data.reversibleTransactions.length}>
                    {reasonCodeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={styles.field}>
                <span>Note</span>
                <textarea name="note" rows={3} placeholder="Why this reversal is needed." disabled={!data.reversibleTransactions.length} />
              </label>
              <button className={styles.primaryButton} type="submit" disabled={!data.reversibleTransactions.length}>
                Reverse transaction
              </button>
            </form>
          </article>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Recent ledger entries</p>
              <h2>Transactions</h2>
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
              <p>Use the forms above or the demo loader to start writing ledger activity.</p>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Inventory snapshot</p>
              <h2>Stock impact</h2>
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
                    <span>{item.on_hand_quantity ?? 0} on hand</span>
                    <span>{formatCurrency(item.remaining_cost_cents)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No stock impact yet</strong>
              <p>Purchases and adjustments will create lots and movement history automatically.</p>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
