export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_user_id: string | null;
          after_snapshot_json: Json;
          before_snapshot_json: Json;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          note: string | null;
          reason_code: Database["public"]["Enums"]["reason_code"] | null;
          vendor_id: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_user_id?: string | null;
          after_snapshot_json?: Json;
          before_snapshot_json?: Json;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          note?: string | null;
          reason_code?: Database["public"]["Enums"]["reason_code"] | null;
          vendor_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_events"]["Insert"]>;
        Relationships: [];
      };
      channels: {
        Row: {
          channel_type: Database["public"]["Enums"]["channel_type"];
          created_at: string;
          default_tax_mode: Database["public"]["Enums"]["tax_mode"];
          default_tax_rate_bps: number;
          id: string;
          is_active: boolean;
          name: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          channel_type?: Database["public"]["Enums"]["channel_type"];
          created_at?: string;
          default_tax_mode?: Database["public"]["Enums"]["tax_mode"];
          default_tax_rate_bps?: number;
          id?: string;
          is_active?: boolean;
          name: string;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          updated_at?: string;
          vendor_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["channels"]["Insert"]>;
        Relationships: [];
      };
      fee_rules: {
        Row: {
          active_from: string | null;
          active_to: string | null;
          applies_to_shipping: boolean;
          applies_to_tax: boolean;
          channel_id: string;
          created_at: string;
          flat_fee_cents: number;
          id: string;
          label: string;
          percent_bps: number;
          priority: number;
          processor_name: string | null;
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          active_from?: string | null;
          active_to?: string | null;
          applies_to_shipping?: boolean;
          applies_to_tax?: boolean;
          channel_id: string;
          created_at?: string;
          flat_fee_cents?: number;
          id?: string;
          label: string;
          percent_bps?: number;
          priority?: number;
          processor_name?: string | null;
          updated_at?: string;
          vendor_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["fee_rules"]["Insert"]>;
        Relationships: [];
      };
      inventory_lots: {
        Row: {
          acquired_at: string;
          acquisition_source: string | null;
          created_at: string;
          id: string;
          item_id: string;
          notes: string | null;
          original_quantity: number;
          remaining_quantity: number;
          source_line_id: string | null;
          source_transaction_id: string | null;
          unit_cost_cents: number;
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          acquired_at?: string;
          acquisition_source?: string | null;
          created_at?: string;
          id?: string;
          item_id: string;
          notes?: string | null;
          original_quantity: number;
          remaining_quantity: number;
          source_line_id?: string | null;
          source_transaction_id?: string | null;
          unit_cost_cents?: number;
          updated_at?: string;
          vendor_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_lots"]["Insert"]>;
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          bucket: Database["public"]["Enums"]["inventory_bucket"];
          cost_delta_cents: number;
          created_at: string;
          id: string;
          item_id: string;
          lot_id: string | null;
          movement_type: Database["public"]["Enums"]["movement_type"];
          occurred_at: string;
          quantity_delta: number;
          transaction_id: string;
          transaction_line_id: string | null;
          vendor_id: string;
        };
        Insert: {
          bucket?: Database["public"]["Enums"]["inventory_bucket"];
          cost_delta_cents?: number;
          created_at?: string;
          id?: string;
          item_id: string;
          lot_id?: string | null;
          movement_type: Database["public"]["Enums"]["movement_type"];
          occurred_at?: string;
          quantity_delta: number;
          transaction_id: string;
          transaction_line_id?: string | null;
          vendor_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_movements"]["Insert"]>;
        Relationships: [];
      };
      items: {
        Row: {
          condition: string | null;
          created_at: string;
          current_status: Database["public"]["Enums"]["item_status"];
          id: string;
          inventory_type: Database["public"]["Enums"]["inventory_type"];
          is_active: boolean;
          language: string | null;
          metadata_json: Json;
          name: string;
          notes: string | null;
          rarity: string | null;
          set_code: string | null;
          set_name: string | null;
          sku: string;
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          condition?: string | null;
          created_at?: string;
          current_status?: Database["public"]["Enums"]["item_status"];
          id?: string;
          inventory_type?: Database["public"]["Enums"]["inventory_type"];
          is_active?: boolean;
          language?: string | null;
          metadata_json?: Json;
          name: string;
          notes?: string | null;
          rarity?: string | null;
          set_code?: string | null;
          set_name?: string | null;
          sku: string;
          updated_at?: string;
          vendor_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["items"]["Insert"]>;
        Relationships: [];
      };
      lot_allocations: {
        Row: {
          allocation_order: number;
          created_at: string;
          extended_cost_cents: number;
          id: string;
          lot_id: string;
          quantity_allocated: number;
          transaction_line_id: string;
          unit_cost_cents: number;
        };
        Insert: {
          allocation_order?: number;
          created_at?: string;
          extended_cost_cents?: number;
          id?: string;
          lot_id: string;
          quantity_allocated: number;
          transaction_line_id: string;
          unit_cost_cents?: number;
        };
        Update: Partial<Database["public"]["Tables"]["lot_allocations"]["Insert"]>;
        Relationships: [];
      };
      transaction_fee_lines: {
        Row: {
          basis_cents: number;
          computed_fee_cents: number;
          created_at: string;
          fee_rule_id: string | null;
          fee_type: Database["public"]["Enums"]["fee_type"];
          flat_fee_cents: number;
          id: string;
          label: string;
          rate_bps: number;
          transaction_id: string;
        };
        Insert: {
          basis_cents?: number;
          computed_fee_cents?: number;
          created_at?: string;
          fee_rule_id?: string | null;
          fee_type: Database["public"]["Enums"]["fee_type"];
          flat_fee_cents?: number;
          id?: string;
          label: string;
          rate_bps?: number;
          transaction_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["transaction_fee_lines"]["Insert"]>;
        Relationships: [];
      };
      transaction_lines: {
        Row: {
          created_at: string;
          description: string | null;
          direction: Database["public"]["Enums"]["line_direction"];
          discount_cents: number;
          extended_total_cents: number;
          id: string;
          item_id: string | null;
          line_kind: Database["public"]["Enums"]["line_kind"];
          line_subtotal_cents: number;
          parent_line_id: string | null;
          quantity: number;
          tax_cents: number;
          taxable_base_cents: number;
          transaction_id: string;
          unit_price_cents: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          direction: Database["public"]["Enums"]["line_direction"];
          discount_cents?: number;
          extended_total_cents?: number;
          id?: string;
          item_id?: string | null;
          line_kind?: Database["public"]["Enums"]["line_kind"];
          line_subtotal_cents?: number;
          parent_line_id?: string | null;
          quantity: number;
          tax_cents?: number;
          taxable_base_cents?: number;
          transaction_id: string;
          unit_price_cents?: number;
        };
        Update: Partial<Database["public"]["Tables"]["transaction_lines"]["Insert"]>;
        Relationships: [];
      };
      transaction_tax_lines: {
        Row: {
          created_at: string;
          id: string;
          included_in_price: boolean;
          jurisdiction: string | null;
          label: string;
          rate_bps: number;
          tax_cents: number;
          taxable_base_cents: number;
          transaction_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          included_in_price?: boolean;
          jurisdiction?: string | null;
          label: string;
          rate_bps?: number;
          tax_cents?: number;
          taxable_base_cents?: number;
          transaction_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["transaction_tax_lines"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          calculation_snapshot_json: Json;
          cash_in_cents: number;
          cash_out_cents: number;
          channel_id: string | null;
          cost_basis_cents: number;
          counterparty_name: string | null;
          counterparty_type: string | null;
          created_at: string;
          created_by: string;
          discount_cents: number;
          fee_cents: number;
          finalized_at: string | null;
          gross_profit_cents: number;
          id: string;
          linked_transaction_id: string | null;
          net_payout_cents: number;
          net_sale_cents: number;
          notes: string | null;
          occurred_at: string;
          other_fee_cents: number;
          reason_code: Database["public"]["Enums"]["reason_code"] | null;
          status: Database["public"]["Enums"]["transaction_status"];
          subtotal_cents: number;
          tax_cents: number;
          type: Database["public"]["Enums"]["transaction_type"];
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          calculation_snapshot_json?: Json;
          cash_in_cents?: number;
          cash_out_cents?: number;
          channel_id?: string | null;
          cost_basis_cents?: number;
          counterparty_name?: string | null;
          counterparty_type?: string | null;
          created_at?: string;
          created_by: string;
          discount_cents?: number;
          fee_cents?: number;
          finalized_at?: string | null;
          gross_profit_cents?: number;
          id?: string;
          linked_transaction_id?: string | null;
          net_payout_cents?: number;
          net_sale_cents?: number;
          notes?: string | null;
          occurred_at?: string;
          other_fee_cents?: number;
          reason_code?: Database["public"]["Enums"]["reason_code"] | null;
          status?: Database["public"]["Enums"]["transaction_status"];
          subtotal_cents?: number;
          tax_cents?: number;
          type: Database["public"]["Enums"]["transaction_type"];
          updated_at?: string;
          vendor_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };
      vendors: {
        Row: {
          base_currency: string;
          business_name: string;
          created_at: string;
          id: string;
          owner_user_id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          base_currency?: string;
          business_name: string;
          created_at?: string;
          id?: string;
          owner_user_id: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vendors"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      v_integrity_alerts: {
        Row: {
          alert_type: string | null;
          entity_id: string | null;
          entity_type: string | null;
          message: string | null;
          observed_at: string | null;
          vendor_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      v_inventory_position: {
        Row: {
          condition: string | null;
          inventory_type: Database["public"]["Enums"]["inventory_type"] | null;
          item_id: string | null;
          language: string | null;
          last_movement_at: string | null;
          lot_count: number | null;
          name: string | null;
          on_hand_quantity: number | null;
          rarity: string | null;
          remaining_cost_cents: number | null;
          reserved_quantity: number | null;
          set_code: string | null;
          set_name: string | null;
          sku: string | null;
          sold_quantity: number | null;
          vendor_id: string | null;
          weighted_unit_cost_cents: number | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      v_market_price_comparison: {
        Row: {
          average_sold_unit_price_cents: number | null;
          finalized_sale_count: number | null;
          inventory_type: Database["public"]["Enums"]["inventory_type"] | null;
          item_id: string | null;
          last_sold_at: string | null;
          last_sold_unit_price_cents: number | null;
          market_price_cents: number | null;
          market_price_source: string | null;
          market_price_updated_at: string | null;
          name: string | null;
          set_name: string | null;
          sku: string | null;
          sold_vs_market_cents: number | null;
          sold_vs_market_percent: number | null;
          vendor_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      v_profit_snapshot: {
        Row: {
          business_day: string | null;
          channel_id: string | null;
          channel_name: string | null;
          cost_basis_cents: number | null;
          fees_cents: number | null;
          finalized_transaction_count: number | null;
          gross_revenue_cents: number | null;
          net_profit_cents: number | null;
          taxes_cents: number | null;
          vendor_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      v_reconciliation_summary: {
        Row: {
          business_day: string | null;
          channel_id: string | null;
          channel_name: string | null;
          channel_type: Database["public"]["Enums"]["channel_type"] | null;
          expected_cash_cents: number | null;
          fees_cents: number | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          processor_receivable_cents: number | null;
          purchase_count: number | null;
          refund_count: number | null;
          sale_count: number | null;
          taxes_cents: number | null;
          vendor_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      v_transaction_summary: {
        Row: {
          cash_delta_cents: number | null;
          cash_in_cents: number | null;
          cash_out_cents: number | null;
          channel_id: string | null;
          channel_name: string | null;
          channel_type: Database["public"]["Enums"]["channel_type"] | null;
          cost_basis_cents: number | null;
          counterparty_name: string | null;
          counterparty_type: string | null;
          discount_cents: number | null;
          effective_type: Database["public"]["Enums"]["transaction_type"] | null;
          fee_cents: number | null;
          finalized_at: string | null;
          gross_profit_cents: number | null;
          item_lines: number | null;
          linked_transaction_id: string | null;
          net_payout_cents: number | null;
          net_sale_cents: number | null;
          notes: string | null;
          occurred_at: string | null;
          other_fee_cents: number | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          reason_code: Database["public"]["Enums"]["reason_code"] | null;
          sign_multiplier: number | null;
          signed_cost_basis_cents: number | null;
          signed_gross_profit_cents: number | null;
          signed_net_payout_cents: number | null;
          status: Database["public"]["Enums"]["transaction_status"] | null;
          subtotal_cents: number | null;
          tax_cents: number | null;
          total_lines: number | null;
          transaction_id: string | null;
          type: Database["public"]["Enums"]["transaction_type"] | null;
          vendor_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      adjust_inventory: {
        Args: { payload: Json };
        Returns: Json;
      };
      current_vendor_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      insert_audit_event: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"];
          p_actor_user_id?: string | null;
          p_after?: Json;
          p_before?: Json;
          p_entity_id: string;
          p_entity_type: string;
          p_note?: string | null;
          p_reason_code?: Database["public"]["Enums"]["reason_code"] | null;
          p_vendor_id: string;
        };
        Returns: string;
      };
      post_transaction: {
        Args: { payload: Json };
        Returns: Json;
      };
      require_current_vendor_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      reverse_transaction: {
        Args: {
          note?: string | null;
          reason_code: Database["public"]["Enums"]["reason_code"];
          transaction_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      audit_action: "created" | "updated" | "deleted" | "finalized" | "reversed" | "adjusted";
      channel_type: "direct" | "marketplace" | "booth" | "online" | "store" | "other";
      fee_type: "processor" | "channel" | "shipping" | "other";
      inventory_bucket: "on_hand" | "reserved" | "sold";
      inventory_type: "single" | "sealed" | "bundle" | "lot" | "service";
      item_status: "active" | "archived" | "discontinued";
      line_direction: "inbound" | "outbound";
      line_kind: "item" | "bundle" | "lot" | "service" | "memo" | "adjustment";
      movement_type:
        | "purchase"
        | "sale"
        | "trade_in"
        | "trade_out"
        | "refund"
        | "adjustment"
        | "transfer_in"
        | "transfer_out"
        | "reserve"
        | "release"
        | "reversal";
      payment_method:
        | "cash"
        | "card"
        | "paypal"
        | "venmo"
        | "zelle"
        | "bank_transfer"
        | "trade_credit"
        | "other";
      reason_code:
        | "pricing_error"
        | "inventory_count"
        | "customer_return"
        | "damaged_inventory"
        | "lost_inventory"
        | "duplicate_entry"
        | "vendor_correction"
        | "void_request"
        | "fraud_review"
        | "other";
      tax_mode: "exclusive" | "inclusive" | "none";
      transaction_status: "draft" | "finalized" | "voided" | "reversed";
      transaction_type: "sale" | "purchase" | "trade" | "refund" | "adjustment" | "transfer" | "reversal";
    };
    CompositeTypes: Record<string, never>;
  };
};
