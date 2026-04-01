"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Database, Json } from "@/utils/supabase/database.types";
import { adjustInventory, postTransaction, reverseTransaction } from "@/utils/supabase/ledger";
import { createClient } from "@/utils/supabase/server";

import type { DashboardNoticeCode } from "./notices";

type AppSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<AppSupabaseClient["auth"]["getUser"]>>["data"]["user"]
>;
type InventoryType = Database["public"]["Enums"]["inventory_type"];
type ChannelType = Database["public"]["Enums"]["channel_type"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type TaxMode = Database["public"]["Enums"]["tax_mode"];
type ReasonCode = Database["public"]["Enums"]["reason_code"];

function redirectWithNotice(path: string, notice: DashboardNoticeCode) {
  const destination = new URLSearchParams({ notice });
  redirect(`${path}?${destination.toString()}`);
}

function revalidateDashboardViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/reports");
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function requireString(formData: FormData, key: string, label: string) {
  const value = getString(formData, key);

  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function getCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function parseMoneyToCents(value: string, label: string) {
  if (!value) {
    return 0;
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error(`${label} must be a valid dollar amount.`);
  }

  return Math.round(Number(value) * 100);
}

function parsePercentToBps(value: string, label: string) {
  if (!value) {
    return 0;
  }

  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error(`${label} must be a valid percentage.`);
  }

  return Math.round(Number(value) * 100);
}

function parseQuantity(value: string, label: string, options?: { allowNegative?: boolean; allowZero?: boolean }) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  if (!options?.allowNegative && parsed < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }

  if (!options?.allowZero && parsed === 0) {
    throw new Error(`${label} must not be zero.`);
  }

  return parsed;
}

function parseOccurredAt(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Date and time must be valid.");
  }

  return parsed.toISOString();
}

function normalizeCurrencyCode(value: string) {
  const normalized = value.trim().toUpperCase();

  if (normalized.length !== 3) {
    throw new Error("Base currency must be a three-letter code.");
  }

  return normalized;
}

function isInventoryShortageMessage(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("not enough available inventory") ||
    normalized.includes("does not have enough remaining quantity")
  );
}

function asObjectJson(value: Json | null | undefined) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {} as Record<string, Json | undefined>;
  }

  return { ...value };
}

function buildMarketPriceMetadata(marketPriceCents: number, marketPriceSource: string) {
  if (marketPriceCents <= 0 && !marketPriceSource) {
    return {};
  }

  return {
    market_price_cents: marketPriceCents > 0 ? marketPriceCents : undefined,
    market_price_source: marketPriceSource || undefined,
    market_price_updated_at: marketPriceCents > 0 ? new Date().toISOString() : undefined,
  } satisfies Record<string, Json | undefined>;
}

async function getAuthedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return { supabase, user: user as AuthenticatedUser };
}

async function getCurrentVendor(supabase: AppSupabaseClient, userId: string) {
  const { data: vendor, error } = await supabase
    .from("vendors")
    .select("id, business_name, timezone, base_currency")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return vendor;
}

async function ensureVendor(
  supabase: AppSupabaseClient,
  user: AuthenticatedUser,
  overrides?: { base_currency?: string; business_name?: string; timezone?: string },
) {
  const existingVendor = await getCurrentVendor(supabase, user.id);

  if (existingVendor) {
    return existingVendor;
  }

  const businessName =
    overrides?.business_name ||
    (typeof user.user_metadata.business_name === "string" && user.user_metadata.business_name.trim()
      ? user.user_metadata.business_name.trim()
      : "My Card Shop");

  const { data: createdVendor, error } = await supabase
    .from("vendors")
    .insert({
      base_currency: overrides?.base_currency ?? "USD",
      business_name: businessName,
      owner_user_id: user.id,
      timezone: overrides?.timezone ?? "America/Phoenix",
    })
    .select("id, business_name, timezone, base_currency")
    .single();

  if (error || !createdVendor) {
    throw new Error(error?.message ?? "Unable to create the workspace.");
  }

  return createdVendor;
}

async function ensureChannel(supabase: AppSupabaseClient, vendorId: string) {
  const { data: existingChannel } = await supabase
    .from("channels")
    .select("id, name")
    .eq("vendor_id", vendorId)
    .eq("name", "Demo card show")
    .maybeSingle();

  if (existingChannel) {
    return existingChannel;
  }

  const { data: createdChannel, error } = await supabase
    .from("channels")
    .insert({
      channel_type: "booth",
      default_tax_mode: "exclusive",
      default_tax_rate_bps: 700,
      name: "Demo card show",
      payment_method: "card",
      vendor_id: vendorId,
    })
    .select("id, name")
    .single();

  if (error || !createdChannel) {
    throw new Error(error?.message ?? "Unable to create the demo sales channel.");
  }

  return createdChannel;
}

