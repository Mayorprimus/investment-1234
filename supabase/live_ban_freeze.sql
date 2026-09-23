-- live_ban_freeze.sql
-- Idempotent: adds admin_update_user_status RPC + grant
-- Run in Supabase SQL Editor to enable Ban/Freeze user status

-- Admin updates user status (Active/Frozen/Banned/Pending KYC)
create or replace function public.admin_update_user_status(p_user_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required'); end if;
  if p_status not in ('Active','Frozen','Banned','Pending KYC') then
    return jsonb_build_object('ok', false, 'error', 'Invalid status');
  end if;
  update public.profiles set status = p_status, updated_at = now() where id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'User not found'); end if;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_update_user_status to authenticated;