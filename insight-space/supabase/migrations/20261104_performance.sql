-- Insight Space · 2026-11 performance upgrade
-- Existing project: apply this AFTER the repository's base supabase/schema.sql.
-- SQL Editor: run this complete file. It is transactional and safe to re-run.
-- PostgreSQL 15+; no existing content, accounts, media, or messages are deleted.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if current_setting('server_version_num')::integer < 150000 then
    raise exception 'PostgreSQL 15 or newer is required (security_invoker views).';
  end if;
  if to_regclass('public.contents') is null or to_regclass('public.messages') is null
     or to_regprocedure('public.has_content_read(uuid,timestamp with time zone)') is null then
    raise exception 'Run the current supabase/schema.sql before this migration.';
  end if;
end $$;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- Stable page ordering, scoped feeds, favorites, and unread message counters.
create index if not exists insight_contents_created_id_idx on public.contents (created_at desc, id desc);
create index if not exists insight_contents_module_page_idx on public.contents (module_id, created_at desc, id desc);
create index if not exists insight_contents_author_page_idx on public.contents (author_id, created_at desc, id desc);
create index if not exists insight_contents_tags_idx on public.contents using gin (tags jsonb_path_ops);
create index if not exists insight_reactions_user_kind_idx on public.reactions (user_id, kind, target_type, target_id);
create index if not exists insight_messages_unread_idx on public.messages (to_id, from_id) where read_at is null;
create index if not exists insight_messages_page_idx on public.messages (from_id, to_id, created_at desc, id desc);
create index if not exists insight_grants_invite_user_idx on public.grants (invite_id, user_id);
create index if not exists insight_comments_author_idx on public.comments (author_id, created_at desc, id desc);
create index if not exists insight_comments_parent_idx on public.comments (parent_id);

-- Honor the existing extension schema when pg_trgm was already installed elsewhere.
do $$
declare extension_schema text;
begin
  select n.nspname into extension_schema
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  execute format(
    'create index if not exists insight_contents_search_idx on public.contents using gin ((title || chr(10) || body_md || chr(10) || tags::text) %I.gin_trgm_ops)',
    extension_schema);
  execute format(
    'create index if not exists insight_profiles_search_idx on public.profiles using gin ((username || chr(10) || nickname) %I.gin_trgm_ops)',
    extension_schema);
end $$;

-- Counts must obey the same visibility rules as the target content.
alter view public.content_stats set (security_invoker = true);
alter view public.comment_stats set (security_invoker = true);

create or replace function public.insight_active()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

-- Shared RLS-filtered search. Only small ranking fields are materialized; bodies are
-- fetched after LIMIT. Search text is a bound argument with literal %/_ semantics.
create or replace function public.insight_matching_content(p_options jsonb default '{}'::jsonb)
returns table (id uuid, created_at timestamptz, views integer)
language sql stable security invoker set search_path = '' as $$
  with args as (
    select
      nullif(p_options->>'module_id', '')::uuid as module_id,
      (select array_agg(value::uuid)
       from jsonb_array_elements_text(
         case when jsonb_typeof(p_options->'module_ids') = 'array' then p_options->'module_ids' else '[]'::jsonb end
       )) as module_ids,
      nullif(p_options->>'author_id', '')::uuid as author_id,
      nullif(p_options->>'favorites_of', '')::uuid as favorites_of,
      nullif(p_options->>'date_from', '')::timestamptz as date_from,
      nullif(p_options->>'date_to', '')::timestamptz as date_to,
      nullif(p_options->>'tag', '') as tag,
      left(btrim(coalesce(p_options->>'q', '')), 200) as needle
  ), search_args as (
    select *, '%' || replace(replace(replace(needle, chr(92), chr(92) || chr(92)),
      '%', chr(92) || '%'), '_', chr(92) || '_') || '%' as pattern from args
  )
  select c.id, c.created_at, c.views
  from public.contents c cross join search_args a
  where (select public.insight_active())
    and public.has_module_access(c.module_id)
    and (c.status <> 'draft' or c.author_id = (select auth.uid()))
    and (a.module_id is null or c.module_id = a.module_id)
    and (a.module_ids is null or a.module_id is not null or c.module_id = any(a.module_ids))
    and (a.author_id is null or c.author_id = a.author_id)
    and (a.date_from is null or c.created_at >= a.date_from)
    and (a.date_to is null or c.created_at <= a.date_to)
    and (a.tag is null or c.tags @> jsonb_build_array(a.tag))
    and (a.needle = '' or (c.title || chr(10) || c.body_md || chr(10) || c.tags::text) ilike a.pattern escape chr(92))
    and (a.favorites_of is null or (a.favorites_of = (select auth.uid()) and exists (
      select 1 from public.reactions r
      where r.user_id = (select auth.uid()) and r.kind = 'favorite'
        and r.target_type = 'content' and r.target_id = c.id
    )));
