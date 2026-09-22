-- live_tasks_admin.sql
-- Idempotent task system: tables, functions, grants, seed
-- Run this once in Supabase SQL Editor to enable the full Tasks & Rewards feature
-- (safe to re-run; uses CREATE OR REPLACE / IF NOT EXISTS)

-- 1. Tables
create table if not exists public.social_tasks (
  id text primary key,
  title text not null,
  platform text not null,
  url text not null,
  description text,
  reward_xena numeric not null,
  max_completions int default null,
  current_completions int default 0,
  status text default 'active',
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id text not null references public.social_tasks(id) on delete cascade,
  social_handle text not null,
  proof_url text,
  status text default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists task_submissions_user_idx on public.task_submissions(user_id);
create index if not exists task_submissions_status_idx on public.task_submissions(status);

-- 2. Functions
-- Submit task completion (user)
create or replace function public.submit_task(p_task_id text, p_social_handle text, p_proof_url text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); v_task public.social_tasks%rowtype; v_count int;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  select * into v_task from public.social_tasks where id = p_task_id and status = 'active';
  if v_task is null then return jsonb_build_object('ok', false, 'error', 'Task not found or inactive'); end if;
  select count(*) into v_count from public.task_submissions where user_id = u and task_id = p_task_id and status in ('pending','approved');
  if v_count > 0 then return jsonb_build_object('ok', false, 'error', 'You have already submitted this task'); end if;
  -- Global daily limit (1000 submissions/day across all users)
  select count(*) into v_count from public.task_submissions where created_at >= now() - interval '24 hours';
  if v_count >= 1000 then return jsonb_build_object('ok', false, 'error', 'Daily submission limit reached. Try again tomorrow.'); end if;
  insert into public.task_submissions (user_id, task_id, social_handle, proof_url)
  values (u, p_task_id, p_social_handle, p_proof_url);
  return jsonb_build_object('ok', true, 'message', 'Submitted for admin review');
end $$;

-- Admin approves/rejects submission
create or replace function public.admin_review_task(p_submission_id uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); v_sub public.task_submissions%rowtype; v_task public.social_tasks%rowtype;
    v_profile public.profiles%rowtype; v_bal jsonb; v_amt numeric;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required'); end if;
  select * into v_sub from public.task_submissions where id = p_submission_id;
  if v_sub is null then return jsonb_build_object('ok', false, 'error', 'Submission not found'); end if;
  if v_sub.status != 'pending' then return jsonb_build_object('ok', false, 'error', 'Already reviewed'); end if;

  select * into v_task from public.social_tasks where id = v_sub.task_id;
  select * into v_profile from public.profiles where id = v_sub.user_id;

  if p_approve then
    v_amt := v_task.reward_xena;
    v_bal := v_profile.balances;
    v_bal := jsonb_set(v_bal, '{availableXena}', ((v_bal->>'availableXena')::numeric + v_amt)::numeric::text::jsonb);
    v_bal := jsonb_set(v_bal, '{totalXena}', ((v_bal->>'totalXena')::numeric + v_amt)::numeric::text::jsonb);
    v_bal := jsonb_set(v_bal, '{totalBalance}', ((v_bal->>'totalBalance')::numeric + v_amt)::numeric::text::jsonb);
    update public.profiles set balances = v_bal, updated_at = now() where id = v_sub.user_id;
    update public.social_tasks set current_completions = current_completions + 1 where id = v_task.id;
    update public.task_submissions set status = 'approved', admin_note = p_note, reviewed_by = u, reviewed_at = now() where id = p_submission_id;
    return jsonb_build_object('ok', true, 'rewarded', v_amt);
  else
    update public.task_submissions set status = 'rejected', admin_note = p_note, reviewed_by = u, reviewed_at = now() where id = p_submission_id;
    return jsonb_build_object('ok', true, 'rejected', true);
  end if;
end $$;

-- Admin gets all submissions (for Tasks tab)
create or replace function public.admin_get_task_submissions()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_subs jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required'); end if;
  select jsonb_agg(to_jsonb(s) order by s.created_at desc) into v_subs
  from (
    select ts.*, p.name as user_name, p.email as user_email, st.title as task_title, st.platform as task_platform, st.reward_xena as task_reward
    from public.task_submissions ts
    join public.profiles p on p.id = ts.user_id
    join public.social_tasks st on st.id = ts.task_id
  ) s;
  return jsonb_build_object('ok', true, 'submissions', coalesce(v_subs, '[]'::jsonb));
end $$;

-- Public gets active tasks (user-facing)
create or replace function public.get_social_tasks()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tasks jsonb;
begin
  select jsonb_agg(to_jsonb(t) order by t.sort_order asc) into v_tasks
  from public.social_tasks t
  where t.status = 'active';
  return jsonb_build_object('ok', true, 'tasks', coalesce(v_tasks, '[]'::jsonb));
end $$;

-- User gets their submissions
create or replace function public.get_my_task_submissions()
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); v_subs jsonb;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  select jsonb_agg(to_jsonb(s) order by s.created_at desc) into v_subs
  from (
    select ts.*, st.title as task_title, st.platform as task_platform, st.reward_xena as task_reward, st.url as task_url
    from public.task_submissions ts
    join public.social_tasks st on st.id = ts.task_id
    where ts.user_id = u
  ) s;
  return jsonb_build_object('ok', true, 'submissions', coalesce(v_subs, '[]'::jsonb));
