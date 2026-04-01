import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/utils/supabase/database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;
export type ReasonCode = Database["public"]["Enums"]["reason_code"];
export type TransactionType = Database["public"]["Enums"]["transaction_type"];
export type LineDirection = Database["public"]["Enums"]["line_direction"];
export type LineKind = Database["public"]["Enums"]["line_kind"];
export type FeeType = Database["public"]["Enums"]["fee_type"];

export type LotAllocationInput = {
  allocation_order?: number;
  lot_id: string;
  quantity: number;
  unit_cost_cents?: number;
};

export type PostTransactionLineInput = {
  description?: string | null;
  direction: LineDirection;
  discount_cents?: number;
  extended_total_cents?: number;
  item_id?: string | null;
  line_key?: string;
  line_kind?: LineKind;
  line_subtotal_cents?: number;
  lot_allocations?: LotAllocationInput[];
  parent_line_key?: string;
  quantity: number;
  restore_lot_allocations?: LotAllocationInput[];
  tax_cents?: number;
  taxable_base_cents?: number;
  unit_cost_cents?: number;
  unit_price_cents?: number;
};

export type PostTransactionFeeLineInput = {
  basis_cents?: number;
  computed_fee_cents?: number;
  fee_rule_id?: string | null;
  fee_type: FeeType;
  flat_fee_cents?: number;
  label: string;
  rate_bps?: number;
};

export type PostTransactionTaxLineInput = {
  included_in_price?: boolean;
  jurisdiction?: string | null;
  label: string;
  rate_bps?: number;
  tax_cents?: number;
  taxable_base_cents?: number;
};

export type PostTransactionInput = {
  calculation_snapshot_json?: Json;
  fee_lines?: PostTransactionFeeLineInput[];
  lines: PostTransactionLineInput[];
  tax_lines?: PostTransactionTaxLineInput[];
  transaction: {
    cash_in_cents?: number;
    cash_out_cents?: number;
    channel_id?: string | null;
    counterparty_name?: string | null;
    counterparty_type?: string | null;
    discount_cents?: number;
    id?: string;
    linked_transaction_id?: string | null;
    notes?: string | null;
    occurred_at?: string;
    reason_code?: ReasonCode | null;
    status?: Database["public"]["Enums"]["transaction_status"];
    subtotal_cents?: number;
    tax_cents?: number;
    fee_cents?: number;
    other_fee_cents?: number;
    net_sale_cents?: number;
    net_payout_cents?: number;
    cost_basis_cents?: number;
    gross_profit_cents?: number;
    type: TransactionType;
  };
};

export type InventoryAdjustmentInput = {
  calculation_snapshot_json?: Json;
  adjustments: Array<{
    description?: string | null;
    item_id: string;
    line_key?: string;
    line_kind?: LineKind;
    lot_allocations?: LotAllocationInput[];
    quantity_delta: number;
    restore_lot_allocations?: LotAllocationInput[];
    unit_cost_cents?: number;
    unit_price_cents?: number;
  }>;
  transaction?: Omit<PostTransactionInput["transaction"], "type">;
};

type RpcInvoker = {
  rpc: (fn: string, args?: Record<string, unknown>) => ReturnType<TypedSupabaseClient["rpc"]>;
};

function asJson(value: unknown): Json {
  return value as Json;
}

export async function postTransaction(client: TypedSupabaseClient, payload: PostTransactionInput) {
  return (client as unknown as RpcInvoker).rpc("post_transaction", { payload: asJson(payload) });
}

export async function adjustInventory(client: TypedSupabaseClient, payload: InventoryAdjustmentInput) {
  return (client as unknown as RpcInvoker).rpc("adjust_inventory", { payload: asJson(payload) });
}

export async function reverseTransaction(
  client: TypedSupabaseClient,
  input: { note?: string | null; reason_code: ReasonCode; transaction_id: string },
) {
  return (client as unknown as RpcInvoker).rpc("reverse_transaction", input);
}
