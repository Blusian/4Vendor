import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign In | 4Vendor",
  description: "Sign in to your 4Vendor workspace or create a new ledger-grade vendor account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.pitch}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandMark}>4</span>
            <span>
              <strong>4Vendor</strong>
              <em>Ledger-grade TCG operations</em>
            </span>
          </Link>

          <div className={styles.pitchCard}>
            <p className={styles.kicker}>Trusted numbers start here</p>
            <h1>Sign in to the workspace that ties your cards, cash, and corrections together.</h1>
            <p>
              The backend now tracks vendors, channels, fee rules, transaction posting, FIFO lots,
              audit events, reconciliation views, and integrity checks. This login flow gets you into
              the part of the app where those numbers can actually show up.
            </p>
            <ul className={styles.featureList}>
              <li>Protected dashboard backed by Supabase views</li>
              <li>Email/password auth with workspace creation on sign-up</li>
              <li>Demo ledger seeding once you&apos;re inside</li>
            </ul>
          </div>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.formCard}>
            <div className={styles.formIntro}>
              <p className={styles.kicker}>Account access</p>
              <h2>Sign in or create your shop workspace</h2>
              <p>
                New accounts can include a business name so the backend can create the vendor record
                immediately.
              </p>
            </div>
            <LoginForm initialStatus={params.auth ?? null} />
          </div>
        </section>
      </div>
    </main>
  );
}