end $$;

-- Admin deletes a task from catalog
create or replace function public.admin_delete_task(p_task_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required'); end if;
  delete from public.social_tasks where id = p_task_id;
  return jsonb_build_object('ok', true, 'deleted', p_task_id);
end $$;

-- Admin adds a new task to catalog
create or replace function public.admin_add_task(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  new_id text;
  max_sort int;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required'); end if;
  new_id := coalesce(payload->>'id', 'task-' || substr(gen_random_uuid()::text, 1, 8));
  select coalesce(max(sort_order), 0) + 1 into max_sort from public.social_tasks;
  insert into public.social_tasks (id, title, platform, url, description, reward_xena, max_completions, status, sort_order)
  values (
    new_id,
    payload->>'title',
    payload->>'platform',
    payload->>'url',
    coalesce(payload->>'description', ''),
    coalesce((payload->>'rewardXena')::numeric, 30),
    coalesce((payload->>'maxCompletions')::int, null),
    coalesce(payload->>'status', 'active'),
    max_sort
  );
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

-- Admin gets all tasks (including inactive) for management
create or replace function public.admin_get_tasks()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tasks jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required'); end if;
  select jsonb_agg(to_jsonb(t) order by t.sort_order asc) into v_tasks
  from public.social_tasks t;
  return jsonb_build_object('ok', true, 'tasks', coalesce(v_tasks, '[]'::jsonb));
end $$;

-- 3. Grants
grant execute on function public.submit_task to authenticated;
grant execute on function public.admin_review_task to authenticated;
grant execute on function public.admin_get_task_submissions to authenticated;
grant execute on function public.admin_delete_task to authenticated;
grant execute on function public.admin_add_task to authenticated;
grant execute on function public.admin_get_tasks to authenticated;
grant execute on function public.get_social_tasks to anon, authenticated;
grant execute on function public.get_my_task_submissions to authenticated;

grant select on table public.social_tasks to anon, authenticated;
grant select on table public.task_submissions to authenticated;

-- 4. Seed — 7 platform tasks (30 XENA each)
insert into public.social_tasks (id, title, platform, url, description, reward_xena, sort_order) values
  ('task-twitter', 'Follow @XenaNetwork on Twitter', 'twitter', 'https://twitter.com/XenaNetwork', 'Follow our official X (Twitter) account and submit your @handle', 30, 1),
  ('task-telegram', 'Join Xena Community on Telegram', 'telegram', 'https://t.me/XenaNetwork', 'Join our Telegram group and submit your @username', 30, 2),
  ('task-youtube', 'Subscribe to Xena YouTube Channel', 'youtube', 'https://youtube.com/@XenaNetwork', 'Subscribe to our YouTube channel and submit your channel name', 30, 3),
  ('task-instagram', 'Follow @XenaNetwork on Instagram', 'instagram', 'https://instagram.com/XenaNetwork', 'Follow our Instagram and submit your @handle', 30, 4),
  ('task-discord', 'Join Xena Discord Server', 'discord', 'https://discord.gg/XenaNetwork', 'Join our Discord and submit your username#tag', 30, 5),
  ('task-tiktok', 'Follow @XenaNetwork on TikTok', 'tiktok', 'https://tiktok.com/@XenaNetwork', 'Follow our TikTok and submit your @handle', 30, 6),
  ('task-linkedin', 'Follow Xena Network on LinkedIn', 'custom', 'https://linkedin.com/company/XenaNetwork', 'Follow our LinkedIn page and submit your profile URL', 30, 7)
on conflict (id) do update set
  title = excluded.title,
  platform = excluded.platform,
  url = excluded.url,
  description = excluded.description,
  reward_xena = excluded.reward_xena,
  sort_order = excluded.sort_order;