async function ensureFeeRule(supabase: AppSupabaseClient, vendorId: string, channelId: string) {
  const { data: existingFeeRule } = await supabase
    .from("fee_rules")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("channel_id", channelId)
    .eq("label", "Card processor")
    .maybeSingle();

  if (existingFeeRule) {
    return existingFeeRule;
  }

  const { data: createdFeeRule, error } = await supabase
    .from("fee_rules")
    .insert({
      applies_to_shipping: false,
      applies_to_tax: false,
      channel_id: channelId,
      flat_fee_cents: 30,
      label: "Card processor",
      percent_bps: 275,
      priority: 1,
      processor_name: "Square",
      vendor_id: vendorId,
    })
    .select("id")
    .single();

  if (error || !createdFeeRule) {
    throw new Error(error?.message ?? "Unable to create the demo fee rule.");
  }

  return createdFeeRule;
}

async function ensureItem(
  supabase: AppSupabaseClient,
  vendorId: string,
  values: {
    marketPriceCents?: number;
    marketPriceSource?: string;
    name: string;
    rarity: string;
    set_name: string;
    sku: string;
  },
) {
  const { data: existingItem } = await supabase
    .from("items")
    .select("id, name, sku, metadata_json")
    .eq("vendor_id", vendorId)
    .eq("sku", values.sku)
    .maybeSingle();

  if (existingItem) {
    const currentMetadata = asObjectJson(existingItem.metadata_json);
    const nextMetadata = {
      ...currentMetadata,
      ...buildMarketPriceMetadata(values.marketPriceCents ?? 0, values.marketPriceSource ?? ""),
    };

    const hasMarketBenchmark =
      typeof currentMetadata.market_price_cents === "number" || typeof currentMetadata.market_price_source === "string";

    if (!hasMarketBenchmark && Object.keys(nextMetadata).length > 0) {
      await supabase
        .from("items")
        .update({
          metadata_json: nextMetadata,
        })
        .eq("id", existingItem.id);
    }

    return existingItem;
  }

  const { data: createdItem, error } = await supabase
    .from("items")
    .insert({
      inventory_type: "single",
      metadata_json: buildMarketPriceMetadata(values.marketPriceCents ?? 0, values.marketPriceSource ?? ""),
      name: values.name,
      rarity: values.rarity,
      set_name: values.set_name,
      sku: values.sku,
      vendor_id: vendorId,
    })
    .select("id, name, sku")
    .single();

  if (error || !createdItem) {
    throw new Error(error?.message ?? `Unable to create item ${values.sku}.`);
  }

  return createdItem;
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateWorkspaceAction(formData: FormData) {
  let notice: DashboardNoticeCode = "workspace-error";

  try {
    const { supabase, user } = await getAuthedContext();
    const businessName = requireString(formData, "business_name", "Business name");
    const timezone = requireString(formData, "timezone", "Timezone");
    const baseCurrency = normalizeCurrencyCode(requireString(formData, "base_currency", "Base currency"));
    const vendor = await ensureVendor(supabase, user, {
      base_currency: baseCurrency,
      business_name: businessName,
      timezone,
    });

    const { error } = await supabase
      .from("vendors")
      .update({
        base_currency: baseCurrency,
        business_name: businessName,
        timezone,
      })
      .eq("id", vendor.id);

    if (error) {
      throw new Error(error.message);
    }

    notice = "workspace-saved";
    revalidateDashboardViews();
  } catch {
    notice = "workspace-error";
  }

  redirectWithNotice("/dashboard/setup", notice);
}

export async function createItemAction(formData: FormData) {
  let notice: DashboardNoticeCode = "item-error";

  try {
    const { supabase, user } = await getAuthedContext();
    const vendor = await ensureVendor(supabase, user);
    const sku = requireString(formData, "sku", "SKU");
    const name = requireString(formData, "name", "Item name");
    const inventoryType = requireString(formData, "inventory_type", "Inventory type") as InventoryType;
    const language = getString(formData, "language") || "en";
    const marketPriceCents = parseMoneyToCents(getString(formData, "market_price"), "Market price");
    const marketPriceSource = getString(formData, "market_price_source");

    const { error } = await supabase.from("items").insert({
      condition: getString(formData, "condition") || null,
      inventory_type: inventoryType,
      language,
      metadata_json: buildMarketPriceMetadata(marketPriceCents, marketPriceSource),
      name,
      notes: getString(formData, "notes") || null,
      rarity: getString(formData, "rarity") || null,
      set_code: getString(formData, "set_code") || null,
      set_name: getString(formData, "set_name") || null,
      sku,
      vendor_id: vendor.id,
    });

    if (error) {
      notice = error.code === "23505" ? "item-exists" : "item-error";
    } else {
      notice = "item-created";
      revalidateDashboardViews();
    }
  } catch {
    notice = "item-error";
  }

  redirectWithNotice("/dashboard/inventory", notice);
}

export async function updateMarketBenchmarkAction(formData: FormData) {
  let notice: DashboardNoticeCode = "market-price-error";

  try {
    const { supabase, user } = await getAuthedContext();
    const vendor = await ensureVendor(supabase, user);
    const itemId = requireString(formData, "item_id", "Item");
    const marketPriceCents = parseMoneyToCents(requireString(formData, "market_price", "Market price"), "Market price");
    const marketPriceSource = getString(formData, "market_price_source");

    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id, metadata_json")
      .eq("vendor_id", vendor.id)
      .eq("id", itemId)
      .maybeSingle();

    if (itemError || !item) {
      throw new Error(itemError?.message ?? "Item not found.");
    }

    const metadataJson = {
      ...asObjectJson(item.metadata_json),
      ...buildMarketPriceMetadata(marketPriceCents, marketPriceSource),
    };

    const { error } = await supabase
      .from("items")
      .update({
        metadata_json: metadataJson,
      })
      .eq("id", item.id);

    if (error) {
      throw new Error(error.message);
    }

    notice = "market-price-saved";
    revalidateDashboardViews();
  } catch {
    notice = "market-price-error";
  }

  redirectWithNotice("/dashboard/setup", notice);
}

export async function createChannelAction(formData: FormData) {
  let notice: DashboardNoticeCode = "channel-error";

  try {
    const { supabase, user } = await getAuthedContext();
    const vendor = await ensureVendor(supabase, user);
    const name = requireString(formData, "name", "Channel name");
    const channelType = requireString(formData, "channel_type", "Channel type") as ChannelType;
    const paymentMethod = requireString(formData, "payment_method", "Payment method") as PaymentMethod;
    const defaultTaxMode = requireString(formData, "default_tax_mode", "Tax mode") as TaxMode;
    const defaultTaxRateBps = parsePercentToBps(getString(formData, "default_tax_rate_percent"), "Default tax rate");

    const { data: createdChannel, error } = await supabase
      .from("channels")
      .insert({
        channel_type: channelType,
        default_tax_mode: defaultTaxMode,
        default_tax_rate_bps: defaultTaxRateBps,
        name,
        payment_method: paymentMethod,
        vendor_id: vendor.id,
      })
      .select("id")
      .single();

    if (error || !createdChannel) {
      notice = error?.code === "23505" ? "channel-exists" : "channel-error";
    } else {
      const feePercentBps = parsePercentToBps(getString(formData, "fee_percent"), "Fee rate");
      const flatFeeCents = parseMoneyToCents(getString(formData, "flat_fee"), "Flat fee");
      const processorName = getString(formData, "processor_name") || null;
      const feeLabel = getString(formData, "fee_label");
      const wantsFeeRule =
        Boolean(processorName) || Boolean(feeLabel) || feePercentBps > 0 || flatFeeCents > 0;

      if (wantsFeeRule) {
        const { error: feeRuleError } = await supabase.from("fee_rules").insert({
          applies_to_shipping: getCheckbox(formData, "applies_to_shipping"),
          applies_to_tax: getCheckbox(formData, "applies_to_tax"),
          channel_id: createdChannel.id,
          flat_fee_cents: flatFeeCents,
          label: feeLabel || "Processor fee",
          percent_bps: feePercentBps,
          priority: 1,
          processor_name: processorName,
          vendor_id: vendor.id,
        });

        if (feeRuleError) {
          notice = "channel-error";
        } else {
          notice = "channel-created";
          revalidateDashboardViews();
        }
      } else {
        notice = "channel-created";
        revalidateDashboardViews();
      }
    }
  } catch {
    notice = "channel-error";
  }

  redirectWithNotice("/dashboard/setup", notice);
}

export async function recordPurchaseAction(formData: FormData) {
  let notice: DashboardNoticeCode = "purchase-error";

  try {
    const { supabase, user } = await getAuthedContext();
    await ensureVendor(supabase, user);

    const itemId = requireString(formData, "item_id", "Item");
    const quantity = parseQuantity(requireString(formData, "quantity", "Quantity"), "Quantity");
    const unitCostCents = parseMoneyToCents(requireString(formData, "unit_cost", "Unit cost"), "Unit cost");
    const occurredAt = parseOccurredAt(getString(formData, "occurred_at"));

    const result = await postTransaction(supabase, {
      calculation_snapshot_json: {
        source: "dashboard_purchase_form",
      },
      lines: [
        {
          description: getString(formData, "description") || "Purchase intake",
          direction: "inbound",
          item_id: itemId,
          line_key: "purchase-line",
          quantity,
          unit_cost_cents: unitCostCents,
          unit_price_cents: unitCostCents,
        },
      ],
      transaction: {
        counterparty_name: getString(formData, "counterparty_name") || "Vendor intake",
        counterparty_type: "vendor",
        notes: getString(formData, "notes") || null,
        occurred_at: occurredAt,
        status: "finalized",
        type: "purchase",
      },
    });

    if (result.error) {
      notice = "purchase-error";
    } else {
      notice = "purchase-recorded";
      revalidateDashboardViews();
    }
  } catch {
    notice = "purchase-error";
  }

  redirectWithNotice("/dashboard/transactions", notice);
}

export async function recordSaleAction(formData: FormData) {
  let notice: DashboardNoticeCode = "sale-error";

  try {
    const { supabase, user } = await getAuthedContext();
    await ensureVendor(supabase, user);

    const itemId = requireString(formData, "item_id", "Item");
    const quantity = parseQuantity(requireString(formData, "quantity", "Quantity"), "Quantity");
    const unitPriceCents = parseMoneyToCents(requireString(formData, "unit_price", "Unit price"), "Unit price");
    const occurredAt = parseOccurredAt(getString(formData, "occurred_at"));
    const channelId = getString(formData, "channel_id") || null;

    const result = await postTransaction(supabase, {
      calculation_snapshot_json: {
        source: "dashboard_sale_form",
      },
      lines: [
        {
          description: getString(formData, "description") || "Sale",
          direction: "outbound",
          item_id: itemId,
          line_key: "sale-line",
          quantity,
          unit_price_cents: unitPriceCents,
        },
      ],
      transaction: {
        channel_id: channelId,
        counterparty_name: getString(formData, "counterparty_name") || "Customer",
        counterparty_type: "customer",
        notes: getString(formData, "notes") || null,
        occurred_at: occurredAt,
        status: "finalized",
        type: "sale",
      },
    });

    if (result.error) {
      notice = isInventoryShortageMessage(result.error.message) ? "inventory-shortage" : "sale-error";
    } else {
      notice = "sale-recorded";
      revalidateDashboardViews();
    }
  } catch {
    notice = "sale-error";
  }

  redirectWithNotice("/dashboard/inventory", notice);
}

export async function recordAdjustmentAction(formData: FormData) {
  let notice: DashboardNoticeCode = "adjustment-error";

  try {
    const { supabase, user } = await getAuthedContext();
    await ensureVendor(supabase, user);

    const itemId = requireString(formData, "item_id", "Item");
    const quantityDelta = parseQuantity(
      requireString(formData, "quantity_delta", "Quantity delta"),
      "Quantity delta",
      { allowNegative: true },
    );
    const unitCostCents = parseMoneyToCents(getString(formData, "unit_cost"), "Unit cost");
    const occurredAt = parseOccurredAt(getString(formData, "occurred_at"));
    const reasonCode = requireString(formData, "reason_code", "Reason code") as ReasonCode;

    const result = await adjustInventory(supabase, {
      adjustments: [
        {
          description: getString(formData, "description") || "Inventory adjustment",
          item_id: itemId,
          line_key: "adjustment-line",
          quantity_delta: quantityDelta,
          unit_cost_cents: unitCostCents,
          unit_price_cents: unitCostCents,
        },
      ],
      calculation_snapshot_json: {
        source: "dashboard_adjustment_form",
      },
      transaction: {
        counterparty_name: "Manual adjustment",
        counterparty_type: "system",
        notes: getString(formData, "notes") || null,
        occurred_at: occurredAt,
        reason_code: reasonCode,
        status: "finalized",
      },
    });

    if (result.error) {
      notice = isInventoryShortageMessage(result.error.message) ? "inventory-shortage" : "adjustment-error";
    } else {
      notice = "adjustment-recorded";
      revalidateDashboardViews();
    }
  } catch {
    notice = "adjustment-error";
  }

  redirectWithNotice("/dashboard/inventory", notice);
}

export async function reverseTransactionAction(formData: FormData) {
  let notice: DashboardNoticeCode = "reversal-error";

  try {
    const { supabase, user } = await getAuthedContext();
    await ensureVendor(supabase, user);

    const transactionId = requireString(formData, "transaction_id", "Transaction");
    const reasonCode = requireString(formData, "reason_code", "Reason code") as ReasonCode;
    const result = await reverseTransaction(supabase, {
      note: getString(formData, "note") || null,
      reason_code: reasonCode,
      transaction_id: transactionId,
    });

    if (result.error) {
      notice = result.error.message.toLowerCase().includes("already been reversed")
        ? "reversal-exists"
        : "reversal-error";
    } else {
      notice = "transaction-reversed";
      revalidateDashboardViews();
    }
  } catch {
    notice = "reversal-error";
  }

  redirectWithNotice("/dashboard/transactions", notice);
}

export async function seedDemoWorkspace() {
  let notice: DashboardNoticeCode = "demo-error";

  try {
    const { supabase, user } = await getAuthedContext();
    const vendor = await ensureVendor(supabase, user);

    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendor.id)
      .eq("status", "finalized");

    if ((count ?? 0) === 0) {
      const demoChannel = await ensureChannel(supabase, vendor.id);
      await ensureFeeRule(supabase, vendor.id, demoChannel.id);

      const umbreon = await ensureItem(supabase, vendor.id, {
        marketPriceCents: 4895,
        marketPriceSource: "TCGplayer market",
        name: "Umbreon VMAX Alt Art",
        rarity: "Alt Art",
        set_name: "Evolving Skies",
        sku: "PKM-UMB-VMAX-AA",
      });

      const wemby = await ensureItem(supabase, vendor.id, {
        marketPriceCents: 3850,
        marketPriceSource: "Recent comps",
        name: "Victor Wembanyama Prizm RC",
        rarity: "Silver Prizm",
        set_name: "Prizm Basketball",
        sku: "SPT-WEMB-PRIZM-RC",
      });

      const intakeAt = new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString();
      const saleAt = new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString();

      const purchaseResult = await postTransaction(supabase, {
        calculation_snapshot_json: {
          scenario: "collection_intake",
          seeded: true,
          source: "dashboard_demo_seed",
        },
        lines: [
          {
            description: "Umbreon intake",
            direction: "inbound",
            item_id: umbreon.id,
            line_key: "umbreon-intake",
            quantity: 2,
            unit_cost_cents: 1860,
            unit_price_cents: 1860,
          },
          {
            description: "Wembanyama intake",
            direction: "inbound",
            item_id: wemby.id,
            line_key: "wemby-intake",
            quantity: 3,
            unit_cost_cents: 1425,
            unit_price_cents: 1425,
          },
        ],
        transaction: {
          counterparty_name: "Weekend collection buy",
          notes: "Seeded demo intake for the dashboard.",
          occurred_at: intakeAt,
          status: "finalized",
          type: "purchase",
        },
      });

      if (purchaseResult.error) {
        throw new Error(purchaseResult.error.message);
      }

      const saleResult = await postTransaction(supabase, {
        calculation_snapshot_json: {
          scenario: "booth_sale",
          seeded: true,
          source: "dashboard_demo_seed",
        },
        lines: [
          {
            description: "Umbreon VMAX sold at show",
            direction: "outbound",
            item_id: umbreon.id,
            line_key: "umbreon-sale",
            quantity: 1,
            unit_price_cents: 4400,
          },
        ],
        transaction: {
          channel_id: demoChannel.id,
          counterparty_name: "Card show customer",
          notes: "Seeded booth sale for the dashboard.",
          occurred_at: saleAt,
          status: "finalized",
          type: "sale",
        },
      });

      if (saleResult.error) {
        throw new Error(saleResult.error.message);
      }
    }

    notice = "demo-loaded";
    revalidateDashboardViews();
  } catch {
    notice = "demo-error";
  }

  redirectWithNotice("/dashboard", notice);
}
