/**
 * Real PostgreSQL WASM execution, isolated from the configured Supabase project.
 * Optional dependency: @electric-sql/pglite@0.5.15 (see the upgrade guide).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const packageRoot = process.env.INSIGHT_PGLITE_PACKAGE;
const load = (suffix, file) => import(packageRoot
  ? pathToFileURL(join(packageRoot, 'dist', file)).href : '@electric-sql/pglite' + suffix);
const { PGlite } = await load('', 'index.js');
const { pgcrypto } = await load('/contrib/pgcrypto', 'contrib/pgcrypto.js');
const { pg_trgm } = await load('/contrib/pg_trgm', 'contrib/pg_trgm.js');
const sqlFile = (name) => readFile(new URL('../supabase/' + name, import.meta.url), 'utf8');
const alice = '10000000-0000-4000-a000-000000000001';
const bob = '10000000-0000-4000-a000-000000000002';
const outsider = '10000000-0000-4000-a000-000000000003';
const disabled = '10000000-0000-4000-a000-000000000004';
const moduleId = '90000000-0000-4000-a000-000000000001';
const contentId = (n) => '20000000-0000-4000-a000-' + String(n).padStart(12, '0');
const messageId = (n) => '50000000-0000-4000-a000-' + String(n).padStart(12, '0');
const fixture = (sql) => sql.replace(/@([a-z]+)/g, (_, key) =>
  ({ alice, bob, outsider, disabled, module: moduleId })[key] || '@' + key);

test('Supabase migration and data contracts', async (t) => {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  t.after(() => db.close());
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select string_to_array(name, '/') $$;
    grant usage on schema auth, storage, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(await sqlFile('schema.sql'));
  await db.exec(fixture(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select, insert, update, delete on all tables in schema storage to authenticated;
    select set_config('app.internal', 'on', false);
    insert into auth.users (id, email) values
      ('@alice', 'alice@example.test'), ('@bob', 'bob@example.test'),
      ('@outsider', 'outsider@example.test'), ('@disabled', 'disabled@example.test');
    update public.profiles set role = 'owner' where id = '@alice';
    update public.profiles set status = 'disabled' where id = '@disabled';
    select set_config('app.internal', 'off', false);
    insert into public.modules(id, key, name_zh) values ('@module', 'test', '测试模块');
    insert into public.grants (user_id, module_id, read, write) values
      ('@bob', '@module', true, true), ('@disabled', '@module', true, true);
    insert into public.contents(id, module_id, author_id, title, body_md, tags, visibility, created_at, views)
      select ('20000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
        '@module', '@alice', '文章 ' || n, '中文研究内容 ' || n,
        '["研究"]'::jsonb, 'public', now() - n * interval '1 minute',
        case when n = 620 then 100000000 else 0 end
      from generate_series(1, 620) n;
    update public.contents set title = '100%_ literal, punctuation (test)'
      where id = '20000000-0000-4000-a000-000000000619';
    insert into public.contents(id, module_id, author_id, title, tags, visibility, visible_user_ids, status) values
      ('20000000-0000-4000-a000-000000000650', '@module', '@alice', 'secret', '["hidden-tag"]', 'private', '{}', 'published'),
      ('20000000-0000-4000-a000-000000000651', '@module', '@alice', 'shared', '["shared-tag"]', 'selected', array['@bob']::uuid[], 'published'),
      ('20000000-0000-4000-a000-000000000652', '@module', '@alice', 'alice draft', '["draft-secret"]', 'public', '{}', 'draft'),
      ('20000000-0000-4000-a000-000000000653', '@module', '@bob', 'bob draft', '["own-draft"]', 'private', '{}', 'draft');
    insert into public.reactions(user_id, target_type, target_id, kind) values
      ('@alice', 'content', '20000000-0000-4000-a000-000000000620', 'like'),
      ('@bob', 'content', '20000000-0000-4000-a000-000000000620', 'like'),
      ('@bob', 'content', '20000000-0000-4000-a000-000000000620', 'favorite'),
      ('@alice', 'content', '20000000-0000-4000-a000-000000000650', 'like');
    insert into public.comments (content_id, author_id, body_md)
      select '20000000-0000-4000-a000-000000000001', '@alice', 'comment ' || n from generate_series(1, 1105) n;
    insert into public.friendships(requester_id, addressee_id, status) values
      ('@alice', '@bob', 'accepted'), ('@alice', '@outsider', 'accepted');
    insert into public.messages(id, from_id, to_id, body_md, created_at)
      select ('50000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
        '@alice', '@bob', 'message ' || n, now() - (621 - n) * interval '1 minute'
      from generate_series(1, 620) n;
    insert into public.messages(id, from_id, to_id, body_md, created_at)
      select '50000000-0000-4000-a000-000000000621', '@bob', '@alice', 'latest',
        created_at from public.messages where id = '50000000-0000-4000-a000-000000000620';
    insert into public.messages(from_id, to_id, body_md) values ('@alice', '@outsider', 'third-party secret');
  `));
  const migration = await sqlFile('migrations/20261104_performance.sql');
  const counts = async () => (await db.query(`select
    (select count(*)::integer from public.contents) contents,
    (select count(*)::integer from public.messages) messages,
    (select count(*)::integer from public.profiles) profiles`)).rows[0];
  const before = await counts();
  await db.exec(migration);
  await db.exec(migration);
  assert.deepEqual(await counts(), before, 'rerunning the migration must preserve records');

  const asUser = async (id, fn, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || '']);
    await db.exec('set role ' + role);
    try { return await fn(); } finally { await db.exec('reset role'); }
  };
  const rpc = async (name, options = {}) => (
    await db.query('select public.' + name + '($1::jsonb) as result', [JSON.stringify(options)])
  ).rows[0].result;

  await t.test('accurate pagination beyond 500; stable ordering; own drafts', async () => {
    await asUser(bob, async () => {
      const first = await rpc('insight_content_page', { limit: 12, sort: 'new' });
      const second = await rpc('insight_content_page', { limit: 12, offset: 12, sort: 'new' });
      const last = await rpc('insight_content_page', { limit: 24, offset: 600, sort: 'new' });
      assert.equal(first.total, 622);
      assert.equal(first.items.length, 12);
      assert.equal(first.has_more, true);
      assert.equal(last.items.length, 22);
      assert.equal(last.has_more, false);
      assert.equal(new Set([...first.items, ...second.items].map((x) => x.id)).size, 24);
      assert.ok(last.items.some((x) => x.id === contentId(620)));
      assert.ok(first.items.some((x) => x.id === contentId(653)));
      assert.ok(!first.items.some((x) => [contentId(650), contentId(652)].includes(x.id)));
    });
  });
  await t.test('hot, liked and favorite rankings include records beyond the old cap', async () => {
    await asUser(bob, async () => {
      for (const sort of ['hot', 'like']) {
        assert.equal((await rpc('insight_content_page', { sort, limit: 1 })).items[0].id, contentId(620));
      }
      const favorites = await rpc('insight_content_page', { favorites_of: bob });
      assert.equal(favorites.total, 1);
      assert.equal(favorites.items[0].id, contentId(620));
      assert.deepEqual(await rpc('insight_content_summary', { author_id: alice }), { total: 621, likes: 2, favorites: 1 });
    });
  });
  await t.test('literal search, facets, statistics and access isolation', async () => {
    await asUser(bob, async () => {
      const search = await rpc('insight_content_page', { q: '100%_' });
      assert.equal(search.total, 1);
      assert.equal(search.items[0].id, contentId(619));
      assert.equal((await rpc('insight_content_page', { q: "'),status.eq.draft" })).total, 0);
      const facets = await rpc('insight_content_facets');
      assert.ok(facets.tags.includes('研究') && facets.tags.includes('shared-tag'));
      assert.ok(!facets.tags.includes('hidden-tag') && !facets.tags.includes('draft-secret'));
      assert.equal((await db.query('select * from public.content_stats where content_id = $1', [contentId(650)])).rows.length, 0);
      const metrics = (await db.query('select public.insight_content_metrics($1::uuid[]) as result', [[contentId(1), contentId(650)]])).rows[0].result;
      assert.equal(metrics.length, 1);
      assert.equal(metrics[0].counts.comment, 1105);
    });
    await asUser(outsider, async () => assert.equal((await rpc('insight_content_page')).total, 0));
    await assert.rejects(asUser(disabled, () => rpc('insight_content_page')), (error) => error.code === '42501');
    await assert.rejects(asUser(null, () => rpc('insight_content_page'), 'anon'), (error) => error.code === '42501');
  });
  await t.test('atomic reactions keep votes mutually exclusive and reject inaccessible targets', async () => {
    await asUser(bob, async () => {
      const toggle = (id, kind) => db.query('select public.insight_toggle_reaction($1, $2::uuid, $3)', ['content', id, kind]);
      await toggle(contentId(620), 'dislike');
      let rows = (await db.query('select kind from public.reactions where user_id = $1 and target_id = $2 order by kind', [bob, contentId(620)])).rows;
      assert.deepEqual(rows.map((x) => x.kind), ['dislike', 'favorite']);
      await toggle(contentId(620), 'dislike');
      rows = (await db.query('select kind from public.reactions where user_id = $1 and target_id = $2', [bob, contentId(620)])).rows;
      assert.deepEqual(rows.map((x) => x.kind), ['favorite']);
      await assert.rejects(toggle(contentId(650), 'like'), (error) => error.code === '42501');
      await assert.rejects(toggle(contentId(620), 'arbitrary'), (error) => error.code === '22023');
    });
  });
  await t.test('view counter checks readability', async () => {
    const old = (await db.query('select views from public.contents where id = $1', [contentId(650)])).rows[0].views;
    await asUser(bob, () => db.query('select public.increment_view($1::uuid)', [contentId(650)]));
    assert.equal((await db.query('select views from public.contents where id = $1', [contentId(650)])).rows[0].views, old);
  });
  await t.test('latest messages, cursor tie ordering, complete unread count and friend search', async () => {
    await asUser(bob, async () => {
      const latest = (await db.query('select * from public.insight_message_page($1::uuid, 2)', [alice])).rows;
      assert.equal(latest[0].id, messageId(621));
      assert.equal(latest[1].id, messageId(620));
      const older = (await db.query('select * from public.insight_message_page($1::uuid, 2, $2::timestamptz, $3::uuid)',
        [alice, latest[1].created_at, latest[1].id])).rows;
      assert.equal(older[0].id, messageId(619));
      const threads = (await db.query('select public.insight_threads() as result')).rows[0].result;
      assert.equal(threads.length, 1);
      assert.equal(threads[0].unread, 620);
      assert.equal(threads[0].last.bodyMd, 'latest');
      const matches = (await db.query('select public.insight_search_members($1) as result', ['alice'])).rows[0].result;
      assert.equal(matches.length, 1);
      assert.equal(matches[0].relation, 'accepted');
      await assert.rejects(db.query('select * from public.insight_message_page($1::uuid, 10)', [outsider]), (error) => error.code === '42501');
    });
  });
  await t.test('invoker APIs deny anonymous use; all new indexes are valid', async () => {
    const functions = (await db.query(`select p.proname, p.prosecdef,
      has_function_privilege('anon', p.oid, 'execute') anonymous,
      has_function_privilege('authenticated', p.oid, 'execute') authenticated
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'insight_%'`)).rows;
    assert.equal(functions.length, 11);
    assert.ok(functions.every((row) => !row.prosecdef && !row.anonymous && row.authenticated));
    const indexes = (await db.query(`select x.indisvalid from pg_class i join pg_index x on x.indexrelid = i.oid where i.relname like 'insight_%_idx'`)).rows;
    assert.equal(indexes.length, 12);
    assert.ok(indexes.every((row) => row.indisvalid));
  });
  await t.test('rollback and reapply preserve records', async () => {
    const snapshot = await counts();
    await db.exec(await sqlFile('operations/20261104_performance_rollback.sql'));
    assert.deepEqual(await counts(), snapshot);
    await db.exec(migration);
    assert.deepEqual(await counts(), snapshot);
    await asUser(bob, async () => assert.equal((await rpc('insight_content_page')).total, 622));
  });
});
