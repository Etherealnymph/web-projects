-- Read-only verification, run in Supabase SQL Editor AFTER the upgrade.
select version();

-- All eleven rows should be present; security_definer must be false.
select p.proname, p.prosecdef as security_definer,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
       p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'insight_active', 'insight_matching_content', 'insight_content_metrics',
  'insight_content_page', 'insight_content_facets', 'insight_content_summary', 'insight_modules',
  'insight_toggle_reaction', 'insight_search_members', 'insight_message_page', 'insight_threads'
)
order by p.proname;

-- Expect 12 indexes, all valid.
select i.relname as index_name, x.indisvalid as valid
from pg_class i join pg_index x on x.indexrelid = i.oid
join pg_namespace n on n.oid = i.relnamespace
where n.nspname = 'public' and i.relname like 'insight_%_idx'
order by i.relname;

-- Both views should include security_invoker=true.
select relname, reloptions from pg_class
where oid in ('public.content_stats'::regclass, 'public.comment_stats'::regclass);

-- All existing user-data tables should still have RLS enabled.
select relname, relrowsecurity from pg_class
where oid in (
  'public.profiles'::regclass, 'public.modules'::regclass, 'public.contents'::regclass,
  'public.comments'::regclass, 'public.reactions'::regclass, 'public.grants'::regclass,
  'public.invites'::regclass, 'public.friendships'::regclass, 'public.messages'::regclass
)
order by relname;

-- This count is for migration comparison only; SQL Editor's postgres role bypasses RLS.
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.contents) as contents,
  (select count(*) from public.comments) as comments,
  (select count(*) from public.messages) as messages,
  (select count(*) from public.reactions) as reactions;

-- Do not test RPC authorization as postgres. Use two ordinary browser accounts,
-- or run the automated isolation tests described in docs/SUPABASE_UPGRADE_2026-11.md.
