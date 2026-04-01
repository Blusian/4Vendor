create or replace view public.v_inventory_position as
with movement_rollup as (
  select
    im.vendor_id,
    im.item_id,
    sum(case when im.bucket = 'on_hand' then im.quantity_delta else 0 end) as on_hand_quantity,
    sum(case when im.bucket = 'reserved' then im.quantity_delta else 0 end) as reserved_quantity,
    sum(case when im.bucket = 'sold' then im.quantity_delta else 0 end) as sold_quantity,
    max(im.occurred_at) as last_movement_at
  from public.inventory_movements im
  group by im.vendor_id, im.item_id
),
lot_rollup as (
  select
    l.vendor_id,
    l.item_id,
    count(*) as lot_count,
    sum(l.remaining_quantity) as lot_remaining_quantity,
    sum(round(l.remaining_quantity * l.unit_cost_cents)::integer) as remaining_cost_cents
  from public.inventory_lots l
  group by l.vendor_id, l.item_id
)
select
  i.vendor_id,
  i.id as item_id,
  i.sku,
  i.name,
  i.set_name,
  i.set_code,
  i.condition,
  i.rarity,
  i.language,
  i.inventory_type,
  coalesce(m.on_hand_quantity, 0::numeric) as on_hand_quantity,
  coalesce(m.reserved_quantity, 0::numeric) as reserved_quantity,
  coalesce(m.sold_quantity, 0::numeric) as sold_quantity,
  coalesce(l.lot_count, 0) as lot_count,
  coalesce(l.remaining_cost_cents, 0) as remaining_cost_cents,
  case
    when coalesce(m.on_hand_quantity, 0::numeric) > 0
      then round((coalesce(l.remaining_cost_cents, 0)::numeric / m.on_hand_quantity))::integer
    else 0
  end as weighted_unit_cost_cents,
  m.last_movement_at
from public.items i
left join movement_rollup m
  on m.vendor_id = i.vendor_id
 and m.item_id = i.id
left join lot_rollup l
  on l.vendor_id = i.vendor_id
 and l.item_id = i.id;

create or replace view public.v_transaction_summary as
with linked as (
  select
    t.id,
    coalesce(lt.type, t.type) as effective_type,
    case
      when t.type = 'reversal' and lt.type = 'sale' then -1
      when t.type = 'reversal' and lt.type = 'purchase' then 1
      when t.type = 'reversal' and lt.type = 'refund' then 1
      when t.type = 'sale' then 1
      when t.type = 'purchase' then -1
      when t.type = 'refund' then -1
      else 0
    end as sign_multiplier
  from public.transactions t
  left join public.transactions lt on lt.id = t.linked_transaction_id
)
select
  t.id as transaction_id,
  t.vendor_id,
  t.type,
  l.effective_type,
  t.status,
  t.occurred_at,
  t.finalized_at,
  t.channel_id,
  c.name as channel_name,
  c.channel_type,
  c.payment_method,
  t.counterparty_name,
  t.counterparty_type,
  t.linked_transaction_id,
  t.reason_code,
  t.notes,
  t.cash_in_cents,
  t.cash_out_cents,
  (t.cash_in_cents - t.cash_out_cents) as cash_delta_cents,
  t.subtotal_cents,
  t.discount_cents,
  t.tax_cents,
  t.fee_cents,
  t.other_fee_cents,
  t.net_sale_cents,
  t.net_payout_cents,
  t.cost_basis_cents,
  t.gross_profit_cents,
  l.sign_multiplier,
  (t.net_payout_cents * l.sign_multiplier) as signed_net_payout_cents,
  (t.cost_basis_cents * l.sign_multiplier) as signed_cost_basis_cents,
  (t.gross_profit_cents * l.sign_multiplier) as signed_gross_profit_cents,
  coalesce(line_counts.total_lines, 0) as total_lines,
  coalesce(line_counts.item_lines, 0) as item_lines
from public.transactions t
join linked l on l.id = t.id
left join public.channels c on c.id = t.channel_id
left join (
  select
    tl.transaction_id,
    count(*) as total_lines,
    count(*) filter (where tl.item_id is not null) as item_lines
  from public.transaction_lines tl
  group by tl.transaction_id
) as line_counts on line_counts.transaction_id = t.id;