$$;

create or replace function public.insight_content_metrics(p_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'content_id', c.id,
    'counts', jsonb_build_object('like', r.likes, 'dislike', r.dislikes, 'favorite', r.favorites, 'comment', cm.comments),
    'mine', jsonb_build_object('like', r.mine_like, 'dislike', r.mine_dislike, 'favorite', r.mine_favorite)
  )), '[]'::jsonb)
  from public.contents c
  cross join lateral (
    select count(*) filter (where x.kind = 'like') as likes,
      count(*) filter (where x.kind = 'dislike') as dislikes,
      count(*) filter (where x.kind = 'favorite') as favorites,
      coalesce(bool_or(x.user_id = (select auth.uid()) and x.kind = 'like'), false) as mine_like,
      coalesce(bool_or(x.user_id = (select auth.uid()) and x.kind = 'dislike'), false) as mine_dislike,
      coalesce(bool_or(x.user_id = (select auth.uid()) and x.kind = 'favorite'), false) as mine_favorite
    from public.reactions x where x.target_type = 'content' and x.target_id = c.id
  ) r
  cross join lateral (select count(*) as comments from public.comments x where x.content_id = c.id) cm
  where c.id = any(p_ids[1:200]) and (select public.insight_active());
$$;

create or replace function public.insight_content_page(p_options jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_sort text := coalesce(p_options->>'sort', 'new');
  v_limit integer := least(100, greatest(1, coalesce((p_options->>'limit')::integer, 24)));
  v_offset integer := greatest(0, coalesce((p_options->>'offset')::integer, 0));
  v_result jsonb;
begin
  if not public.insight_active() then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_sort not in ('new', 'old', 'hot', 'like') then v_sort := 'new'; end if;
  with matching as materialized (
    select * from public.insight_matching_content(p_options)
  ), ranked as (
    select m.*, r.likes,
      (r.likes * 3 + r.favorites * 2.5 + cm.comments * 2.5 - r.dislikes * 1.5 + m.views * 0.12)
        / power(greatest(0, extract(epoch from (now() - m.created_at)) / 3600) + 2, 0.65) as score
    from matching m
    cross join lateral (
      select count(*) filter (where x.kind = 'like') as likes,
        count(*) filter (where x.kind = 'dislike') as dislikes,
        count(*) filter (where x.kind = 'favorite') as favorites
      from public.reactions x
      where v_sort in ('hot', 'like') and x.target_type = 'content' and x.target_id = m.id
    ) r
    cross join lateral (
      select count(*) as comments from public.comments x
      where v_sort in ('hot', 'like') and x.content_id = m.id
    ) cm
  ), selected as materialized (
    select * from ranked
    order by
      case when v_sort = 'like' then likes end desc,
      case when v_sort in ('hot', 'like') then score end desc,
      case when v_sort = 'old' then created_at end asc,
      created_at desc, id desc
    limit v_limit offset v_offset
  ), metrics as (
    select (item->>'content_id')::uuid as id, item->'counts' as counts, item->'mine' as mine
    from jsonb_array_elements(public.insight_content_metrics(array(select id from selected))) item
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        to_jsonb(c) || jsonb_build_object(
          'counts', x.counts, 'mine', x.mine,
          'author', jsonb_build_object('id', p.id, 'username', p.username, 'nickname', p.nickname,
            'avatar', p.avatar, 'role', p.role, 'status', p.status, 'exp', p.exp, 'created_at', p.created_at)
        )
        order by
          case when v_sort = 'like' then s.likes end desc,
          case when v_sort in ('hot', 'like') then s.score end desc,
          case when v_sort = 'old' then s.created_at end asc,
          s.created_at desc, s.id desc
      )
      from selected s join public.contents c on c.id = s.id
      left join public.profiles p on p.id = c.author_id left join metrics x on x.id = s.id
    ), '[]'::jsonb),
    'total', (select count(*) from matching),
    'has_more', v_offset + v_limit < (select count(*) from matching)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.insight_content_facets(p_options jsonb default '{}'::jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with matching as materialized (
    select c.author_id, c.tags
    from public.insight_matching_content(p_options) m join public.contents c on c.id = m.id
  )
  select jsonb_build_object(
    'authors', coalesce((
      select jsonb_agg(jsonb_build_object('value', p.id, 'label', coalesce(nullif(p.nickname, ''), p.username),
        'username', p.username) order by coalesce(nullif(p.nickname, ''), p.username), p.id)
      from public.profiles p where p.id in (select author_id from matching)
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(tag order by tag) from (
        select distinct tag from matching m cross join lateral jsonb_array_elements_text(m.tags) tag
      ) t
    ), '[]'::jsonb)
  );
$$;

create or replace function public.insight_content_summary(p_options jsonb default '{}'::jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with matching as materialized (
    select id from public.insight_matching_content(p_options)
  )
  select jsonb_build_object(
    'total', (select count(*) from matching),
    'likes', count(*) filter (where r.kind = 'like'),
    'favorites', count(*) filter (where r.kind = 'favorite')
  )
  from public.reactions r join matching m on m.id = r.target_id
  where r.target_type = 'content';
$$;

create or replace function public.insight_modules()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(
    to_jsonb(m) || jsonb_build_object('content_count', n.contents,
      'can_read', public.has_module_access(m.id), 'can_write', public.has_module_write(m.id))
    order by m.sort, m.created_at, m.id
  ), '[]'::jsonb)
  from public.modules m
  cross join lateral (
    select count(*) as contents from public.contents c where c.module_id = m.id and c.status = 'published'
  ) n
  where (select public.insight_active());
$$;

-- A single transaction prevents a failed insert from silently removing a prior
-- vote. The advisory lock serializes simultaneous toggles for the same user/target.
create or replace function public.insight_toggle_reaction(p_target_type text, p_target_id uuid, p_kind text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if not public.insight_active() then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_target_type not in ('content', 'comment') or p_kind not in ('like', 'dislike', 'favorite')
     or p_target_type is null or p_kind is null or p_target_id is null then
    raise exception 'invalid_reaction' using errcode = '22023';
  end if;
  if (p_target_type = 'content' and not exists (select 1 from public.contents c where c.id = p_target_id))
     or (p_target_type = 'comment' and not exists (select 1 from public.comments c where c.id = p_target_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || '/' || p_target_type || '/' || p_target_id::text, 0));
  if exists (select 1 from public.reactions r where r.user_id = v_uid
      and r.target_type = p_target_type and r.target_id = p_target_id and r.kind = p_kind) then
    delete from public.reactions r where r.user_id = v_uid
      and r.target_type = p_target_type and r.target_id = p_target_id and r.kind = p_kind;
    return false;
  end if;
  if p_kind <> 'favorite' then
    delete from public.reactions r where r.user_id = v_uid and r.target_type = p_target_type
      and r.target_id = p_target_id and r.kind in ('like', 'dislike');
  end if;
  insert into public.reactions(user_id, target_type, target_id, kind)
    values (v_uid, p_target_type, p_target_id, p_kind);
  return true;
end $$;

-- Existing RPC name retained. It must check access even though it needs elevated
-- permission to increment a readable article belonging to another author.
create or replace function public.increment_view(p_content_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.contents set views = views + 1
  where id = p_content_id and views < 2147483647
    and public.insight_active() and public.can_read_content(p_content_id);
$$;
revoke all on function public.increment_view(uuid) from public, anon;
grant execute on function public.increment_view(uuid) to authenticated;

create or replace function public.insight_search_members(p_query text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with args as (
    select left(btrim(coalesce(p_query, '')), 80) as needle
  ), selected as (
    select p.*
    from public.profiles p cross join args a
    where (select public.insight_active()) and p.id <> (select auth.uid()) and p.status = 'active'
      and a.needle <> ''
      and (p.username || chr(10) || p.nickname) ilike
        '%' || replace(replace(replace(a.needle, chr(92), chr(92) || chr(92)),
          '%', chr(92) || '%'), '_', chr(92) || '_') || '%' escape chr(92)
    order by p.username, p.id limit 20
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'profile', jsonb_build_object('id', p.id, 'username', p.username, 'nickname', p.nickname,
      'avatar', p.avatar, 'bio', p.bio, 'role', p.role, 'status', p.status, 'exp', p.exp, 'created_at', p.created_at),
    'relation', case when f.status = 'accepted' then 'accepted'
      when f.status = 'pending' and f.requester_id = (select auth.uid()) then 'pending_out'
      when f.status = 'pending' then 'pending_in' else 'none' end
  ) order by p.username, p.id), '[]'::jsonb)
  from selected p
  left join lateral (
    select x.status, x.requester_id from public.friendships x
    where (x.requester_id = (select auth.uid()) and x.addressee_id = p.id)
       or (x.addressee_id = (select auth.uid()) and x.requester_id = p.id)
    order by (x.status = 'accepted') desc, x.updated_at desc, x.id desc limit 1
  ) f on true;
$$;

create or replace function public.insight_message_page(
  p_peer uuid, p_limit integer default 100,
  p_before_time timestamptz default null, p_before_id uuid default null
)
returns setof public.messages language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.insight_active() then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.are_friends(p_peer) then raise exception 'friend.needFriend' using errcode = '42501'; end if;
  return query select m.* from public.messages m
  where ((m.from_id = auth.uid() and m.to_id = p_peer) or (m.from_id = p_peer and m.to_id = auth.uid()))
    and (p_before_time is null or m.created_at < p_before_time
      or (m.created_at = p_before_time and p_before_id is not null and m.id < p_before_id))
  order by m.created_at desc, m.id desc limit least(100, greatest(1, coalesce(p_limit, 100)));
end $$;

create or replace function public.insight_threads()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with partners as (
    select case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end as id,
      max(f.updated_at) as since
    from public.friendships f
    where (select public.insight_active()) and f.status = 'accepted'
      and (f.requester_id = (select auth.uid()) or f.addressee_id = (select auth.uid()))
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user', jsonb_build_object('id', p.id, 'username', p.username, 'nickname', p.nickname,
      'avatar', p.avatar, 'role', p.role, 'status', p.status, 'exp', p.exp, 'created_at', p.created_at),
    'since', f.since, 'unread', u.unread,
    'last', case when last_message.id is null then null else jsonb_build_object(
      'bodyMd', left(last_message.body_md, 240), 'media', last_message.media,
      'createdAt', last_message.created_at, 'fromId', last_message.from_id) end
  ) order by coalesce(last_message.created_at, f.since) desc, p.id), '[]'::jsonb)
  from partners f join public.profiles p on p.id = f.id
  left join lateral (
    select m.* from public.messages m
    where (m.from_id = (select auth.uid()) and m.to_id = f.id)
       or (m.to_id = (select auth.uid()) and m.from_id = f.id)
    order by m.created_at desc, m.id desc limit 1
  ) last_message on true
  cross join lateral (
    select count(*) as unread from public.messages m
    where m.to_id = (select auth.uid()) and m.from_id = f.id and m.read_at is null
  ) u;
