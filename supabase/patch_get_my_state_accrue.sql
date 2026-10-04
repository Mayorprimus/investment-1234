-- Safe standalone patch: makes get_my_state() fire the daily yield tick
-- (accrue_investments) on every user's app request. Idempotent: the 23h
-- last_accrued_at guard means running this repeatedly never double-credits.
-- Run this ONCE in the Supabase SQL editor.

create or replace function public.get_my_state()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v jsonb;
begin
  if auth.uid() is null then return null; end if;
  begin
    perform public.accrue_investments();
  exception when others then null; end;
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'investments', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from investments i where i.user_id = p.id), '[]'::jsonb),
    'p2pTrades', coalesce((select jsonb_agg(to_jsonb(t) order by t.submitted_at desc nulls last) from p2p_trades t where lower(t.buyer_email) = lower(p.email)), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(pm) order by pm.created_at desc) from payments pm where pm.user_id = p.id), '[]'::jsonb),
    'withdrawals', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from withdrawal_requests w where w.user_id = p.id), '[]'::jsonb)
  )
  into v from profiles p where p.id = auth.uid();
  return v;
end $$;
