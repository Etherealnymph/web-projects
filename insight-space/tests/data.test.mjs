import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentsApi as createLocalContents, createCommentsApi as createLocalComments } from '../src/data/local-content.js';
import { createMessagesApi as createLocalMessages } from '../src/data/local-social.js';
import { createContentsApi as createCloudContents, createReactionsApi } from '../src/data/supabase-content.js';
import { createMessagesApi as createCloudMessages } from '../src/data/supabase-social.js';
import { createContext } from '../src/data/sb-core.js';
import { emptyDb } from '../src/data/local-core.js';
import { feedOptions, pageOptions, queryError } from '../src/data/query.js';

const context = () => {
  const db = emptyDb();
  const user = { id: 'owner', username: 'owner', nickname: '主人', role: 'owner', status: 'active' };
  db.users.push(user, { id: 'friend', username: 'friend', nickname: '朋友', role: 'member', status: 'active' });
  db.modules.push({ id: 'module', nameZh: '日记', key: 'diary' });
  for (let n = 0; n < 625; n++) db.contents.push({
    id: 'content-' + String(n).padStart(4, '0'), moduleId: 'module', authorId: user.id,
    title: 'Article ' + n, bodyMd: '中文研究内容', tags: ['研究'], status: 'published',
    visibility: 'public', media: [], createdAt: new Date(Date.now() - n * 60000).toISOString(),
  });
  return { db: async () => db, user: () => user, save: async () => {}, store: db };
};

test('local pagination and summary consider all records, not just the loaded page', async () => {
  const ctx = context();
  ctx.store.reactions.push({ userId: 'friend', targetType: 'content', targetId: 'content-0624', kind: 'like' });
  ctx.store.reactions.push({ userId: 'owner', targetType: 'content', targetId: 'content-0624', kind: 'favorite' });
  const api = createLocalContents(ctx);
  const first = await api.list({ limit: 12 });
  const last = await api.list({ limit: 12, offset: 624 });
  assert.equal(first.total, 625);
  assert.equal(first.items.length, 12);
  assert.equal(first.hasMore, true);
  assert.equal(last.items.length, 1);
  assert.equal(last.hasMore, false);
  assert.equal((await api.list({ sort: 'like', limit: 1 })).items[0].id, 'content-0624');
  assert.equal((await api.list({ favoritesOf: 'owner' })).items[0].id, 'content-0624');
  assert.deepEqual(await api.summary({ authorId: 'owner' }), { total: 625, likes: 1, favorites: 1 });
});

test('local facets search is literal and contains only readable content', async () => {
  const ctx = context();
  ctx.store.contents[0].title = '100%_ , (a) literal';
  ctx.store.contents.push({ ...ctx.store.contents[0], id: 'other-draft', authorId: 'friend', status: 'draft', tags: ['secret'] });
  const api = createLocalContents(ctx);
  assert.equal((await api.list({ q: '100%_' })).total, 1);
  const facets = await api.facets({ q: '100%_' });
  assert.deepEqual(facets.tags, ['研究']);
  assert.equal(facets.authors[0].value, 'owner');
  await assert.rejects(api.list({ favoritesOf: 'friend' }), /common.noPermission/);
});

test('local messages and cursor ties match cloud chronological display', async () => {
  const ctx = context();
  ctx.store.friendships.push({ requesterId: 'owner', addresseeId: 'friend', status: 'accepted' });
  for (let n = 0; n < 120; n++) ctx.store.messages.push({
    id: String(n).padStart(4, '0'), fromId: 'owner', toId: 'friend',
    bodyMd: String(n), createdAt: '2026-11-04T00:00:00.000Z',
  });
  const api = createLocalMessages(ctx);
  const latest = await api.list('friend', { limit: 2 });
  assert.deepEqual(latest.map((m) => m.id), ['0118', '0119']);
  const earlier = await api.list('friend', { limit: 2, before: latest[0] });
  assert.deepEqual(earlier.map((m) => m.id), ['0116', '0117']);
});

