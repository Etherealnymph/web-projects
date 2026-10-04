-- ============================================================
-- 体悟集 · Insight — Supabase 数据库结构
-- 用法：Supabase 控制台 → SQL Editor → 粘贴全文 → Run（可重复执行）
-- 依赖：auth schema（Supabase 内置）、pgcrypto / storage 扩展
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. 数据表
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  nickname text not null default '',
  role text not null default 'member' check (role in ('superadmin','owner','member')),
  bio text not null default '',
  avatar text not null default '',
  status text not null default 'active' check (status in ('active','disabled')),
  invite_id uuid,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_zh text not null default '',
  name_en text not null default '',
  desc_zh text not null default '',
  desc_en text not null default '',
  icon text not null default '❖',
  sort integer not null default 99,
  hot boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null default '通用',
  module_ids uuid[],
  all_modules boolean not null default true,
  write boolean not null default true,
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  used_by uuid[] not null default '{}',
  note text not null default '',
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_invite_id_fkey;
alter table public.profiles add constraint profiles_invite_id_fkey
  foreign key (invite_id) references public.invites(id) on delete set null;

create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  body_md text not null default '',
  tags jsonb not null default '[]'::jsonb,
  media jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('published','draft')),
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body_md text not null default '',
  media jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('content','comment')),
  target_id uuid not null,
  kind text not null check (kind in ('like','dislike','favorite')),
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id, kind)
);

create table if not exists public.grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid references public.modules(id) on delete cascade,
  write boolean not null default true,
  expires_at timestamptz,
  invite_id uuid references public.invites(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contents_module_idx on public.contents (module_id, created_at desc);
create index if not exists contents_author_idx on public.contents (author_id);
create index if not exists comments_content_idx on public.comments (content_id, created_at);
create index if not exists reactions_target_idx on public.reactions (target_type, target_id);
-- 好友关系与私信
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  body_md text not null default '',
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_not_self check (from_id <> to_id)
);

create index if not exists friendships_requester_idx on public.friendships (requester_id, status);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists messages_dial_idx on public.messages (from_id, to_id, created_at);
create unique index if not exists grants_all_uk on public.grants (user_id) where module_id is null;
create unique index if not exists grants_module_uk on public.grants (user_id, module_id) where module_id is not null;

-- ------------------------------------------------------------
-- 2. 权限辅助函数（security definer：绕过 RLS，避免策略递归）
-- ------------------------------------------------------------
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin' and status = 'active') $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('superadmin','owner') and status = 'active') $$;

create or replace function public.has_module_access(p_module_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select public.is_staff() or exists (
     select 1 from public.grants g
     left join public.invites i on i.id = g.invite_id
     where g.user_id = auth.uid()
       and (g.module_id is null or g.module_id = p_module_id)
       and (g.expires_at is null or g.expires_at > now())
       and (g.invite_id is null or (i.active and (i.expires_at is null or i.expires_at > now())))
   ) $$;

create or replace function public.has_module_write(p_module_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select public.is_staff() or exists (
     select 1 from public.grants g
     left join public.invites i on i.id = g.invite_id
     where g.user_id = auth.uid()
       and g.write
       and (g.module_id is null or g.module_id = p_module_id)
       and (g.expires_at is null or g.expires_at > now())
       and (g.invite_id is null or (i.active and (i.expires_at is null or i.expires_at > now())))
   ) $$;

create or replace function public.can_read_content(p_content_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.contents c
     where c.id = p_content_id
       and (public.is_staff() or c.author_id = auth.uid()
            or (c.status <> 'draft' and public.has_module_access(c.module_id)))
   ) $$;

create or replace function public.are_friends(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester_id = auth.uid() and f.addressee_id = p_user_id)
            or (f.requester_id = p_user_id and f.addressee_id = auth.uid()))
   ) $$;

-- 统计视图：绕过 RLS 汇总互动数，供前端读取
create or replace view public.content_stats as
select c.id as content_id,
       count(*) filter (where r.kind = 'like') as like_count,
       count(*) filter (where r.kind = 'dislike') as dislike_count,
       count(*) filter (where r.kind = 'favorite') as favorite_count
from public.contents c
left join public.reactions r on r.target_type = 'content' and r.target_id = c.id
group by c.id;

create or replace view public.comment_stats as
select c.id as comment_id,
       count(*) filter (where r.kind = 'like') as like_count,
       count(*) filter (where r.kind = 'dislike') as dislike_count,
       count(*) filter (where r.kind = 'favorite') as favorite_count
