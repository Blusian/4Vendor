create or replace function public.post_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_vendor_id uuid := public.require_current_vendor_id();
  v_transaction_payload jsonb := coalesce(payload -> 'transaction', '{}'::jsonb);
  v_lines_payload jsonb := coalesce(payload -> 'lines', '[]'::jsonb);
  v_fee_lines_payload jsonb := coalesce(payload -> 'fee_lines', '[]'::jsonb);
  v_tax_lines_payload jsonb := coalesce(payload -> 'tax_lines', '[]'::jsonb);
  v_snapshot jsonb := coalesce(payload -> 'calculation_snapshot_json', '{}'::jsonb);
  v_transaction_id uuid := coalesce(nullif(v_transaction_payload ->> 'id', '')::uuid, gen_random_uuid());
  v_existing_transaction public.transactions%rowtype;
  v_channel public.channels%rowtype;
  v_linked_transaction public.transactions%rowtype;
  v_type public.transaction_type := nullif(v_transaction_payload ->> 'type', '')::public.transaction_type;
  v_status public.transaction_status := coalesce(nullif(v_transaction_payload ->> 'status', '')::public.transaction_status, 'finalized');
  v_occurred_at timestamptz := coalesce(nullif(v_transaction_payload ->> 'occurred_at', '')::timestamptz, timezone('utc', now()));
  v_channel_id uuid := nullif(v_transaction_payload ->> 'channel_id', '')::uuid;
  v_linked_transaction_id uuid := nullif(v_transaction_payload ->> 'linked_transaction_id', '')::uuid;
  v_counterparty_name text := nullif(v_transaction_payload ->> 'counterparty_name', '');
  v_counterparty_type text := nullif(v_transaction_payload ->> 'counterparty_type', '');
  v_reason_code public.reason_code := nullif(v_transaction_payload ->> 'reason_code', '')::public.reason_code;
  v_notes text := nullif(v_transaction_payload ->> 'notes', '');
  v_cash_in_cents integer := coalesce((v_transaction_payload ->> 'cash_in_cents')::integer, 0);
  v_cash_out_cents integer := coalesce((v_transaction_payload ->> 'cash_out_cents')::integer, 0);
  v_outbound_subtotal_cents integer := 0;
  v_inbound_subtotal_cents integer := 0;
  v_total_discount_cents integer := coalesce((v_transaction_payload ->> 'discount_cents')::integer, 0);
  v_line_tax_total_cents integer := 0;
  v_tax_total_cents integer := 0;
  v_fee_total_cents integer := 0;
  v_other_fee_total_cents integer := 0;
  v_cost_basis_cents integer := 0;
  v_subtotal_cents integer := 0;
  v_net_sale_cents integer := 0;
  v_net_payout_cents integer := 0;
  v_gross_profit_cents integer := 0;
  v_shipping_basis_cents integer := 0;
  v_outbound_taxable_base_cents integer := 0;
  v_inbound_taxable_base_cents integer := 0;
  v_fee_basis_cents integer := 0;
  v_now timestamptz := timezone('utc', now());
  v_is_new boolean := false;
  v_line jsonb;
  v_fee_line jsonb;
  v_tax_line jsonb;
  v_inserted_line_id uuid;
  v_line_key text;
  v_parent_line_key text;
  v_parent_line_id uuid;
  v_item_id uuid;
  v_quantity numeric(12, 3);
  v_direction public.line_direction;
  v_line_kind public.line_kind;
  v_unit_price_cents integer;
  v_unit_cost_cents integer;
  v_line_subtotal_cents integer;
  v_line_discount_cents integer;
  v_taxable_base_cents integer;
  v_line_tax_cents integer;
  v_extended_total_cents integer;
  v_line_value_cents integer;
  v_restore_allocations jsonb;
  v_requested_allocations jsonb;
  v_allocation jsonb;
  v_restore_quantity numeric(12, 3);
  v_allocated_quantity numeric(12, 3);
  v_total_restore_quantity numeric(12, 3);
  v_total_requested_quantity numeric(12, 3);
  v_fee_rule public.fee_rules%rowtype;
  v_inventory_lot public.inventory_lots%rowtype;
  v_new_lot_id uuid;
  v_movement_type public.movement_type;
  v_cost_delta_cents integer;
  v_inserted_count integer;
  v_line_key_map jsonb := '{}'::jsonb;
  v_before_snapshot jsonb := '{}'::jsonb;
  v_signing_type public.transaction_type;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication is required to post transactions';
  end if;

  if v_type is null then
    raise exception 'transaction.type is required';
  end if;

  if jsonb_typeof(v_lines_payload) <> 'array' or jsonb_array_length(v_lines_payload) = 0 then
    raise exception 'payload.lines must contain at least one line';
  end if;

  if v_type = 'adjustment' and v_reason_code is null and v_status = 'finalized' then
    raise exception 'reason_code is required for finalized adjustment transactions';
  end if;

  if v_linked_transaction_id is not null then
    select *
    into v_linked_transaction
    from public.transactions
    where id = v_linked_transaction_id
      and vendor_id = v_vendor_id;

    if not found then
      raise exception 'Linked transaction % was not found for this vendor', v_linked_transaction_id;
    end if;
  end if;

  if v_channel_id is not null then
    select *
    into v_channel
    from public.channels
    where id = v_channel_id
      and vendor_id = v_vendor_id;

    if not found then
      raise exception 'Channel % was not found for this vendor', v_channel_id;
    end if;
  end if;

  select *
  into v_existing_transaction
  from public.transactions
  where id = v_transaction_id
    and vendor_id = v_vendor_id
  for update;

  if found then
    if v_existing_transaction.status <> 'draft' then
      raise exception 'Only draft transactions can be reposted via post_transaction';
    end if;

    v_before_snapshot := to_jsonb(v_existing_transaction);

    delete from public.transaction_tax_lines where transaction_id = v_transaction_id;
    delete from public.transaction_fee_lines where transaction_id = v_transaction_id;
    delete from public.transaction_lines where transaction_id = v_transaction_id;

    update public.transactions
    set
      type = v_type,
      status = v_status,
      occurred_at = v_occurred_at,
      finalized_at = case when v_status = 'finalized' then v_now else null end,
      channel_id = v_channel_id,
      counterparty_name = v_counterparty_name,
      counterparty_type = v_counterparty_type,
      linked_transaction_id = v_linked_transaction_id,
      reason_code = v_reason_code,
      notes = v_notes,
      cash_in_cents = v_cash_in_cents,
      cash_out_cents = v_cash_out_cents,
      calculation_snapshot_json = v_snapshot,
      created_by = v_actor_user_id
    where id = v_transaction_id;
  else
    v_is_new := true;

    insert into public.transactions (
      id,
      vendor_id,
      type,
      status,
      occurred_at,
      finalized_at,
      channel_id,
      counterparty_name,
      counterparty_type,
      linked_transaction_id,
      reason_code,
      notes,
      cash_in_cents,
      cash_out_cents,
      calculation_snapshot_json,
      created_by
    )
    values (
      v_transaction_id,
      v_vendor_id,
      v_type,
      v_status,
      v_occurred_at,
      case when v_status = 'finalized' then v_now else null end,
      v_channel_id,
      v_counterparty_name,
      v_counterparty_type,
      v_linked_transaction_id,
      v_reason_code,
      v_notes,
      v_cash_in_cents,
      v_cash_out_cents,
      v_snapshot,
      v_actor_user_id
    );
  end if;

  if v_type = 'reversal' and v_linked_transaction_id is null then
    raise exception 'Reversal transactions require linked_transaction_id';
  end if;

  v_signing_type := case when v_type = 'reversal' then v_linked_transaction.type else v_type end;

  for v_line in
    select value
    from jsonb_array_elements(v_lines_payload)
  loop
    v_line_key := nullif(v_line ->> 'line_key', '');
    v_parent_line_key := nullif(v_line ->> 'parent_line_key', '');
    v_item_id := nullif(v_line ->> 'item_id', '')::uuid;
    v_quantity := coalesce((v_line ->> 'quantity')::numeric, 0);
    v_direction := coalesce(nullif(v_line ->> 'direction', '')::public.line_direction, 'outbound');
    v_line_kind := coalesce(nullif(v_line ->> 'line_kind', '')::public.line_kind, 'item');
    v_unit_price_cents := coalesce((v_line ->> 'unit_price_cents')::integer, 0);
    v_unit_cost_cents := coalesce((v_line ->> 'unit_cost_cents')::integer, v_unit_price_cents, 0);
    v_line_subtotal_cents := coalesce((v_line ->> 'line_subtotal_cents')::integer, round(v_quantity * v_unit_price_cents)::integer);
    v_line_discount_cents := coalesce((v_line ->> 'discount_cents')::integer, 0);
    v_taxable_base_cents := coalesce((v_line ->> 'taxable_base_cents')::integer, greatest(v_line_subtotal_cents - v_line_discount_cents, 0));
    v_line_tax_cents := coalesce((v_line ->> 'tax_cents')::integer, 0);
    v_extended_total_cents := coalesce((v_line ->> 'extended_total_cents')::integer, v_line_subtotal_cents - v_line_discount_cents + v_line_tax_cents);
    v_restore_allocations := coalesce(v_line -> 'restore_lot_allocations', '[]'::jsonb);
    v_requested_allocations := coalesce(v_line -> 'lot_allocations', '[]'::jsonb);

    if v_quantity <= 0 then
      raise exception 'Line quantity must be positive';
    end if;

    if v_parent_line_key is not null then
      v_parent_line_id := nullif(v_line_key_map ->> v_parent_line_key, '')::uuid;
      if v_parent_line_id is null then
        raise exception 'Unknown parent_line_key %', v_parent_line_key;
      end if;
    else
      v_parent_line_id := null;
    end if;

    if v_item_id is not null then
      perform 1
      from public.items
      where id = v_item_id
        and vendor_id = v_vendor_id;

      if not found then
        raise exception 'Line item % does not belong to the current vendor', v_item_id;
      end if;
    end if;

    insert into public.transaction_lines (
      transaction_id,
      parent_line_id,
      direction,
      line_kind,
      item_id,
      description,
      quantity,
      unit_price_cents,
      line_subtotal_cents,
      discount_cents,
      taxable_base_cents,
      tax_cents,
      extended_total_cents
    )
    values (
      v_transaction_id,
      v_parent_line_id,
      v_direction,
      v_line_kind,
      v_item_id,
      nullif(v_line ->> 'description', ''),
      v_quantity,
      v_unit_price_cents,
      v_line_subtotal_cents,
      v_line_discount_cents,
      v_taxable_base_cents,
      v_line_tax_cents,
      v_extended_total_cents
    )
    returning id into v_inserted_line_id;

    if v_line_key is not null then
      v_line_key_map := v_line_key_map || jsonb_build_object(v_line_key, v_inserted_line_id::text);
    end if;

    if v_parent_line_id is null then
      if v_direction = 'outbound' then
        v_outbound_subtotal_cents := v_outbound_subtotal_cents + v_line_subtotal_cents;
        v_outbound_taxable_base_cents := v_outbound_taxable_base_cents + v_taxable_base_cents;
      else
        v_inbound_subtotal_cents := v_inbound_subtotal_cents + v_line_subtotal_cents;
        v_inbound_taxable_base_cents := v_inbound_taxable_base_cents + v_taxable_base_cents;
      end if;

      v_total_discount_cents := v_total_discount_cents + v_line_discount_cents;
      v_line_tax_total_cents := v_line_tax_total_cents + v_line_tax_cents;

      if v_line_kind = 'service' then
        v_shipping_basis_cents := v_shipping_basis_cents + v_line_subtotal_cents;
      end if;
    end if;

    if v_status <> 'finalized' or v_item_id is null then
      continue;
    end if;

    if v_direction = 'inbound' then
      v_total_restore_quantity := 0;
      v_movement_type := case v_signing_type
        when 'purchase' then 'purchase'
        when 'trade' then 'trade_in'
        when 'refund' then 'refund'
        when 'adjustment' then 'adjustment'
        when 'transfer' then 'transfer_in'
        else 'reversal'
      end;

      if jsonb_typeof(v_restore_allocations) = 'array' and jsonb_array_length(v_restore_allocations) > 0 then
        for v_allocation in
          select value
          from jsonb_array_elements(v_restore_allocations)
        loop
          v_inventory_lot := null;
          v_restore_quantity := coalesce((v_allocation ->> 'quantity')::numeric, 0);
          v_total_restore_quantity := v_total_restore_quantity + v_restore_quantity;

          if v_restore_quantity <= 0 then
            raise exception 'restore_lot_allocations must have positive quantities';
          end if;

          select *
          into v_inventory_lot
          from public.inventory_lots
          where id = nullif(v_allocation ->> 'lot_id', '')::uuid
            and vendor_id = v_vendor_id
            and item_id = v_item_id
          for update;

          if not found then
            raise exception 'Restore lot % was not found for item %', v_allocation ->> 'lot_id', v_item_id;
          end if;

          if v_inventory_lot.remaining_quantity + v_restore_quantity > v_inventory_lot.original_quantity then
            raise exception 'Restoring % would exceed original quantity on lot %', v_restore_quantity, v_inventory_lot.id;
          end if;

          update public.inventory_lots
          set remaining_quantity = remaining_quantity + v_restore_quantity
          where id = v_inventory_lot.id;

          v_cost_delta_cents := round(v_restore_quantity * v_inventory_lot.unit_cost_cents)::integer;

          insert into public.inventory_movements (
            vendor_id,
            transaction_id,
            transaction_line_id,
            item_id,
            lot_id,
            bucket,
            movement_type,
            quantity_delta,
            cost_delta_cents,
            occurred_at
          )
          values (
            v_vendor_id,
            v_transaction_id,
            v_inserted_line_id,
            v_item_id,
            v_inventory_lot.id,
            'on_hand',
            v_movement_type,
            v_restore_quantity,
            v_cost_delta_cents,
            v_occurred_at
          );

          if v_signing_type in ('sale', 'refund') then
            insert into public.inventory_movements (
              vendor_id,
              transaction_id,
              transaction_line_id,
              item_id,
              lot_id,
              bucket,
              movement_type,
              quantity_delta,
              cost_delta_cents,
              occurred_at
            )
            values (
              v_vendor_id,
              v_transaction_id,
              v_inserted_line_id,
              v_item_id,
              v_inventory_lot.id,
              'sold',
              'reversal',
              -v_restore_quantity,
              -v_cost_delta_cents,
              v_occurred_at
            );
          end if;
        end loop;

        if v_total_restore_quantity <> v_quantity then
          raise exception 'restore_lot_allocations must sum to the line quantity';
        end if;
      else
        insert into public.inventory_lots (
          vendor_id,
          item_id,
          source_transaction_id,
          source_line_id,
          acquired_at,
          acquisition_source,
          original_quantity,
          remaining_quantity,
          unit_cost_cents,
          notes
        )
        values (
          v_vendor_id,
          v_item_id,
          v_transaction_id,
          v_inserted_line_id,
          v_occurred_at,
          coalesce(v_counterparty_name, v_type::text),
          v_quantity,
          v_quantity,
          v_unit_cost_cents,
          v_notes
        )
        returning id into v_new_lot_id;

        v_cost_delta_cents := round(v_quantity * v_unit_cost_cents)::integer;

        insert into public.inventory_movements (
          vendor_id,
          transaction_id,
          transaction_line_id,
          item_id,
          lot_id,
          bucket,
          movement_type,
          quantity_delta,
          cost_delta_cents,
          occurred_at
        )
        values (
          v_vendor_id,
          v_transaction_id,
          v_inserted_line_id,
          v_item_id,
          v_new_lot_id,
          'on_hand',
          v_movement_type,
          v_quantity,
          v_cost_delta_cents,
          v_occurred_at
        );

        if v_signing_type = 'refund' then
          insert into public.inventory_movements (
            vendor_id,
            transaction_id,
            transaction_line_id,
            item_id,
            lot_id,
            bucket,
            movement_type,
            quantity_delta,
            cost_delta_cents,
            occurred_at
          )
          values (
            v_vendor_id,
            v_transaction_id,
            v_inserted_line_id,
            v_item_id,
            v_new_lot_id,
            'sold',
            'refund',
            -v_quantity,
            -v_cost_delta_cents,
            v_occurred_at
          );
        end if;
      end if;
    else
      v_total_requested_quantity := 0;
      v_movement_type := case v_signing_type
        when 'sale' then 'sale'
        when 'trade' then 'trade_out'
        when 'adjustment' then 'adjustment'
        when 'transfer' then 'transfer_out'
        when 'refund' then 'refund'
        else 'reversal'
      end;

      if jsonb_typeof(v_requested_allocations) = 'array' and jsonb_array_length(v_requested_allocations) > 0 then
        for v_allocation in
          select value
          from jsonb_array_elements(v_requested_allocations)
        loop
          v_inventory_lot := null;
          v_allocated_quantity := coalesce((v_allocation ->> 'quantity')::numeric, 0);
          v_total_requested_quantity := v_total_requested_quantity + v_allocated_quantity;

          if v_allocated_quantity <= 0 then
            raise exception 'lot_allocations must have positive quantities';
          end if;

          select *
          into v_inventory_lot
          from public.inventory_lots
          where id = nullif(v_allocation ->> 'lot_id', '')::uuid
            and vendor_id = v_vendor_id
            and item_id = v_item_id
          for update;

          if not found then
            raise exception 'Requested lot % was not found for item %', v_allocation ->> 'lot_id', v_item_id;
          end if;

          if v_inventory_lot.remaining_quantity < v_allocated_quantity then
            raise exception 'Lot % does not have enough remaining quantity', v_inventory_lot.id;
          end if;

          update public.inventory_lots
          set remaining_quantity = remaining_quantity - v_allocated_quantity
          where id = v_inventory_lot.id;

          v_cost_delta_cents := round(v_allocated_quantity * v_inventory_lot.unit_cost_cents)::integer;
          v_cost_basis_cents := v_cost_basis_cents + v_cost_delta_cents;

          insert into public.lot_allocations (
            transaction_line_id,
            lot_id,
            quantity_allocated,
            unit_cost_cents,
            extended_cost_cents,
            allocation_order
          )
          values (
            v_inserted_line_id,
            v_inventory_lot.id,
            v_allocated_quantity,
            v_inventory_lot.unit_cost_cents,
            v_cost_delta_cents,
            coalesce((v_allocation ->> 'allocation_order')::integer, 1)
          );

          insert into public.inventory_movements (
            vendor_id,
            transaction_id,
            transaction_line_id,
            item_id,
            lot_id,
            bucket,
            movement_type,
            quantity_delta,
            cost_delta_cents,
            occurred_at
          )
          values (
            v_vendor_id,
            v_transaction_id,
            v_inserted_line_id,
            v_item_id,
            v_inventory_lot.id,
            'on_hand',
            v_movement_type,
            -v_allocated_quantity,
            -v_cost_delta_cents,
            v_occurred_at
          );

          if v_signing_type = 'sale' then
            insert into public.inventory_movements (
              vendor_id,
              transaction_id,
              transaction_line_id,
              item_id,
              lot_id,
              bucket,
              movement_type,
              quantity_delta,
              cost_delta_cents,
              occurred_at
            )
            values (
              v_vendor_id,
              v_transaction_id,
              v_inserted_line_id,
              v_item_id,
              v_inventory_lot.id,
              'sold',
              'sale',
              v_allocated_quantity,
              v_cost_delta_cents,
              v_occurred_at
            );
          end if;
        end loop;

        if v_total_requested_quantity <> v_quantity then
          raise exception 'lot_allocations must sum to the line quantity';
        end if;
      else
        v_inserted_count := 0;

        for v_inventory_lot in
          select *
          from public.inventory_lots
          where vendor_id = v_vendor_id
            and item_id = v_item_id
            and remaining_quantity > 0
          order by acquired_at, id
          for update
        loop
          exit when v_total_requested_quantity = v_quantity;

          v_allocated_quantity := least(v_inventory_lot.remaining_quantity, v_quantity - v_total_requested_quantity);
          v_total_requested_quantity := v_total_requested_quantity + v_allocated_quantity;
          v_cost_delta_cents := round(v_allocated_quantity * v_inventory_lot.unit_cost_cents)::integer;
          v_cost_basis_cents := v_cost_basis_cents + v_cost_delta_cents;
          v_inserted_count := v_inserted_count + 1;

          update public.inventory_lots
          set remaining_quantity = remaining_quantity - v_allocated_quantity
          where id = v_inventory_lot.id;

          insert into public.lot_allocations (
            transaction_line_id,
            lot_id,
            quantity_allocated,
            unit_cost_cents,
            extended_cost_cents,
            allocation_order
          )
          values (
            v_inserted_line_id,
            v_inventory_lot.id,
            v_allocated_quantity,
            v_inventory_lot.unit_cost_cents,
            v_cost_delta_cents,
            v_inserted_count
          );

          insert into public.inventory_movements (
            vendor_id,
            transaction_id,
            transaction_line_id,
            item_id,
            lot_id,
            bucket,
            movement_type,
            quantity_delta,
            cost_delta_cents,
            occurred_at
          )
          values (
            v_vendor_id,
            v_transaction_id,
            v_inserted_line_id,
            v_item_id,
            v_inventory_lot.id,
            'on_hand',
            v_movement_type,
            -v_allocated_quantity,
            -v_cost_delta_cents,
            v_occurred_at
          );

          if v_signing_type = 'sale' then
            insert into public.inventory_movements (
              vendor_id,
              transaction_id,
              transaction_line_id,
              item_id,
              lot_id,
              bucket,
              movement_type,
              quantity_delta,
              cost_delta_cents,
              occurred_at
            )
            values (
              v_vendor_id,
              v_transaction_id,
              v_inserted_line_id,
              v_item_id,
              v_inventory_lot.id,
              'sold',
              'sale',
              v_allocated_quantity,
              v_cost_delta_cents,
              v_occurred_at
            );
          end if;
        end loop;

        if v_total_requested_quantity <> v_quantity then
          raise exception 'Not enough available inventory to allocate % units for item %', v_quantity, v_item_id;
        end if;
      end if;
    end if;
  end loop;

  if jsonb_typeof(v_tax_lines_payload) = 'array' and jsonb_array_length(v_tax_lines_payload) > 0 then
    for v_tax_line in
      select value
      from jsonb_array_elements(v_tax_lines_payload)
    loop
      insert into public.transaction_tax_lines (
        transaction_id,
        label,
        jurisdiction,
        taxable_base_cents,
        rate_bps,
        tax_cents,
        included_in_price
      )
      values (
        v_transaction_id,
        coalesce(nullif(v_tax_line ->> 'label', ''), 'Tax'),
        nullif(v_tax_line ->> 'jurisdiction', ''),
        coalesce((v_tax_line ->> 'taxable_base_cents')::integer, 0),
        coalesce((v_tax_line ->> 'rate_bps')::integer, 0),
        coalesce((v_tax_line ->> 'tax_cents')::integer, 0),
        coalesce((v_tax_line ->> 'included_in_price')::boolean, false)
      );

      v_tax_total_cents := v_tax_total_cents + coalesce((v_tax_line ->> 'tax_cents')::integer, 0);
    end loop;
  elsif v_channel_id is not null and v_channel.default_tax_mode <> 'none' and v_channel.default_tax_rate_bps > 0 then
    v_taxable_base_cents := case
      when v_signing_type in ('purchase', 'trade') then greatest(v_inbound_taxable_base_cents, 0)
      else greatest(v_outbound_taxable_base_cents, 0)
    end;

    if v_channel.default_tax_mode = 'inclusive' then
      v_tax_total_cents := round((v_taxable_base_cents::numeric * v_channel.default_tax_rate_bps::numeric) / (10000 + v_channel.default_tax_rate_bps))::integer;
    else
      v_tax_total_cents := round((v_taxable_base_cents::numeric * v_channel.default_tax_rate_bps::numeric) / 10000)::integer;
    end if;

    if v_tax_total_cents <> 0 then
      insert into public.transaction_tax_lines (
        transaction_id,
        label,
        jurisdiction,
        taxable_base_cents,
        rate_bps,
        tax_cents,
        included_in_price
      )
      values (
        v_transaction_id,
        concat(v_channel.name, ' default tax'),
        null,
        v_taxable_base_cents,
        v_channel.default_tax_rate_bps,
        v_tax_total_cents,
        v_channel.default_tax_mode = 'inclusive'
      );
    end if;
  else
    v_tax_total_cents := v_line_tax_total_cents;
  end if;

  if jsonb_typeof(v_fee_lines_payload) = 'array' and jsonb_array_length(v_fee_lines_payload) > 0 then
    for v_fee_line in
      select value
      from jsonb_array_elements(v_fee_lines_payload)
    loop
      insert into public.transaction_fee_lines (
        transaction_id,
        fee_rule_id,
        fee_type,
        label,
        basis_cents,
        rate_bps,
        flat_fee_cents,
        computed_fee_cents
      )
      values (
        v_transaction_id,
        nullif(v_fee_line ->> 'fee_rule_id', '')::uuid,
        coalesce(nullif(v_fee_line ->> 'fee_type', '')::public.fee_type, 'other'),
        coalesce(nullif(v_fee_line ->> 'label', ''), 'Fee'),
        coalesce((v_fee_line ->> 'basis_cents')::integer, 0),
        coalesce((v_fee_line ->> 'rate_bps')::integer, 0),
        coalesce((v_fee_line ->> 'flat_fee_cents')::integer, 0),
        coalesce((v_fee_line ->> 'computed_fee_cents')::integer, 0)
      );

      if coalesce(nullif(v_fee_line ->> 'fee_type', '')::public.fee_type, 'other') in ('processor', 'channel') then
        v_fee_total_cents := v_fee_total_cents + coalesce((v_fee_line ->> 'computed_fee_cents')::integer, 0);
      else
        v_other_fee_total_cents := v_other_fee_total_cents + coalesce((v_fee_line ->> 'computed_fee_cents')::integer, 0);
      end if;
    end loop;
  elsif v_channel_id is not null then
    v_fee_basis_cents := case
      when v_signing_type = 'purchase' then greatest(v_inbound_subtotal_cents - v_total_discount_cents, 0)
      when v_signing_type = 'trade' then greatest(greatest(v_outbound_subtotal_cents, v_inbound_subtotal_cents) - v_total_discount_cents, 0)
      else greatest(v_outbound_subtotal_cents - v_total_discount_cents, 0)
    end;

    for v_fee_rule in
      select *
      from public.fee_rules fr
      where fr.vendor_id = v_vendor_id
        and fr.channel_id = v_channel_id
        and (fr.active_from is null or fr.active_from <= v_occurred_at)
        and (fr.active_to is null or fr.active_to > v_occurred_at)
      order by fr.priority, fr.id
    loop
      v_line_value_cents := v_fee_basis_cents;

      if v_fee_rule.applies_to_tax then
        v_line_value_cents := v_line_value_cents + v_tax_total_cents;
      end if;

      if not v_fee_rule.applies_to_shipping then
        v_line_value_cents := greatest(v_line_value_cents - v_shipping_basis_cents, 0);
      end if;

      v_cost_delta_cents := round((v_line_value_cents::numeric * v_fee_rule.percent_bps::numeric) / 10000)::integer + v_fee_rule.flat_fee_cents;

      insert into public.transaction_fee_lines (
        transaction_id,
        fee_rule_id,
        fee_type,
        label,
        basis_cents,
        rate_bps,
        flat_fee_cents,
        computed_fee_cents
      )
      values (
        v_transaction_id,
        v_fee_rule.id,
        'processor',
        v_fee_rule.label,
        v_line_value_cents,
        v_fee_rule.percent_bps,
        v_fee_rule.flat_fee_cents,
        v_cost_delta_cents
      );

      v_fee_total_cents := v_fee_total_cents + v_cost_delta_cents;
    end loop;
  end if;

  v_subtotal_cents := case
    when v_signing_type = 'purchase' then v_inbound_subtotal_cents
    when v_signing_type = 'trade' then greatest(v_outbound_subtotal_cents, v_inbound_subtotal_cents)
    when v_signing_type = 'adjustment' then greatest(v_outbound_subtotal_cents, v_inbound_subtotal_cents)
    when v_signing_type = 'transfer' then greatest(v_outbound_subtotal_cents, v_inbound_subtotal_cents)
    else v_outbound_subtotal_cents
  end;

  if v_type = 'trade' then
    v_net_sale_cents := (v_outbound_subtotal_cents - v_inbound_subtotal_cents) - v_total_discount_cents + v_tax_total_cents;
  elsif v_type in ('adjustment', 'transfer') then
    v_net_sale_cents := v_cash_in_cents - v_cash_out_cents;
  else
    v_net_sale_cents := v_subtotal_cents - v_total_discount_cents + v_tax_total_cents;
  end if;

  v_net_payout_cents := v_net_sale_cents - v_fee_total_cents - v_other_fee_total_cents + v_cash_in_cents - v_cash_out_cents;
  v_gross_profit_cents := v_net_payout_cents - v_cost_basis_cents;

  if v_type = 'reversal' then
    v_subtotal_cents := coalesce((v_transaction_payload ->> 'subtotal_cents')::integer, v_subtotal_cents);
    v_total_discount_cents := coalesce((v_transaction_payload ->> 'discount_cents')::integer, v_total_discount_cents);
    v_tax_total_cents := coalesce((v_transaction_payload ->> 'tax_cents')::integer, v_tax_total_cents);
    v_fee_total_cents := coalesce((v_transaction_payload ->> 'fee_cents')::integer, v_fee_total_cents);
    v_other_fee_total_cents := coalesce((v_transaction_payload ->> 'other_fee_cents')::integer, v_other_fee_total_cents);
    v_net_sale_cents := coalesce((v_transaction_payload ->> 'net_sale_cents')::integer, v_net_sale_cents);
    v_net_payout_cents := coalesce((v_transaction_payload ->> 'net_payout_cents')::integer, v_net_payout_cents);
    v_cost_basis_cents := coalesce((v_transaction_payload ->> 'cost_basis_cents')::integer, v_cost_basis_cents);
    v_gross_profit_cents := coalesce((v_transaction_payload ->> 'gross_profit_cents')::integer, v_gross_profit_cents);
  end if;

  update public.transactions
  set
    status = v_status,
    occurred_at = v_occurred_at,
    finalized_at = case when v_status = 'finalized' then v_now else null end,
    channel_id = v_channel_id,
    counterparty_name = v_counterparty_name,
    counterparty_type = v_counterparty_type,
    linked_transaction_id = v_linked_transaction_id,
    reason_code = v_reason_code,
    notes = v_notes,
    cash_in_cents = v_cash_in_cents,
    cash_out_cents = v_cash_out_cents,
    subtotal_cents = v_subtotal_cents,
    discount_cents = v_total_discount_cents,
    tax_cents = v_tax_total_cents,
    fee_cents = v_fee_total_cents,
    other_fee_cents = v_other_fee_total_cents,
    net_sale_cents = v_net_sale_cents,
    net_payout_cents = v_net_payout_cents,
    cost_basis_cents = v_cost_basis_cents,
    gross_profit_cents = v_gross_profit_cents,
    calculation_snapshot_json = v_snapshot,
    created_by = v_actor_user_id
  where id = v_transaction_id;

  perform public.insert_audit_event(
    v_vendor_id,
    'transaction',
    v_transaction_id,
    case
      when v_status = 'finalized' and v_type = 'reversal' then 'reversed'
      when v_status = 'finalized' then 'finalized'
      when v_is_new then 'created'
      else 'updated'
    end,
    v_reason_code,
    v_notes,
    v_before_snapshot,
    (
      select to_jsonb(t)
      from public.transactions t
      where t.id = v_transaction_id
    ),
    v_actor_user_id
  );

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'vendor_id', v_vendor_id,
    'status', v_status,
    'type', v_type,
    'subtotal_cents', v_subtotal_cents,
    'discount_cents', v_total_discount_cents,
    'tax_cents', v_tax_total_cents,
    'fee_cents', v_fee_total_cents,
    'other_fee_cents', v_other_fee_total_cents,
    'net_sale_cents', v_net_sale_cents,
    'net_payout_cents', v_net_payout_cents,
    'cost_basis_cents', v_cost_basis_cents,
    'gross_profit_cents', v_gross_profit_cents
  );