test('editing a comment preserves omitted attachments and replaces an explicitly supplied list', async () => {
  const ctx = context();
  const removed = [];
  ctx.removeMedia = async (ref) => removed.push(ref.id);
  ctx.store.comments.push({ id: 'comment', authorId: 'owner', contentId: 'content-0000', bodyMd: 'old', media: [{ id: 'old-file', url: 'idb://old-file' }] });
  const api = createLocalComments(ctx);
  await api.update('comment', { bodyMd: 'text-only edit' });
  assert.equal(ctx.store.comments[0].media[0].id, 'old-file');
  await api.update('comment', { bodyMd: 'new attachment', media: [{ id: 'new-file', url: 'idb://new-file' }] });
  assert.deepEqual(removed, ['old-file']);
  assert.equal(ctx.store.comments[0].media[0].id, 'new-file');
});

test('cloud listing passes literal bound search parameters and maps one server page', async () => {
  const calls = [];
  const sb = {
    uid: () => 'owner',
    client: { rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { total: 700, has_more: true, items: [{
        id: 'article', module_id: 'module', author_id: 'owner', title: '标题',
        author: { id: 'owner', username: 'owner' },
        counts: { like: 4, favorite: 2, dislike: 0, comment: 9 },
        mine: { like: true, dislike: false, favorite: false },
      }] } };
    } },
  };
  const api = createCloudContents(sb, { list: async () => [{ id: 'module', access: { visible: true } }] });
  const result = await api.list({ q: "'),status.eq.draft%_", limit: 12, offset: 600 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'insight_content_page');
  assert.equal(calls[0].args.p_options.q, "'),status.eq.draft%_");
  assert.equal(calls[0].args.p_options.offset, 600);
  assert.equal(result.total, 700);
  assert.equal(result.items[0].counts.comment, 9);
  assert.equal(result.items[0].author.username, 'owner');
  assert.equal(result.hasMore, true);
});

test('cloud latest messages reverse only after taking the database page', async () => {
  let parameters;
  const api = createCloudMessages({
    requireUser: () => ({ id: 'owner' }),
    client: { rpc: async (name, args) => {
      assert.equal(name, 'insight_message_page');
      parameters = args;
      return { data: [{ id: 'new', created_at: '2026-11-04' }, { id: 'old', created_at: '2026-11-03' }] };
    } },
  });
  const list = await api.list('friend', { limit: 50, before: { createdAt: '2026-11-05', id: 'cursor' } });
  assert.deepEqual(list.map((m) => m.id), ['old', 'new']);
  assert.equal(parameters.p_limit, 50);
  assert.equal(parameters.p_before_id, 'cursor');
});

test('reaction RPC failures are surfaced and never reported as successful toggles', async () => {
  const api = createReactionsApi({
    requireUser: () => ({}),
    client: { rpc: async () => ({ error: { code: '42501', message: 'forbidden' } }) },
  });
  await assert.rejects(api.toggle({ targetType: 'content', targetId: 'id', kind: 'like' }), /common.noPermission/);
});

test('simultaneous profile loads coalesce; a late response cannot restore a signed-out account', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' } } } }) },
    from: (table) => ({
      select() { return this; },
      eq() { return table === 'profiles' ? this : Promise.resolve({ data: [] }); },
      maybeSingle: () => pending,
    }),
  };
  const sb = createContext(client);
  const one = sb.loadProfile();
  const two = sb.loadProfile();
  assert.equal(one, two);
  await Promise.resolve();
  sb.clearSession();
  release({ data: { id: 'owner', username: 'owner', status: 'active' } });
  await one;
  assert.equal(sb.profile, null);
});

test('query boundaries and migration errors have actionable defaults', () => {
  assert.deepEqual(pageOptions({ limit: Infinity, offset: -4 }), { limit: 24, offset: 0 });
  assert.deepEqual(pageOptions({ limit: 900, offset: 2.9 }), { limit: 100, offset: 2 });
  assert.equal(feedOptions({ q: 'a'.repeat(300) }).q.length, 200);
  assert.match(queryError({ code: 'PGRST202' }).message, /20261104_performance.sql/);
});
