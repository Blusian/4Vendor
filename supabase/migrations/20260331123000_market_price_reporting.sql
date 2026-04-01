create or replace view public.v_market_price_comparison as
with eligible_sales as (
  select
    t.id,
    t.vendor_id,
    t.occurred_at
  from public.transactions t
  where t.status = 'finalized'
    and t.type = 'sale'
    and not exists (
      select 1
      from public.transactions reversal
      where reversal.linked_transaction_id = t.id
        and reversal.type = 'reversal'
        and reversal.status = 'finalized'
    )
),
sale_lines as (
  select
    s.vendor_id,
    tl.item_id,
    s.occurred_at,
    tl.unit_price_cents,
    row_number() over (
      partition by s.vendor_id, tl.item_id
      order by s.occurred_at desc, tl.created_at desc, tl.id desc
    ) as sale_rank
  from eligible_sales s
  join public.transaction_lines tl on tl.transaction_id = s.id
  where tl.item_id is not null
    and tl.direction = 'outbound'
),
sale_rollup as (
  select
    sl.vendor_id,
    sl.item_id,
    max(sl.occurred_at) as last_sold_at,
    max(sl.unit_price_cents) filter (where sl.sale_rank = 1) as last_sold_unit_price_cents,
    round(avg(sl.unit_price_cents)::numeric)::integer as average_sold_unit_price_cents,
    count(*) as finalized_sale_count
  from sale_lines sl
  group by sl.vendor_id, sl.item_id
)
select
  i.vendor_id,
  i.id as item_id,
  i.sku,
  i.name,
  i.set_name,
  i.inventory_type,
  nullif(i.metadata_json ->> 'market_price_source', '') as market_price_source,
  nullif(i.metadata_json ->> 'market_price_updated_at', '')::timestamptz as market_price_updated_at,
  nullif(i.metadata_json ->> 'market_price_cents', '')::integer as market_price_cents,
  sr.last_sold_at,
  sr.last_sold_unit_price_cents,
  sr.average_sold_unit_price_cents,
  sr.finalized_sale_count,
  case
    when sr.last_sold_unit_price_cents is not null
      and nullif(i.metadata_json ->> 'market_price_cents', '') is not null
      then sr.last_sold_unit_price_cents - (i.metadata_json ->> 'market_price_cents')::integer
    else null
  end as sold_vs_market_cents,
  case
    when sr.last_sold_unit_price_cents is not null
      and coalesce(nullif(i.metadata_json ->> 'market_price_cents', '')::integer, 0) > 0
      then round(
        (
          (sr.last_sold_unit_price_cents - (i.metadata_json ->> 'market_price_cents')::integer)::numeric
          / (i.metadata_json ->> 'market_price_cents')::integer::numeric
        ) * 100,
        2
      )
    else null
  end as sold_vs_market_percent
from public.items i
left join sale_rollup sr
  on sr.vendor_id = i.vendor_id
 and sr.item_id = i.id
where nullif(i.metadata_json ->> 'market_price_cents', '') is not null
   or sr.last_sold_at is not null;

grant select on public.v_market_price_comparison to authenticated;
