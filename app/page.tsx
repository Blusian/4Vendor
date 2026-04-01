import Link from "next/link";

import styles from "./home.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandMark}>4</span>
            <span className={styles.brandCopy}>
              <strong>4Vendor</strong>
              <span>Ledger-grade TCG operations</span>
            </span>
          </Link>

          <div className={styles.headerActions}>
            <Link className={styles.buttonSecondary} href="/login">
              Log in
            </Link>
            <Link className={styles.buttonPrimary} href="/dashboard">
              Open dashboard
            </Link>
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Ledger-grade clarity for cards and collectibles</p>
            <h1>Track every sale, fee, and inventory change without the chaos.</h1>
            <p className={styles.lede}>
              4Vendor gives TCG vendors one calm workspace for transactions, inventory, fees, taxes,
              cost basis, profit, and reporting, so the answer on screen is the answer you can trust.
            </p>

            <div className={styles.heroActions}>
              <Link className={styles.buttonPrimary} href="/dashboard">
                Go to dashboard
              </Link>
              <Link className={styles.buttonSecondary} href="/login">
                Sign in
              </Link>
            </div>
          </div>

          <aside className={styles.heroPanel}>
            <div className={styles.panelHeader}>
              <span>Live workflow</span>
              <h2>Simple on the surface. Structured underneath.</h2>
              <p>
                Record the event, let the ledger post it, and review clean numbers without chasing them
                across spreadsheets.
              </p>
            </div>

            <div className={styles.statRow}>
              <article className={styles.statCard}>
                <span>Transactions</span>
                <strong>Sales / buys / corrections</strong>
                <small>Posted into one backend workflow</small>
              </article>
              <article className={styles.statCard}>
                <span>Inventory</span>
                <strong>Lots and cost basis</strong>
                <small>Stock movement tied to the transaction</small>
              </article>
              <article className={styles.statCard}>
                <span>Reporting</span>
                <strong>Profit and reconciliation</strong>
                <small>Read from the same ledger you operate</small>
              </article>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