$$;

-- Only logged-in callers may use the new APIs. Each read remains SECURITY INVOKER.
revoke all on function public.insight_active() from public, anon;
revoke all on function public.insight_matching_content(jsonb) from public, anon;
revoke all on function public.insight_content_metrics(uuid[]) from public, anon;
revoke all on function public.insight_content_page(jsonb) from public, anon;
revoke all on function public.insight_content_facets(jsonb) from public, anon;
revoke all on function public.insight_content_summary(jsonb) from public, anon;
revoke all on function public.insight_modules() from public, anon;
revoke all on function public.insight_toggle_reaction(text, uuid, text) from public, anon;
revoke all on function public.insight_search_members(text) from public, anon;
revoke all on function public.insight_message_page(uuid, integer, timestamptz, uuid) from public, anon;
revoke all on function public.insight_threads() from public, anon;
grant execute on function public.insight_active() to authenticated;
grant execute on function public.insight_matching_content(jsonb) to authenticated;
grant execute on function public.insight_content_metrics(uuid[]) to authenticated;
grant execute on function public.insight_content_page(jsonb) to authenticated;
grant execute on function public.insight_content_facets(jsonb) to authenticated;
grant execute on function public.insight_content_summary(jsonb) to authenticated;
grant execute on function public.insight_modules() to authenticated;
grant execute on function public.insight_toggle_reaction(text, uuid, text) to authenticated;
grant execute on function public.insight_search_members(text) to authenticated;
grant execute on function public.insight_message_page(uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function public.insight_threads() to authenticated;

notify pgrst, 'reload schema';
commit;
