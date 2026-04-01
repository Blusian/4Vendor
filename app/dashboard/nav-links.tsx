"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./dashboard.module.css";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/setup", label: "Setup" },
  { href: "/dashboard/inventory", label: "Inventory" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/reports", label: "Reports" },
];

export function DashboardNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            className={isActive ? styles.subnavLinkActive : styles.subnavLink}
            href={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
