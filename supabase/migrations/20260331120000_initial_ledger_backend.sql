create extension if not exists pgcrypto;

create type public.inventory_type as enum ('single', 'sealed', 'bundle', 'lot', 'service');
create type public.item_status as enum ('active', 'archived', 'discontinued');
create type public.channel_type as enum ('direct', 'marketplace', 'booth', 'online', 'store', 'other');
create type public.payment_method as enum (
  'cash',
  'card',
  'paypal',
  'venmo',
  'zelle',
  'bank_transfer',
  'trade_credit',
  'other'
);
create type public.tax_mode as enum ('exclusive', 'inclusive', 'none');
create type public.transaction_type as enum (
  'sale',
  'purchase',
  'trade',
  'refund',
  'adjustment',
  'transfer',
  'reversal'
);
create type public.transaction_status as enum ('draft', 'finalized', 'voided', 'reversed');
create type public.line_direction as enum ('inbound', 'outbound');
create type public.line_kind as enum ('item', 'bundle', 'lot', 'service', 'memo', 'adjustment');
create type public.fee_type as enum ('processor', 'channel', 'shipping', 'other');
create type public.inventory_bucket as enum ('on_hand', 'reserved', 'sold');
create type public.movement_type as enum (
  'purchase',
  'sale',
  'trade_in',
  'trade_out',
  'refund',
  'adjustment',
  'transfer_in',
  'transfer_out',
  'reserve',
  'release',
  'reversal'
);
create type public.reason_code as enum (
  'pricing_error',
  'inventory_count',
  'customer_return',
  'damaged_inventory',
  'lost_inventory',
  'duplicate_entry',
  'vendor_correction',
  'void_request',
  'fraud_review',
  'other'
);
create type public.audit_action as enum ('created', 'updated', 'deleted', 'finalized', 'reversed', 'adjusted');

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  base_currency text not null default 'USD' check (char_length(base_currency) = 3),
  timezone text not null default 'America/Phoenix',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  sku text not null,
  name text not null,
  set_name text,
  set_code text,
  condition text,
  rarity text,
  language text default 'en',
  inventory_type public.inventory_type not null default 'single',
  current_status public.item_status not null default 'active',
  notes text,
  metadata_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (vendor_id, sku)
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  channel_type public.channel_type not null default 'direct',
  payment_method public.payment_method not null default 'cash',
  default_tax_mode public.tax_mode not null default 'none',
  default_tax_rate_bps integer not null default 0 check (default_tax_rate_bps >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (vendor_id, name)
);

create table public.fee_rules (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  processor_name text,
  label text not null,
  percent_bps integer not null default 0 check (percent_bps >= 0),
  flat_fee_cents integer not null default 0 check (flat_fee_cents >= 0),
  applies_to_tax boolean not null default false,
  applies_to_shipping boolean not null default false,
  priority integer not null default 100,
  active_from timestamptz,
  active_to timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (active_to is null or active_from is null or active_to > active_from)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  type public.transaction_type not null,
  status public.transaction_status not null default 'draft',
  occurred_at timestamptz not null default timezone('utc', now()),
  finalized_at timestamptz,
  channel_id uuid references public.channels(id) on delete set null,
  counterparty_name text,
  counterparty_type text,
  linked_transaction_id uuid references public.transactions(id) on delete set null,
  reason_code public.reason_code,
  notes text,
  cash_in_cents integer not null default 0,
  cash_out_cents integer not null default 0,
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  tax_cents integer not null default 0,
  fee_cents integer not null default 0,
  other_fee_cents integer not null default 0,
  net_sale_cents integer not null default 0,
  net_payout_cents integer not null default 0,
  cost_basis_cents integer not null default 0,
  gross_profit_cents integer not null default 0,
  calculation_snapshot_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((status = 'finalized' and finalized_at is not null) or status <> 'finalized'),
  check (type <> 'adjustment' or reason_code is not null)
);

