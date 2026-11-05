import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { openNotebook } from '../js/store.mjs';
import { newNote, normalizeNote, initialCard, bundle } from '../js/core.mjs';

const make = (title) => normalizeNote({ ...newNote(), title });
const store = () => openNotebook(indexedDB, 'test-' + crypto.randomUUID());

test('drafts and explicitly published notes occupy separate durable stores', async () => {
  const repository = await store();
  const note = make('偏置实验');
  await repository.put('drafts', note);
  assert.equal((await repository.all('notes')).length, 0);
  await repository.publish(note);
  assert.equal((await repository.all('drafts')).length, 0);
  assert.equal((await repository.all('notes'))[0].title, note.title);
  const name = repository.database.name;
  repository.close();
  const reopened = await openNotebook(indexedDB, name);
  assert.equal((await reopened.all('notes'))[0].id, note.id);
  reopened.close();
});
test('an invalid record anywhere in import leaves every existing store unchanged', async () => {
  const repository = await store();
  const original = make('已保存的页');
  await repository.publish(original);
  const incoming = make('有效的新页');
  await assert.rejects(
    repository.importBundle({
      format: 'silicon-notes',
      version: 1,
      notes: [incoming],
      drafts: [{ ...make('坏草稿'), evidence: 'fake' }],
    }),
  );
  assert.deepEqual(
    (await repository.all('notes')).map((note) => note.id),
    [original.id],
  );
  assert.equal((await repository.all('drafts')).length, 0);
  repository.close();
});
test('transaction failure rolls back changes already enqueued in other stores', async () => {
  const repository = await store();
  const original = make('原记录');
  await repository.publish(original);
  await assert.rejects(
    repository.transaction(['notes', 'drafts'], (transaction) => {
      transaction.objectStore('notes').put({ ...original, title: '不应留下的更改' });
      transaction.objectStore('drafts').put(make('不应留下的草稿'));
      transaction.abort();
    }),
  );
  assert.equal((await repository.all('notes'))[0].title, '原记录');
  assert.equal((await repository.all('drafts')).length, 0);
  repository.close();
});
test('valid import atomically merges by ID without removing unrelated notes', async () => {
  const repository = await store();
  const original = make('原记录');
  const unrelated = make('不在备份里的页');
  await repository.publish(original);
  await repository.publish(unrelated);
  const draft = make('草稿');
  const update = { ...original, title: '更新记录' };
  await repository.importBundle(bundle({ notes: [update], drafts: [draft], cards: [initialCard(update)] }));
  assert.equal((await repository.all('notes')).length, 2);
  assert.equal((await repository.all('notes')).find((note) => note.id === original.id).title, '更新记录');
  assert.equal((await repository.all('drafts')).length, 1);
  assert.equal((await repository.all('cards')).length, 1);
  repository.close();
});
test('handoff receipt and draft commit together, preventing repeated acceptance even with concurrent calls', async () => {
  const repository = await store();
  const digest = 'a'.repeat(64);
  const results = await Promise.all([
    repository.acceptHandoff(make('转交 A'), digest),
    repository.acceptHandoff(make('转交 A 副本'), digest),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await repository.all('drafts')).length, 1);
  assert.equal(await repository.accepted(digest), true);
  repository.close();
});
test('missing IndexedDB rejects instead of pretending to save to a temporary fallback', async () => {
  await assert.rejects(openNotebook(null), /不提供 IndexedDB/);
});
