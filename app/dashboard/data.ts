import { redirect } from "next/navigation";

import type { Database, Json } from "@/utils/supabase/database.types";
import { createClient } from "@/utils/supabase/server";

import { dashboardNotices, type DashboardNoticeCode } from "./notices";

export type InventoryType = Database["public"]["Enums"]["inventory_type"];
export type ChannelType = Database["public"]["Enums"]["channel_type"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type TaxMode = Database["public"]["Enums"]["tax_mode"];
export type ReasonCode = Database["public"]["Enums"]["reason_code"];

export const inventoryTypeOptions: InventoryType[] = ["single", "sealed", "bundle", "lot", "service"];
export const channelTypeOptions: ChannelType[] = ["direct", "booth", "online", "marketplace", "store", "other"];
export const paymentMethodOptions: PaymentMethod[] = [
  "cash",
  "card",
  "paypal",
  "venmo",
  "zelle",
  "bank_transfer",
  "trade_credit",
  "other",
];
export const taxModeOptions: TaxMode[] = ["none", "exclusive", "inclusive"];
export const reasonCodeOptions: ReasonCode[] = [
  "inventory_count",
  "pricing_error",
  "customer_return",
  "damaged_inventory",
  "lost_inventory",
  "duplicate_entry",
  "vendor_correction",
  "void_request",
  "fraud_review",
  "other",
];

export function formatCurrency(cents: number | null | undefined) {
  const amount = (cents ?? 0) / 100;

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(amount);
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatQuantity(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return "0";
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  return Number.isInteger(numericValue) ? `${numericValue}` : numericValue.toFixed(2);
}

export function formatPercentFromBps(value: number | null | undefined) {
  return `${((value ?? 0) / 100).toFixed(2)}%`;
}

export function formatSignedPercent(value: number | null | undefined) {
  const numericValue = value ?? 0;

  if (numericValue > 0) {
    return `+${numericValue.toFixed(2)}%`;
  }

  if (numericValue < 0) {
    return `${numericValue.toFixed(2)}%`;
  }

  return "0.00%";
}

export function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function isMissingBackendObject(code: string | null | undefined) {
  return code === "42P01" || code === "PGRST205";
}

export function toDateTimeLocalValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

export function getNotice(notice: string | undefined) {
  if (!notice || !(notice in dashboardNotices)) {
    return null;
  }

  return dashboardNotices[notice as DashboardNoticeCode];
}

function parseItemMarketMetadata(metadata: Json) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    return {
      marketPriceCents: null,
      marketPriceSource: null,
      marketPriceUpdatedAt: null,
    };
  }

  const marketPriceRaw = metadata.market_price_cents;
  const marketPriceSourceRaw = metadata.market_price_source;
  const marketPriceUpdatedAtRaw = metadata.market_price_updated_at;

  return {
    marketPriceCents: typeof marketPriceRaw === "number" ? marketPriceRaw : null,
    marketPriceSource: typeof marketPriceSourceRaw === "string" ? marketPriceSourceRaw : null,
    marketPriceUpdatedAt: typeof marketPriceUpdatedAtRaw === "string" ? marketPriceUpdatedAtRaw : null,
  };
}

export async function getDashboardIdentity() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { data: vendor, error } = await supabase
    .from("vendors")
    .select("id, business_name, base_currency, timezone")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const workspaceName =
    vendor?.business_name ??
    (typeof user.user_metadata.business_name === "string" && user.user_metadata.business_name.trim()
      ? user.user_metadata.business_name.trim()
      : "My Card Shop");

  return {
    supabase,
    user,
    vendor,
    vendorError: error,
    workspaceName,
  };
}