create table public.transaction_lines (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  parent_line_id uuid references public.transaction_lines(id) on delete set null,
  direction public.line_direction not null,
  line_kind public.line_kind not null default 'item',
  item_id uuid references public.items(id) on delete set null,
  description text,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price_cents integer not null default 0,
  line_subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  taxable_base_cents integer not null default 0,
  tax_cents integer not null default 0,
  extended_total_cents integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.transaction_fee_lines (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  fee_rule_id uuid references public.fee_rules(id) on delete set null,
  fee_type public.fee_type not null,
  label text not null,
  basis_cents integer not null default 0,
  rate_bps integer not null default 0,
  flat_fee_cents integer not null default 0,
  computed_fee_cents integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.transaction_tax_lines (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  label text not null,
  jurisdiction text,
  taxable_base_cents integer not null default 0,
  rate_bps integer not null default 0,
  tax_cents integer not null default 0,
  included_in_price boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  source_transaction_id uuid references public.transactions(id) on delete set null,
  source_line_id uuid references public.transaction_lines(id) on delete set null,
  acquired_at timestamptz not null default timezone('utc', now()),
  acquisition_source text,
  original_quantity numeric(12, 3) not null check (original_quantity > 0),
  remaining_quantity numeric(12, 3) not null check (remaining_quantity >= 0),
  unit_cost_cents integer not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (remaining_quantity <= original_quantity)
);

create table public.lot_allocations (
  id uuid primary key default gen_random_uuid(),
  transaction_line_id uuid not null references public.transaction_lines(id) on delete cascade,
  lot_id uuid not null references public.inventory_lots(id) on delete restrict,
  quantity_allocated numeric(12, 3) not null check (quantity_allocated > 0),
  unit_cost_cents integer not null default 0,
  extended_cost_cents integer not null default 0,
  allocation_order integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  unique (transaction_line_id, lot_id),
  unique (transaction_line_id, allocation_order)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  transaction_line_id uuid references public.transaction_lines(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  lot_id uuid references public.inventory_lots(id) on delete set null,
  bucket public.inventory_bucket not null default 'on_hand',
  movement_type public.movement_type not null,
  quantity_delta numeric(12, 3) not null check (quantity_delta <> 0),
  cost_delta_cents integer not null default 0,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action public.audit_action not null,
  reason_code public.reason_code,
  note text,
  before_snapshot_json jsonb not null default '{}'::jsonb,
  after_snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_items_vendor_id on public.items (vendor_id);
create index idx_channels_vendor_id on public.channels (vendor_id);
create index idx_fee_rules_vendor_channel on public.fee_rules (vendor_id, channel_id);
create index idx_transactions_vendor_occurred_at on public.transactions (vendor_id, occurred_at desc);
create index idx_transactions_vendor_status on public.transactions (vendor_id, status);
create index idx_transaction_lines_transaction_id on public.transaction_lines (transaction_id);
create index idx_transaction_lines_item_id on public.transaction_lines (item_id);
create index idx_transaction_fee_lines_transaction_id on public.transaction_fee_lines (transaction_id);
create index idx_transaction_tax_lines_transaction_id on public.transaction_tax_lines (transaction_id);
create index idx_inventory_lots_vendor_item on public.inventory_lots (vendor_id, item_id, acquired_at, id);
create index idx_inventory_lots_source_line on public.inventory_lots (source_line_id);
create index idx_lot_allocations_line_id on public.lot_allocations (transaction_line_id);
create index idx_inventory_movements_vendor_item on public.inventory_movements (vendor_id, item_id, occurred_at desc);
create index idx_inventory_movements_transaction_id on public.inventory_movements (transaction_id);
create index idx_audit_events_vendor_entity on public.audit_events (vendor_id, entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_updated_at_vendors
before update on public.vendors
for each row
execute function public.set_updated_at();

create trigger set_updated_at_items
before update on public.items
for each row
execute function public.set_updated_at();

create trigger set_updated_at_channels
before update on public.channels
for each row
execute function public.set_updated_at();

create trigger set_updated_at_fee_rules
before update on public.fee_rules
for each row
execute function public.set_updated_at();

create trigger set_updated_at_transactions
before update on public.transactions
for each row
execute function public.set_updated_at();

create trigger set_updated_at_inventory_lots
before update on public.inventory_lots
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.vendors (owner_user_id, business_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'business_name', ''),
      nullif(new.raw_user_meta_data ->> 'shop_name', ''),
      concat(split_part(coalesce(new.email, 'vendor'), '@', 1), '''s Shop')
    )
  )
  on conflict (owner_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.current_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.id
  from public.vendors v
  where v.owner_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.require_current_vendor_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  select public.current_vendor_id() into v_vendor_id;

  if v_vendor_id is null then
    raise exception 'No vendor workspace exists for the current user';
  end if;

  return v_vendor_id;
end;
$$;

create or replace function public.insert_audit_event(
  p_vendor_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action public.audit_action,
  p_reason_code public.reason_code default null,
  p_note text default null,
  p_before jsonb default '{}'::jsonb,
  p_after jsonb default '{}'::jsonb,
  p_actor_user_id uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit_id uuid;
begin
  insert into public.audit_events (
    vendor_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    reason_code,
    note,
    before_snapshot_json,
    after_snapshot_json
  )
  values (
    p_vendor_id,
    p_actor_user_id,
    p_entity_type,
    p_entity_id,
    p_action,
    p_reason_code,
    p_note,
    coalesce(p_before, '{}'::jsonb),
    coalesce(p_after, '{}'::jsonb)
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

grant execute on function public.current_vendor_id() to authenticated;
grant execute on function public.require_current_vendor_id() to authenticated;
grant execute on function public.insert_audit_event(uuid, text, uuid, public.audit_action, public.reason_code, text, jsonb, jsonb, uuid) to authenticated;

alter table public.vendors enable row level security;
alter table public.items enable row level security;
alter table public.channels enable row level security;
alter table public.fee_rules enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_lines enable row level security;
alter table public.transaction_fee_lines enable row level security;
alter table public.transaction_tax_lines enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.lot_allocations enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_events enable row level security;

create policy vendors_select_own
on public.vendors
for select
using (owner_user_id = auth.uid());

create policy vendors_insert_own
on public.vendors
for insert
with check (owner_user_id = auth.uid());

create policy vendors_update_own
on public.vendors
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy items_vendor_scope
on public.items
for select
using (vendor_id = public.current_vendor_id());

create policy items_vendor_insert
on public.items
for insert
with check (vendor_id = public.current_vendor_id());

create policy items_vendor_update
on public.items
for update
using (vendor_id = public.current_vendor_id())
with check (vendor_id = public.current_vendor_id());

create policy items_vendor_delete
on public.items
for delete
using (vendor_id = public.current_vendor_id());

create policy channels_vendor_scope
on public.channels
for select
using (vendor_id = public.current_vendor_id());

create policy channels_vendor_insert
on public.channels
for insert
with check (vendor_id = public.current_vendor_id());

create policy channels_vendor_update
on public.channels
for update
using (vendor_id = public.current_vendor_id())
with check (vendor_id = public.current_vendor_id());

create policy channels_vendor_delete
on public.channels
for delete
using (vendor_id = public.current_vendor_id());

create policy fee_rules_vendor_scope
on public.fee_rules
for select
using (vendor_id = public.current_vendor_id());

create policy fee_rules_vendor_insert
on public.fee_rules
for insert
with check (vendor_id = public.current_vendor_id());

create policy fee_rules_vendor_update
on public.fee_rules
for update
using (vendor_id = public.current_vendor_id())
with check (vendor_id = public.current_vendor_id());

create policy fee_rules_vendor_delete
on public.fee_rules
for delete
using (vendor_id = public.current_vendor_id());

create policy transactions_vendor_scope
on public.transactions
for select
using (vendor_id = public.current_vendor_id());

create policy transactions_insert_drafts
on public.transactions
for insert
with check (
  vendor_id = public.current_vendor_id()
  and status = 'draft'
  and created_by = auth.uid()
);

create policy transactions_update_drafts
on public.transactions
for update
using (vendor_id = public.current_vendor_id() and status = 'draft')
with check (vendor_id = public.current_vendor_id() and status = 'draft');

create policy transactions_delete_drafts
on public.transactions
for delete
using (vendor_id = public.current_vendor_id() and status = 'draft');

create policy transaction_lines_vendor_scope
on public.transaction_lines
for select
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
  )
);

create policy transaction_lines_insert_draft
on public.transaction_lines
for insert
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
);

create policy transaction_lines_update_draft
on public.transaction_lines
for update
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
)
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
);

create policy transaction_lines_delete_draft
on public.transaction_lines
for delete
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
);

create policy transaction_fee_lines_vendor_scope
on public.transaction_fee_lines
for select
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
  )
);

create policy transaction_fee_lines_insert_draft
on public.transaction_fee_lines
for insert
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
);

create policy transaction_fee_lines_update_draft
on public.transaction_fee_lines
for update
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
)
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
);

create policy transaction_fee_lines_delete_draft
on public.transaction_fee_lines
for delete
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
);

create policy transaction_tax_lines_vendor_scope
on public.transaction_tax_lines
for select
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
  )
);

create policy transaction_tax_lines_insert_draft
on public.transaction_tax_lines
for insert
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
);

create policy transaction_tax_lines_update_draft
on public.transaction_tax_lines
for update
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
)
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
);

create policy transaction_tax_lines_delete_draft
on public.transaction_tax_lines
for delete
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and t.vendor_id = public.current_vendor_id()
      and t.status = 'draft'
  )
);

create policy inventory_lots_vendor_scope
on public.inventory_lots
for select
using (vendor_id = public.current_vendor_id());

create policy lot_allocations_vendor_scope
on public.lot_allocations
for select
using (
  exists (
    select 1
    from public.transaction_lines tl
    join public.transactions t on t.id = tl.transaction_id
    where tl.id = transaction_line_id
      and t.vendor_id = public.current_vendor_id()
  )
);

create policy inventory_movements_vendor_scope
on public.inventory_movements
for select
using (vendor_id = public.current_vendor_id());

create policy audit_events_vendor_scope
on public.audit_events
for select
using (vendor_id = public.current_vendor_id());

grant usage on schema public to authenticated;

grant select, insert, update on public.vendors to authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, update, delete on public.fee_rules to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.transaction_lines to authenticated;
grant select, insert, update, delete on public.transaction_fee_lines to authenticated;
grant select, insert, update, delete on public.transaction_tax_lines to authenticated;
grant select on public.inventory_lots to authenticated;
grant select on public.lot_allocations to authenticated;
grant select on public.inventory_movements to authenticated;
grant select on public.audit_events to authenticated;
