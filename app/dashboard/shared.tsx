import styles from "./dashboard.module.css";

import { getNotice } from "./data";

export function DashboardNoticeBanner({ notice }: { notice?: string }) {
  const resolvedNotice = getNotice(notice);

  if (!resolvedNotice) {
    return null;
  }

  return (
    <section className={resolvedNotice.tone === "success" ? styles.noticeSuccess : styles.noticeError}>
      <div>
        <p className={styles.noticeTitle}>{resolvedNotice.title}</p>
        <p className={styles.noticeText}>{resolvedNotice.description}</p>
      </div>
    </section>
  );
}

export function BackendSetupCard() {
  return (
    <section className={styles.setupCard}>
      <p className={styles.kicker}>Backend setup required</p>
      <h1>The app shell is ready, but this Supabase project is missing the ledger schema.</h1>
      <p>
        Apply the migrations in <code className={styles.inlineCode}>supabase/migrations</code> so the
        dashboard can read tables, reporting views, RPCs, and security policies.
      </p>
      <div className={styles.helperList}>
        <span>Creates the vendor, item, channel, and ledger tables</span>
        <span>Enables the reporting views that power reconciliation and profit snapshots</span>
        <span>Turns on the policies and RPCs used by the forms on this page</span>
      </div>
    </section>
  );
}

export function DashboardPageIntro({
  eyebrow,
  text,
  title,
}: {
  eyebrow: string;
  text: string;
  title: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.panelLabel}>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <p className={styles.sectionText}>{text}</p>
    </div>
  );
}