from public.comments c
left join public.reactions r on r.target_type = 'comment' and r.target_id = c.id
group by c.id;

grant select on public.content_stats to authenticated;
grant select on public.comment_stats to authenticated;

-- ------------------------------------------------------------
-- 3. 触发器：注册时自动建 profile；保护敏感字段不被普通用户改写
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as
$$ begin
     insert into public.profiles (id, username, nickname, role)
     values (new.id,
             coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email, '@', 1)),
             coalesce(nullif(new.raw_user_meta_data->>'nickname',''), split_part(new.email, '@', 1)),
             'member')
     on conflict (id) do nothing;
     return new;
   end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as
$$ begin
     if public.is_superadmin() or coalesce(current_setting('app.internal', true), 'off') = 'on' then
       return new;
     end if;
     if new.role is distinct from old.role
        or new.status is distinct from old.status
        or new.invite_id is distinct from old.invite_id
        or new.username is distinct from old.username then
       raise exception 'profile_field_forbidden';
     end if;
     return new;
   end $$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update before update on public.profiles
for each row execute function public.guard_profile_update();

-- ------------------------------------------------------------
-- 4. 行级安全（RLS）
-- ------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.modules   enable row level security;
alter table public.invites   enable row level security;
alter table public.contents  enable row level security;
alter table public.comments  enable row level security;
alter table public.reactions enable row level security;
alter table public.grants    enable row level security;

-- 账号资料：登录后可读；本人可改资料；超管可改全部
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- 模块：登录后可读；仅超管增删改
drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules for select to authenticated using (true);
drop policy if exists modules_admin on public.modules;
create policy modules_admin on public.modules for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- 邀请码：仅超管可增删改；普通用户只能读到「自己用过的」邀请码状态
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select to authenticated using (
  public.is_superadmin()
  or exists (select 1 from public.grants g where g.user_id = auth.uid() and g.invite_id = invites.id)
);
drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- 内容：需拥有该模块访问权；草稿仅作者可见
drop policy if exists contents_select on public.contents;
create policy contents_select on public.contents for select to authenticated
  using (public.can_read_content(id));
drop policy if exists contents_insert on public.contents;
create policy contents_insert on public.contents for insert to authenticated
  with check (author_id = auth.uid() and public.has_module_write(module_id));
drop policy if exists contents_update on public.contents;
create policy contents_update on public.contents for update to authenticated
  using (public.is_staff() or author_id = auth.uid())
  with check (public.is_staff() or (author_id = auth.uid() and public.has_module_write(module_id)));
drop policy if exists contents_delete on public.contents;
create policy contents_delete on public.contents for delete to authenticated
  using (public.is_staff() or author_id = auth.uid());

-- 评论：需能访问所属内容；本人或管理可删
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (public.can_read_content(content_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_read_content(content_id));
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (public.is_staff() or author_id = auth.uid());

-- 互动：本人可增删；登录后可读（用于统计与我是否点过）
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select to authenticated using (true);
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and (
    (target_type = 'content' and public.can_read_content(target_id))
    or (target_type = 'comment' and exists (
      select 1 from public.comments c where c.id = target_id and public.can_read_content(c.content_id)))
  ));
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

-- 授权：本人或管理可读；仅超管可写
drop policy if exists grants_select on public.grants;
create policy grants_select on public.grants for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists grants_admin on public.grants;
create policy grants_admin on public.grants for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- 好友与私信
alter table public.friendships enable row level security;
alter table public.messages enable row level security;

drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status in ('pending','accepted'));
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (from_id = auth.uid() and public.are_friends(to_id));
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
  using (to_id = auth.uid()) with check (to_id = auth.uid());
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

