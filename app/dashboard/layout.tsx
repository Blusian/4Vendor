import type { ReactNode } from "react";
import Link from "next/link";

import { isSupabaseConfigured } from "@/utils/supabase/security";

import { signOutAction } from "./actions";
import { getDashboardIdentity } from "./data";
import styles from "./dashboard.module.css";
import { DashboardNavLinks } from "./nav-links";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div>
              <Link className={styles.brand} href="/">
                <span className={styles.brandMark}>4</span>
                <span>
                  <strong>4Vendor</strong>
                  <em>Ledger workspace</em>
                </span>
              </Link>
              <p className={styles.caption}>
                Supabase still needs to be connected to this deployment before the protected workspace can sign you in.
              </p>
            </div>

            <div className={styles.headerActions}>
              <Link className={styles.secondaryButton} href="/">
                Landing page
              </Link>
              <Link className={styles.primaryButton} href="/login">
                View setup notes
              </Link>
            </div>
          </header>

          {children}
        </div>
      </main>
    );
  }

  const { user, workspaceName } = await getDashboardIdentity();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link className={styles.brand} href="/">
              <span className={styles.brandMark}>4</span>
              <span>
                <strong>4Vendor</strong>
                <em>Ledger workspace</em>
              </span>
            </Link>
            <p className={styles.caption}>
              {workspaceName} / {user.email}
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link className={styles.secondaryButton} href="/">
              Landing page
            </Link>
            <form action={signOutAction}>
              <button className={styles.primaryButton} type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <nav className={styles.subnav} aria-label="Dashboard sections">
          <DashboardNavLinks />
        </nav>

        {children}
      </div>
    </main>
  );
}
