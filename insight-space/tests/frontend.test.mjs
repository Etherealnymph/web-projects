import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../src/core/route.js';
import { debounce, mapConcurrent } from '../src/core/util.js';
import { editorDraftKey, readEditorDraft, writeEditorDraft } from '../src/core/drafts.js';
import { renderMarkdown, safeUrl } from '../src/core/markdown.js';
import { readingMinutes } from '../src/components/reader.js';
import { createContentFeed, resolveMediaUrls } from '../src/components/content-feed.js';

// The feed tests cover request ordering without requiring a browser or dependencies.
globalThis.document = { documentElement: { dataset: { lang: 'zh' } } };

test('hash routes preserve Unicode and query question marks; malformed escapes do not crash', () => {
  assert.deepEqual(parseRoute('#/m/%E6%97%A5%E8%AE%B0?q=why?now&tag=%E8%AF%97'), {
    segments: ['m', '日记'], query: { q: 'why?now', tag: '诗' },
  });
  assert.equal(parseRoute('#/c/100%').segments[1], '100%');
});

test('debounced work is cancelled on route exit and can be flushed once', async () => {
  const calls = [];
  const run = debounce((value) => calls.push(value), 10);
  run('old'); run('new'); run.cancel();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(calls, []);
  run('draft'); run.flush(); run.flush();
  assert.deepEqual(calls, ['draft']);
});

test('media resolution respects concurrency and preserves input order', async () => {
  let active = 0;
  let peak = 0;
  const values = await mapConcurrent([1, 2, 3, 4, 5, 6], 2, async (value) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, (7 - value) * 2));
    active -= 1;
    return value * value;
  });
  assert.equal(peak, 2);
  assert.deepEqual(values, [1, 4, 9, 16, 25, 36]);
});

test('draft recovery is isolated by account, backend and article', () => {
  const keys = [editorDraftKey('local', 'alice'), editorDraftKey('local', 'bob'),
    editorDraftKey('supabase', 'alice'), editorDraftKey('local', 'alice', 'published')];
  assert.equal(new Set(keys).size, 4);
  const records = new Map();
  const storage = { getItem: (key) => records.get(key), setItem: (key, value) => records.set(key, value) };
  writeEditorDraft(storage, keys[0], {
    title: '未完成的文章', bodyMd: '正文', visibility: 'private', media: [{ url: 'idb://image', displayUrl: 'blob:temporary' }],
  }, new Date('2026-11-04T08:00:00Z'));
  assert.equal(readEditorDraft(storage, keys[0]).snapshot.bodyMd, '正文');
  assert.deepEqual(readEditorDraft(storage, keys[0]).snapshot.media, [{ url: 'idb://image' }]);
  assert.equal(readEditorDraft(storage, keys[1]), null);
  storage.setItem(keys[0], '{broken');
  assert.equal(readEditorDraft(storage, keys[0]), null);
});

test('draft storage failures are surfaced to the editor, not reported as saved', () => {
  assert.throws(() => writeEditorDraft({ setItem() { throw new Error('quota'); } }, 'draft', { bodyMd: 'body', title: 'title' }), /quota/);
});

test('Markdown keeps scripts inert and tolerates pasted filenames with percent signs', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n\n::file[https://example.com/100%.pdf]');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('100%.pdf'));
  assert.equal(safeUrl('java\nscript:alert(1)'), '');
});

test('reading time handles mixed Chinese and English text', () => {
  assert.equal(readingMinutes(''), 1);
  assert.equal(readingMinutes('字'.repeat(800)), 2);
  assert.equal(readingMinutes('word '.repeat(440)), 2);
});

function fakeNode() {
  return {
    innerHTML: '', textContent: '', attributes: new Map(), events: {},
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    insertAdjacentHTML(_position, html) { this.innerHTML += html; },
    addEventListener(name, listener) { this.events[name] = listener; },
  };
}
const item = (id, title = id) => ({ id, title, bodyMd: '', createdAt: '2026-11-01T00:00:00Z', counts: {}, module: { nameZh: '日记' } });
const result = (items, total = items.length) => ({ items, total, hasMore: items.length < total });

test('a slow obsolete search cannot overwrite a newer result', async () => {
  let releaseOld;
  let query = 'old';
  const list = fakeNode();
  const more = fakeNode();
  const feed = createContentFeed({
    ctx: { api: { contents: { list: (options) => options.q === 'old' ? new Promise((resolve) => { releaseOld = resolve; }) : Promise.resolve(result([item('new')])) } }, onLeave() {} },
    list, more, options: () => ({ q: query }),
  });
  const old = feed.load();
  query = 'new';
  await feed.load();
  releaseOld(result([item('old')]));
  await old;
  assert.ok(list.innerHTML.includes('#/c/new'));
  assert.ok(!list.innerHTML.includes('#/c/old'));
  assert.equal(list.attributes.has('aria-busy'), false);
});

test('loading another page appends unique cards and uses the next offset', async () => {
  const offsets = [];
  const list = fakeNode();
  const feed = createContentFeed({
    ctx: { api: { contents: { list: async ({ offset }) => {
      offsets.push(offset);
      return offset === 0 ? result([item('one'), item('two')], 3) : result([item('two'), item('three')], 3);
    } } }, onLeave() {} },
    list, more: fakeNode(), options: () => ({}), pageSize: 2,
  });
  await feed.load();
  await feed.load(false);
  assert.deepEqual(offsets, [0, 2]);
  assert.equal((list.innerHTML.match(/href="#\/c\/two"/g) || []).length, 1);
  assert.ok(list.innerHTML.includes('#/c/three'));
});

test('route disposal prevents a late page from rendering', async () => {
  let finish;
  let dispose;
  const list = fakeNode();
  const feed = createContentFeed({
    ctx: { api: { contents: { list: () => new Promise((resolve) => { finish = resolve; }) } }, onLeave(fn) { dispose = fn; } },
    list, more: fakeNode(), options: () => ({}),
  });
  const pending = feed.load();
  dispose();
  finish(result([item('stale')]));
  await pending;
  assert.ok(!list.innerHTML.includes('#/c/stale'));
});

test('content cards resolve the cover only, not unused video and file attachments', async () => {
  const calls = [];
  const items = [{ bodyMd: '![cover](idb://cover)', media: [{ kind: 'video', url: 'idb://video' }, { kind: 'file', url: 'idb://file' }] }];
  await resolveMediaUrls({ media: { resolve: async (url) => { calls.push(url); return 'blob:cover'; } } }, items);
  assert.deepEqual(calls, ['idb://cover']);
  assert.equal(items[0].coverUrl, 'blob:cover');
});
