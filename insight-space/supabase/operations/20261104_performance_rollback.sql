-- First roll the FRONTEND back to the pre-upgrade version.
-- Intentionally outside migrations/: never run rollback as a forward migration.
-- Removes the APIs/indexes introduced by 20261104_performance.sql; preserves all data.
-- The existing statistics views keep SECURITY INVOKER, and the existing view
-- counter keeps its permission check. These safety corrections are not undone.
begin;
set local lock_timeout = '5s';

create or replace function public.increment_view(p_content_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.contents set views = views + 1
  where id = p_content_id and views < 2147483647
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'active')
    and public.can_read_content(p_content_id);
$$;
revoke all on function public.increment_view(uuid) from public, anon;
grant execute on function public.increment_view(uuid) to authenticated;

drop function if exists public.insight_content_page(jsonb);
drop function if exists public.insight_content_facets(jsonb);
drop function if exists public.insight_content_summary(jsonb);
drop function if exists public.insight_modules();
drop function if exists public.insight_content_metrics(uuid[]);
drop function if exists public.insight_matching_content(jsonb);
drop function if exists public.insight_toggle_reaction(text, uuid, text);
drop function if exists public.insight_search_members(text);
drop function if exists public.insight_message_page(uuid, integer, timestamptz, uuid);
drop function if exists public.insight_threads();
drop function if exists public.insight_active();

drop index if exists public.insight_contents_created_id_idx;
drop index if exists public.insight_contents_module_page_idx;
drop index if exists public.insight_contents_author_page_idx;
drop index if exists public.insight_contents_tags_idx;
drop index if exists public.insight_contents_search_idx;
drop index if exists public.insight_profiles_search_idx;
drop index if exists public.insight_reactions_user_kind_idx;
drop index if exists public.insight_messages_unread_idx;
drop index if exists public.insight_messages_page_idx;
drop index if exists public.insight_grants_invite_user_idx;
drop index if exists public.insight_comments_author_idx;
drop index if exists public.insight_comments_parent_idx;
-- Keep pg_trgm: another application may use the same extension.
notify pgrst, 'reload schema';
commit;
