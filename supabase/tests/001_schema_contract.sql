do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    raise exception 'Expected enum transaction_type to exist';
  end if;

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'transactions') then
    raise exception 'Expected table public.transactions to exist';
  end if;

  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory_lots') then
    raise exception 'Expected table public.inventory_lots to exist';
  end if;

  if not exists (select 1 from information_schema.routines where routine_schema = 'public' and routine_name = 'post_transaction') then
    raise exception 'Expected function public.post_transaction to exist';
  end if;

  if not exists (select 1 from information_schema.routines where routine_schema = 'public' and routine_name = 'reverse_transaction') then
    raise exception 'Expected function public.reverse_transaction to exist';
  end if;

  if not exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'v_inventory_position') then
    raise exception 'Expected view public.v_inventory_position to exist';
  end if;

  if not exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'v_reconciliation_summary') then
    raise exception 'Expected view public.v_reconciliation_summary to exist';
  end if;
end
$$;