create or replace view public.v_reconciliation_summary as
select
  s.vendor_id,
  date_trunc('day', coalesce(s.finalized_at, s.occurred_at)) as business_day,
  s.channel_id,
  s.channel_name,
  s.channel_type,
  s.payment_method,
  count(*) filter (where s.effective_type = 'sale') as sale_count,
  count(*) filter (where s.effective_type = 'purchase') as purchase_count,
  count(*) filter (where s.effective_type = 'refund') as refund_count,
  sum(
    case
      when s.effective_type = 'sale' then s.signed_net_payout_cents
      when s.effective_type = 'purchase' then s.signed_net_payout_cents
      when s.effective_type = 'refund' then s.signed_net_payout_cents
      when s.effective_type = 'trade' then s.cash_delta_cents
      when s.effective_type = 'adjustment' then s.cash_delta_cents
      else 0
    end
  ) as expected_cash_cents,
  sum(
    case
      when s.payment_method in ('card', 'paypal', 'venmo', 'zelle', 'bank_transfer')
        then s.signed_net_payout_cents
      else 0
    end
  ) as processor_receivable_cents,
  sum(s.fee_cents + s.other_fee_cents) as fees_cents,
  sum(s.tax_cents) as taxes_cents
from public.v_transaction_summary s
where s.status = 'finalized'
group by
  s.vendor_id,
  date_trunc('day', coalesce(s.finalized_at, s.occurred_at)),
  s.channel_id,
  s.channel_name,
  s.channel_type,
  s.payment_method;

create or replace view public.v_profit_snapshot as
select
  s.vendor_id,
  date_trunc('day', coalesce(s.finalized_at, s.occurred_at)) as business_day,
  s.channel_id,
  s.channel_name,
  sum(
    case
      when s.effective_type = 'sale' then s.subtotal_cents * s.sign_multiplier
      when s.effective_type = 'refund' then s.subtotal_cents * s.sign_multiplier
      else 0
    end
  ) as gross_revenue_cents,
  sum(s.tax_cents * s.sign_multiplier) as taxes_cents,
  sum((s.fee_cents + s.other_fee_cents) * s.sign_multiplier) as fees_cents,
  sum(s.cost_basis_cents * s.sign_multiplier) as cost_basis_cents,
  sum(s.gross_profit_cents * s.sign_multiplier) as net_profit_cents,
  count(*) filter (where s.status = 'finalized') as finalized_transaction_count
from public.v_transaction_summary s
where s.status = 'finalized'
group by
  s.vendor_id,
  date_trunc('day', coalesce(s.finalized_at, s.occurred_at)),
  s.channel_id,
  s.channel_name;

create or replace view public.v_integrity_alerts as
select
  v.vendor_id,
  'negative_inventory'::text as alert_type,
  'item'::text as entity_type,
  v.item_id as entity_id,
  concat('Negative on-hand quantity for item ', v.sku) as message,
  timezone('utc', now()) as observed_at
from public.v_inventory_position v
where v.on_hand_quantity < 0

union all

select
  l.vendor_id,
  'lot_quantity_out_of_bounds'::text as alert_type,
  'inventory_lot'::text as entity_type,
  l.id as entity_id,
  'Lot remaining quantity is outside valid bounds' as message,
  timezone('utc', now()) as observed_at
from public.inventory_lots l
where l.remaining_quantity < 0
   or l.remaining_quantity > l.original_quantity

union all

select
  t.vendor_id,
  'finalized_transaction_missing_movements'::text as alert_type,
  'transaction'::text as entity_type,
  t.id as entity_id,
  'Finalized transaction has item lines but no inventory movements' as message,
  timezone('utc', now()) as observed_at
from public.transactions t
where t.status = 'finalized'
  and exists (
    select 1
    from public.transaction_lines tl
    where tl.transaction_id = t.id
      and tl.item_id is not null
  )
  and not exists (
    select 1
    from public.inventory_movements im
    where im.transaction_id = t.id
  )

union all

select
  t.vendor_id,
  'allocation_item_mismatch'::text as alert_type,
  'lot_allocation'::text as entity_type,
  la.id as entity_id,
  'Lot allocation item does not match the transaction line item' as message,
  timezone('utc', now()) as observed_at
from public.lot_allocations la
join public.transaction_lines tl on tl.id = la.transaction_line_id
join public.transactions t on t.id = tl.transaction_id
join public.inventory_lots l on l.id = la.lot_id
where tl.item_id is distinct from l.item_id;

grant select on public.v_inventory_position to authenticated;
grant select on public.v_transaction_summary to authenticated;
grant select on public.v_reconciliation_summary to authenticated;
grant select on public.v_profit_snapshot to authenticated;
grant select on public.v_integrity_alerts to authenticated;