end;
$$;

create or replace function public.adjust_inventory(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_payload jsonb := coalesce(payload -> 'transaction', '{}'::jsonb);
  v_adjustments_payload jsonb := coalesce(payload -> 'adjustments', '[]'::jsonb);
  v_lines jsonb := '[]'::jsonb;
  v_adjustment jsonb;
  v_quantity_delta numeric(12, 3);
begin
  if jsonb_typeof(v_adjustments_payload) <> 'array' or jsonb_array_length(v_adjustments_payload) = 0 then
    raise exception 'payload.adjustments must contain at least one adjustment item';
  end if;

  for v_adjustment in
    select value
    from jsonb_array_elements(v_adjustments_payload)
  loop
    v_quantity_delta := coalesce((v_adjustment ->> 'quantity_delta')::numeric, 0);

    if v_quantity_delta = 0 then
      raise exception 'Adjustment quantity_delta must not be zero';
    end if;

    v_lines := v_lines || jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'line_key', coalesce(nullif(v_adjustment ->> 'line_key', ''), gen_random_uuid()::text),
          'direction', case when v_quantity_delta > 0 then 'inbound' else 'outbound' end,
          'line_kind', coalesce(nullif(v_adjustment ->> 'line_kind', ''), 'adjustment'),
          'item_id', nullif(v_adjustment ->> 'item_id', ''),
          'description', coalesce(nullif(v_adjustment ->> 'description', ''), 'Inventory adjustment'),
          'quantity', abs(v_quantity_delta),
          'unit_price_cents', coalesce((v_adjustment ->> 'unit_price_cents')::integer, 0),
          'unit_cost_cents', coalesce((v_adjustment ->> 'unit_cost_cents')::integer, (v_adjustment ->> 'unit_price_cents')::integer, 0),
          'lot_allocations', v_adjustment -> 'lot_allocations',
          'restore_lot_allocations', v_adjustment -> 'restore_lot_allocations'
        )
      )
    );
  end loop;

  return public.post_transaction(
    jsonb_build_object(
      'transaction',
      v_transaction_payload
      || jsonb_build_object(
        'type', 'adjustment',
        'status', coalesce(v_transaction_payload ->> 'status', 'finalized')
      ),
      'lines',
      v_lines,
      'calculation_snapshot_json',
      coalesce(payload -> 'calculation_snapshot_json', jsonb_build_object('source', 'adjust_inventory'))
    )
  );