export async function loadDashboardData(
  options?: {
    inventoryLimit?: number;
    itemLimit?: number;
    marketComparisonLimit?: number;
    transactionLimit?: number;
  },
) {
  const { supabase, user, vendor, vendorError, workspaceName } = await getDashboardIdentity();
  const itemLimit = options?.itemLimit ?? 24;
  const inventoryLimit = options?.inventoryLimit ?? 16;
  const marketComparisonLimit = options?.marketComparisonLimit ?? 16;
  const transactionLimit = options?.transactionLimit ?? 16;

  const [
    itemsResult,
    channelsResult,
    snapshotsResult,
    inventoryResult,
    transactionsResult,
    marketComparisonResult,
    alertsResult,
    reconciliationResult,
    auditEventsResult,
  ] = await Promise.all([
    supabase
      .from("items")
      .select("id, sku, name, set_name, inventory_type, rarity, condition, language, created_at, metadata_json")
      .order("created_at", { ascending: false })
      .limit(itemLimit),
    supabase
      .from("channels")
      .select("id, name, channel_type, payment_method, default_tax_mode, default_tax_rate_bps, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("v_profit_snapshot")
      .select(
        "business_day, gross_revenue_cents, fees_cents, taxes_cents, net_profit_cents, finalized_transaction_count, channel_name",
      )
      .order("business_day", { ascending: false })
      .limit(10),
    supabase
      .from("v_inventory_position")
      .select(
        "item_id, sku, name, set_name, inventory_type, on_hand_quantity, reserved_quantity, sold_quantity, lot_count, remaining_cost_cents, weighted_unit_cost_cents, last_movement_at",
      )
      .order("on_hand_quantity", { ascending: false })
      .limit(inventoryLimit),
    supabase
      .from("v_transaction_summary")
      .select(
        "transaction_id, type, effective_type, occurred_at, channel_name, counterparty_name, subtotal_cents, fee_cents, tax_cents, net_payout_cents, gross_profit_cents, status, linked_transaction_id",
      )
      .order("occurred_at", { ascending: false })
      .limit(transactionLimit),
    supabase
      .from("v_market_price_comparison")
      .select(
        "item_id, sku, name, set_name, inventory_type, market_price_cents, market_price_source, market_price_updated_at, last_sold_at, last_sold_unit_price_cents, average_sold_unit_price_cents, finalized_sale_count, sold_vs_market_cents, sold_vs_market_percent",
      )
      .order("last_sold_at", { ascending: false })
      .limit(marketComparisonLimit),
    supabase
      .from("v_integrity_alerts")
      .select("alert_type, entity_type, entity_id, message, observed_at")
      .order("observed_at", { ascending: false })
      .limit(8),
    supabase
      .from("v_reconciliation_summary")
      .select(
        "business_day, channel_name, payment_method, sale_count, purchase_count, refund_count, expected_cash_cents, processor_receivable_cents, fees_cents, taxes_cents",
      )
      .order("business_day", { ascending: false })
      .limit(10),
    supabase
      .from("audit_events")
      .select("id, action, entity_type, note, reason_code, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const backendMissing = [
    vendorError,
    itemsResult.error,
    channelsResult.error,
    snapshotsResult.error,
    inventoryResult.error,
    transactionsResult.error,
    alertsResult.error,
    reconciliationResult.error,
    auditEventsResult.error,
  ].some((error) => isMissingBackendObject(error?.code));
  const marketComparisonMissing = isMissingBackendObject(marketComparisonResult.error?.code);

  const items =
    itemsResult.data?.map((item) => ({
      ...item,
      ...parseItemMarketMetadata(item.metadata_json),
    })) ?? [];
  const channels = channelsResult.data ?? [];
  const snapshots = snapshotsResult.data ?? [];
  const inventory = inventoryResult.data ?? [];
  const transactions = transactionsResult.data ?? [];
  const marketComparisons = marketComparisonMissing ? [] : marketComparisonResult.data ?? [];
  const alerts = alertsResult.data ?? [];
  const reconciliation = reconciliationResult.data ?? [];
  const auditEvents = auditEventsResult.data ?? [];

  const overview = snapshots.reduce(
    (acc, row) => {
      acc.revenue += row.gross_revenue_cents ?? 0;
      acc.fees += row.fees_cents ?? 0;
      acc.taxes += row.taxes_cents ?? 0;
      acc.profit += row.net_profit_cents ?? 0;
      acc.transactions += row.finalized_transaction_count ?? 0;
      return acc;
    },
    { fees: 0, profit: 0, revenue: 0, taxes: 0, transactions: 0 },
  );

  const totalOnHand = inventory.reduce((sum, row) => sum + Number(row.on_hand_quantity ?? 0), 0);
  const lowStockCount = inventory.filter((row) => Number(row.on_hand_quantity ?? 0) <= 1).length;
  const expectedCash = reconciliation.reduce((sum, row) => sum + (row.expected_cash_cents ?? 0), 0);
  const reversedTransactionIds = new Set(
    transactions
      .filter((transaction) => transaction.type === "reversal" && transaction.linked_transaction_id)
      .map((transaction) => transaction.linked_transaction_id),
  );
  const reversibleTransactions = transactions.filter(
    (transaction) =>
      transaction.status === "finalized" &&
      transaction.type !== "reversal" &&
      transaction.transaction_id &&
      !reversedTransactionIds.has(transaction.transaction_id),
  );
  const inventoryByItemId = new Map(
    inventory
      .filter((row) => row.item_id)
      .map((row) => [row.item_id as string, row]),
  );

  return {
    alerts,
    auditEvents,
    backendMissing,
    channels,
    expectedCash,
    inventory,
    inventoryByItemId,
    items,
    lowStockCount,
    marketComparisonMissing,
    marketComparisons,
    overview,
    reconciliation,
    reversibleTransactions,
    snapshots,
    supabase,
    totalOnHand,
    transactions,
    user,
    vendor,
    workspaceName,
  };
}
