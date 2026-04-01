# Supabase Backend

This folder contains the ledger-grade backend foundation for 4Vendor.

## Migrations

- `migrations/20260331120000_initial_ledger_backend.sql`
  Creates enums, tables, constraints, indexes, signup/vendor helpers, grants, and RLS policies.
- `migrations/20260331121000_ledger_posting_functions.sql`
  Creates the ledger RPCs: `post_transaction`, `adjust_inventory`, and `reverse_transaction`.
- `migrations/20260331122000_ledger_reporting_views.sql`
  Creates the operational read models used for inventory, reconciliation, profit, and integrity checks.

## App Contracts

- [database.types.ts](c:\Users\Andy Mach\source\repos\4Vendor\utils\supabase\database.types.ts)
  Hand-authored TypeScript contract mirroring the current schema surface.
- [ledger.ts](c:\Users\Andy Mach\source\repos\4Vendor\utils\supabase\ledger.ts)
  Typed wrappers for the posting RPCs.

## Expected RPC Payload Shape

- `post_transaction(payload)`
  Expects a `transaction` object, a `lines` array, and optional `fee_lines`, `tax_lines`, and `calculation_snapshot_json`.
- `adjust_inventory(payload)`
  Expects `adjustments` with signed `quantity_delta` values and optional transaction metadata.
- `reverse_transaction(transaction_id, reason_code, note)`
  Creates a finalized reversal entry linked back to the original transaction.

## Notes

- Money values are stored as integer cents.
- Rates are stored as basis points.
- FIFO lot allocation is enforced automatically unless explicit `lot_allocations` are passed.
- Finalized ledger rows are created through RPCs, while direct user writes remain limited to reference data and drafts.