end;
$$;

create or replace function public.reverse_transaction(
  transaction_id uuid,
  reason_code public.reason_code,
  note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_vendor_id uuid := public.require_current_vendor_id();
  v_original public.transactions%rowtype;
  v_existing_reversal uuid;
  v_line public.transaction_lines%rowtype;
  v_payload jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_fee_lines jsonb := '[]'::jsonb;
  v_tax_lines jsonb := '[]'::jsonb;
  v_restore_allocations jsonb;
  v_requested_allocations jsonb;
  v_reversal_result jsonb;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication is required to reverse transactions';
  end if;

  select *
  into v_original
  from public.transactions
  where id = transaction_id
    and vendor_id = v_vendor_id
    and status = 'finalized';

  if not found then
    raise exception 'Finalized transaction % was not found for this vendor', transaction_id;
  end if;

  select t.id
  into v_existing_reversal
  from public.transactions t
  where t.linked_transaction_id = v_original.id
    and t.type = 'reversal'
    and t.status = 'finalized'
  limit 1;

  if v_existing_reversal is not null then
    raise exception 'Transaction % has already been reversed by %', transaction_id, v_existing_reversal;
  end if;

  for v_line in
    select *
    from public.transaction_lines
    where transaction_id = v_original.id
    order by created_at, id
  loop
    if v_line.direction = 'outbound' then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'lot_id', la.lot_id,
            'quantity', la.quantity_allocated,
            'unit_cost_cents', la.unit_cost_cents
          )
          order by la.allocation_order
        ),
        '[]'::jsonb
      )
      into v_restore_allocations
      from public.lot_allocations la
      where la.transaction_line_id = v_line.id;

      if v_line.item_id is not null and jsonb_array_length(v_restore_allocations) = 0 then
        raise exception 'Cannot reverse outbound line % because it has no recorded lot allocations', v_line.id;
      end if;

      v_lines := v_lines || jsonb_build_array(
        jsonb_strip_nulls(
          jsonb_build_object(
            'line_key', v_line.id::text,
            'parent_line_key', case when v_line.parent_line_id is null then null else v_line.parent_line_id::text end,
            'direction', 'inbound',
            'line_kind', v_line.line_kind,
            'item_id', v_line.item_id,
            'description', coalesce(v_line.description, 'Reversal'),
            'quantity', v_line.quantity,
            'unit_price_cents', v_line.unit_price_cents,
            'line_subtotal_cents', v_line.line_subtotal_cents,
            'discount_cents', v_line.discount_cents,
            'taxable_base_cents', v_line.taxable_base_cents,
            'tax_cents', v_line.tax_cents,
            'extended_total_cents', v_line.extended_total_cents,
            'restore_lot_allocations', v_restore_allocations
          )
        )
      );
    else
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'lot_id', l.id,
            'quantity', l.original_quantity
          )
          order by l.acquired_at, l.id
        ),
        '[]'::jsonb
      )
      into v_requested_allocations
      from public.inventory_lots l
      where l.source_line_id = v_line.id;

      if v_line.item_id is not null and jsonb_array_length(v_requested_allocations) = 0 then
        raise exception 'Cannot reverse inbound line % because it has no source inventory lots', v_line.id;
      end if;

      v_lines := v_lines || jsonb_build_array(
        jsonb_strip_nulls(
          jsonb_build_object(
            'line_key', v_line.id::text,
            'parent_line_key', case when v_line.parent_line_id is null then null else v_line.parent_line_id::text end,
            'direction', 'outbound',
            'line_kind', v_line.line_kind,
            'item_id', v_line.item_id,
            'description', coalesce(v_line.description, 'Reversal'),
            'quantity', v_line.quantity,
            'unit_price_cents', v_line.unit_price_cents,
            'line_subtotal_cents', v_line.line_subtotal_cents,
            'discount_cents', v_line.discount_cents,
            'taxable_base_cents', v_line.taxable_base_cents,
            'tax_cents', v_line.tax_cents,
            'extended_total_cents', v_line.extended_total_cents,
            'lot_allocations', v_requested_allocations
          )
        )
      );
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'fee_rule_id', fee_rule_id,
        'fee_type', fee_type,
        'label', label,
        'basis_cents', basis_cents,
        'rate_bps', rate_bps,
        'flat_fee_cents', flat_fee_cents,
        'computed_fee_cents', computed_fee_cents
      )
      order by created_at, id
    ),
    '[]'::jsonb
  )
  into v_fee_lines
  from public.transaction_fee_lines
  where transaction_id = v_original.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', label,
        'jurisdiction', jurisdiction,
        'taxable_base_cents', taxable_base_cents,
        'rate_bps', rate_bps,
        'tax_cents', tax_cents,
        'included_in_price', included_in_price
      )
      order by created_at, id
    ),
    '[]'::jsonb
  )
  into v_tax_lines
  from public.transaction_tax_lines
  where transaction_id = v_original.id;

  v_payload := jsonb_build_object(
    'transaction',
    jsonb_build_object(
      'type', 'reversal',
      'status', 'finalized',
      'occurred_at', timezone('utc', now()),
      'channel_id', v_original.channel_id,
      'counterparty_name', v_original.counterparty_name,
      'counterparty_type', v_original.counterparty_type,
      'linked_transaction_id', v_original.id,
      'reason_code', reason_code,
      'notes', coalesce(note, concat('Reversal of transaction ', v_original.id)),
      'cash_in_cents', v_original.cash_out_cents,
      'cash_out_cents', v_original.cash_in_cents,
      'subtotal_cents', v_original.subtotal_cents,
      'discount_cents', v_original.discount_cents,
      'tax_cents', v_original.tax_cents,
      'fee_cents', v_original.fee_cents,
      'other_fee_cents', v_original.other_fee_cents,
      'net_sale_cents', v_original.net_sale_cents,
      'net_payout_cents', v_original.net_payout_cents,
      'cost_basis_cents', v_original.cost_basis_cents,
      'gross_profit_cents', v_original.gross_profit_cents
    ),
    'lines',
    v_lines,
    'fee_lines',
    v_fee_lines,
    'tax_lines',
    v_tax_lines,
    'calculation_snapshot_json',
    jsonb_build_object(
      'reversal_of', v_original.id,
      'original_type', v_original.type
    )
  );

  v_reversal_result := public.post_transaction(v_payload);

  perform public.insert_audit_event(
    v_vendor_id,
    'transaction',
    v_original.id,
    'reversed',
    reason_code,
    coalesce(note, concat('Reversed by transaction ', v_reversal_result ->> 'transaction_id')),
    to_jsonb(v_original),
    jsonb_build_object('reversal_transaction_id', v_reversal_result ->> 'transaction_id'),
    v_actor_user_id
  );

  return v_reversal_result;
end;
$$;

grant execute on function public.post_transaction(jsonb) to authenticated;
grant execute on function public.adjust_inventory(jsonb) to authenticated;
grant execute on function public.reverse_transaction(uuid, public.reason_code, text) to authenticated;