grant execute on function public.are_friends(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. 接口函数（前端通过 rpc 调用；错误码关键字与前端 i18n 对应）
-- ------------------------------------------------------------
create or replace function public.app_bootstrap_state()
returns jsonb language sql stable security definer set search_path = public, auth as
$$ select jsonb_build_object(
     'has_users', exists (select 1 from auth.users),
     'has_superadmin', exists (select 1 from public.profiles where role = 'superadmin' and status = 'active')
   ) $$;

create or replace function public.validate_invite(p_code text)
returns jsonb language sql stable security definer set search_path = public as
$$ select to_jsonb(i) from public.invites i where i.code = upper(trim(coalesce(p_code, ''))) $$;

/* 首位管理员：仅当系统内还没有超管时可用（前端「初始化」表单会调用） */
create or replace function public.claim_first_superadmin(p_username text, p_nickname text)
returns void language plpgsql security definer set search_path = public, auth as
$$ declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform set_config('app.internal', 'on', true);
  if exists (select 1 from public.profiles where role = 'superadmin') then
    raise exception 'superadmin_exists';
  end if;
  update public.profiles
     set role = 'superadmin',
         username = coalesce(nullif(trim(p_username),''), username),
         nickname = coalesce(nullif(trim(p_nickname),''), username)
   where id = v_uid;
  if not found then raise exception 'profile_missing'; end if;
end $$;

/* 邀请码注册：校验邀请码并写入授权（授权跟随邀请码状态实时失效） */
create or replace function public.register_with_invite(p_username text, p_nickname text, p_invite_code text)
returns void language plpgsql security definer set search_path = public, auth as
$$ declare
     v_uid uuid := auth.uid();
     v_invite public.invites;
     v_name text := lower(trim(coalesce(p_username,'')));
     v_mid uuid;
   begin
     if v_uid is null then raise exception 'not_authenticated'; end if;
     perform set_config('app.internal', 'on', true);
     if v_name <> '' and exists (select 1 from public.profiles where username = v_name and id <> v_uid) then
       raise exception 'user_exists';
     end if;
     select * into v_invite from public.invites
      where code = upper(trim(coalesce(p_invite_code,''))) for update;
     if not found then raise exception 'invite_invalid'; end if;
     if v_invite.active is not true then raise exception 'invite_disabled'; end if;
     if v_invite.expires_at is not null and v_invite.expires_at <= now() then raise exception 'invite_expired'; end if;
     if v_invite.max_uses is not null and v_invite.used_count >= v_invite.max_uses then raise exception 'invite_used_up'; end if;

     update public.profiles
        set username = coalesce(nullif(v_name,''), username),
            nickname = coalesce(nullif(trim(p_nickname),''), username),
            role = case when role = 'superadmin' then role else 'member' end,
            invite_id = v_invite.id
      where id = v_uid;
     if not found then raise exception 'profile_missing'; end if;

     delete from public.grants where user_id = v_uid;
     if v_invite.all_modules then
       insert into public.grants (user_id, module_id, write, expires_at, invite_id)
       values (v_uid, null, v_invite.write, v_invite.expires_at, v_invite.id);
     else
       foreach v_mid in array coalesce(v_invite.module_ids, '{}'::uuid[]) loop
         insert into public.grants (user_id, module_id, write, expires_at, invite_id)
         values (v_uid, v_mid, v_invite.write, v_invite.expires_at, v_invite.id);
       end loop;
     end if;

     update public.invites
        set used_count = used_count + 1,
            used_by = (select coalesce(array_agg(distinct x), '{}'::uuid[])
                         from unnest(coalesce(used_by, '{}'::uuid[]) || v_uid) as x)
      where id = v_invite.id;
   end $$;

/* 超管新建账号（含初始授权） */
create or replace function public.admin_create_user(
  p_username text,
  p_password text,
  p_nickname text default '',
  p_role text default 'member',
  p_module_ids uuid[] default null,
  p_write boolean default true,
  p_expires_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public, auth, extensions as
$$ declare
     v_uid uuid := gen_random_uuid();
     v_name text := lower(trim(coalesce(p_username,'')));
     v_email text := lower(trim(coalesce(p_username,''))) || '@tiwu.local';
     v_role text := case when p_role in ('superadmin','owner') then p_role else 'member' end;
     v_mid uuid;
   begin
     if not public.is_superadmin() then raise exception 'forbidden'; end if;
     if v_name !~ '^[a-z0-9_]{3,20}$' then raise exception 'invalid_username'; end if;
     if length(coalesce(p_password,'')) < 6 then raise exception 'invalid_password'; end if;
     if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'user_exists'; end if;
     perform set_config('app.internal', 'on', true);

     insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
             crypt(p_password, gen_salt('bf')), now(),
             jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
             jsonb_build_object('username', v_name, 'nickname', coalesce(nullif(trim(p_nickname),''), p_username)),
             now(), now());

     begin
       insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values (v_uid::text, v_uid,
               jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
               'email', now(), now(), now());
     exception when others then
       begin
         insert into auth.identities (id, user_id, identity_data, provider, created_at, updated_at)
         values (v_uid, v_uid,
                 jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
                 'email', now(), now());
       exception when others then null;
       end;
     end;

     insert into public.profiles (id, username, nickname, role, status, must_change_password)
     values (v_uid, v_name, coalesce(nullif(trim(p_nickname),''), p_username), v_role, 'active', true)
     on conflict (id) do update
       set username = excluded.username, nickname = excluded.nickname,
           role = excluded.role, status = 'active', must_change_password = true;

     if p_module_ids is null or array_length(p_module_ids, 1) is null then
       insert into public.grants (user_id, module_id, write, expires_at, invite_id)
       values (v_uid, null, coalesce(p_write, true), p_expires_at, null);
     else
       foreach v_mid in array p_module_ids loop
         insert into public.grants (user_id, module_id, write, expires_at, invite_id)
         values (v_uid, v_mid, coalesce(p_write, true), p_expires_at, null);
       end loop;
     end if;
     return v_uid;
   end $$;

/* 超管调整角色（不允许移除最后一位超管） */
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as
$$ declare v_role text := case when p_role in ('superadmin','owner') then p_role else 'member' end;
   begin
     if not public.is_superadmin() then raise exception 'forbidden'; end if;
     if v_role <> 'superadmin'
        and exists (select 1 from public.profiles where id = p_user_id and role = 'superadmin')
        and (select count(*) from public.profiles where role = 'superadmin' and status = 'active') <= 1 then
       raise exception 'last_superadmin';
     end if;
     perform set_config('app.internal', 'on', true);
     update public.profiles set role = v_role where id = p_user_id;
     if not found then raise exception 'user_not_found'; end if;
   end $$;

/* 超管重置密码 */
create or replace function public.admin_reset_password(p_user_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, auth, extensions as
$$ begin
     if not public.is_superadmin() then raise exception 'forbidden'; end if;
     if length(coalesce(p_password,'')) < 6 then raise exception 'invalid_password'; end if;
     perform set_config('app.internal', 'on', true);
     update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
      where id = p_user_id;
     if not found then raise exception 'user_not_found'; end if;
     update public.profiles set must_change_password = true where id = p_user_id;
   end $$;

/* 超管删除账号（级联删除内容 / 评论 / 互动 / 授权） */
create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth as
$$ begin
     if not public.is_superadmin() then raise exception 'forbidden'; end if;
     if p_user_id = auth.uid() then raise exception 'self_delete'; end if;
     if exists (select 1 from public.profiles where id = p_user_id and role = 'superadmin')
        and (select count(*) from public.profiles where role = 'superadmin' and status = 'active') <= 1 then
       raise exception 'last_superadmin';
     end if;
     perform set_config('app.internal', 'on', true);
     delete from auth.users where id = p_user_id;
     if not found then raise exception 'user_not_found'; end if;
   end $$;

/* 阅读计数 */
create or replace function public.increment_view(p_content_id uuid)
returns void language sql security definer set search_path = public as
$$ update public.contents set views = views + 1 where id = p_content_id $$;

grant execute on function public.app_bootstrap_state() to anon, authenticated;
grant execute on function public.validate_invite(text) to anon, authenticated;
grant execute on function public.claim_first_superadmin(text, text) to authenticated;
grant execute on function public.register_with_invite(text, text, text) to authenticated;
grant execute on function public.admin_create_user(text, text, text, text, uuid[], boolean, timestamptz) to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.increment_view(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. 媒体存储桶（public bucket，登录用户可上传到自己的目录）
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');

drop policy if exists media_insert on storage.objects;
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- 7. 默认模块（已存在则跳过）
-- ------------------------------------------------------------
insert into public.modules (key, name_zh, name_en, desc_zh, desc_en, icon, sort, hot) values
  ('recommend', '推荐', 'Featured',     '按综合热度排序的精选内容', 'Highlights ranked by overall heat', '✦', 0, true),
  ('diary',     '日记', 'Diary',        '日常记录与随想',           'Daily notes',                       '❀', 1, false),
  ('poem',      '诗歌', 'Poetry',       '分行写下的句子',           'Lines and verses',                  '❖', 2, false),
  ('copy',      '文案', 'Copywriting',  '值得收藏的表达',           'Words worth keeping',               '✎', 3, false),
  ('review',    '评论', 'Reviews',      '书、影、事、物的评论',     'Reviews and critiques',             '☰', 4, false)
on conflict (key) do nothing;

-- 完成。接下来：
--   1) Authentication → Providers → Email：关闭 “Confirm email”（本站用合成邮箱，无法收信）
--   2) 在前端 src/config.js 填入 Project URL 与 anon public key
--   3) 打开站点，用「初始化」表单创建超管；或在 Dashboard 手动建号后执行：
--      update public.profiles set role = 'superadmin' where username = '你的用户名';
