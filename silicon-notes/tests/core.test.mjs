import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeNote,
  parseBundle,
  bundle,
  markdown,
  safeUrl,
  linksFor,
  newNote,
  initialCard,
  schedule,
  synthesize,
  validateHandoff,
  handoffDigest,
  searchNotes,
  noteMarkdown,
} from '../js/core.mjs';

const catalog = parseBundle(await readFile(new URL('../data/library.json', import.meta.url), 'utf8'));
const sample = () => structuredClone(catalog.notes[0]);

test('public catalog contains labelled examples and traceable paper references', () => {
  assert.equal(catalog.notes.length, 6);
  assert.ok(catalog.notes.every((note) => note.example));
  const papers = catalog.notes.filter((note) => note.type === 'paper');
  assert.equal(papers.length, 2);
  for (const paper of papers) {
    assert.ok(paper.sources.some((source) => source.url.startsWith('https://doi.org/')));
    assert.ok(
      paper.observations.every((result) => paper.sources.some((source) => source.id === result.sourceId)),
    );
    assert.ok(paper.limitation.includes('未'));
  }
});
test('schemas reject invalid types, malformed timestamps, duplicate records and dangling evidence', () => {
  const invalid = [
    { type: '__proto__' },
    { evidence: 'toString' },
    { title: '' },
    { tags: ['x'.repeat(41)] },
    { createdAt: 'yesterday' },
    { createdAt: '2026-02-30T00:00:00Z' },
    { createdAt: '1' },
    { body: 'x'.repeat(80001) },
    { sources: [{ id: 'source', label: 'x', url: 'javascript:alert(1)' }] },
    { observations: [{ id: 'r', statement: '1 volt', kind: 'simulation', sourceId: 'missing' }] },
    { attachments: [{ name: 'attack.svg', data: 'data:image/svg+xml;base64,PHN2Zz4=' }] },
  ];
  for (const change of invalid) assert.throws(() => normalizeNote({ ...sample(), ...change }));
  assert.throws(() => parseBundle({ ...catalog, notes: [sample(), sample()] }));
  assert.throws(() => parseBundle({ ...catalog, version: 2 }));
  assert.throws(() => parseBundle('x'.repeat(13 * 1024 * 1024)));
});
test('Markdown escapes HTML, scripts, attributes, unsafe protocols and wiki text', () => {
  const malicious =
    '<img src=x onerror=alert(1)>\n<script>alert(1)</script>\n[x](javascript:alert%281%29)\n[x](data:text/html,hi)\n[[\"><img src=x>]]\n```\n</code><svg onload=alert(1)>\n```';
  const rendered = markdown(malicious);
  assert.ok(!rendered.includes('<img'));
  assert.ok(!rendered.includes('<script'));
  assert.ok(!rendered.includes('<svg'));
  assert.ok(!rendered.includes('href="javascript:'));
  assert.ok(!rendered.includes('href="data:'));
  assert.ok(rendered.includes('&lt;img'));
  assert.ok(rendered.includes('class="wiki-link"'));
  for (const url of [
    'javascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,x',
    '//evil.test',
    'https://user:pass@evil.test',
    'file:///tmp/a',
  ])
    assert.equal(safeUrl(url), '');
  assert.ok(markdown('[DOI](https://doi.org/10.1007/BF01239381)').includes('rel="noopener noreferrer"'));
  assert.ok(markdown('**解释** 与 `gm`').includes('<strong>解释</strong>'));
});
test('backlinks and unresolved wiki links reflect actual notes, not inferred topics', () => {
  const a = sample();
  const b = {
    ...sample(),
    id: 'other',
    title: '另一个问题',
    body: `[[${a.title}]] [[尚未写的页]]`,
    parents: [],
  };
  const links = linksFor(a, [a, b]);
  assert.deepEqual(
    links.backlinks.map((note) => note.id),
    ['other'],
  );
  assert.deepEqual(linksFor(b, [a, b]).unresolved, ['尚未写的页']);
});
test('review schedule is deterministic, stores future due dates, and again resets stage', () => {
  const now = Date.parse('2026-11-05T10:00:00.000Z');
  const initial = initialCard(sample(), now);
  const good = schedule(initial, 'good', now);
  assert.equal(good.due, '2026-11-06T10:00:00.000Z');
  assert.equal(good.reviews, 1);
  const second = schedule(good, 'good', now);
  assert.equal(second.due, '2026-11-08T10:00:00.000Z');
  assert.equal(schedule(second, 'again', now).due, '2026-11-05T10:10:00.000Z');
  assert.equal(schedule(second, 'again', now).stage, 0);
  assert.throws(() => schedule(initial, 'fake', now));
});
test('synthesis retains parent IDs and source snapshots without fabricating observations', () => {
  const result = synthesize(catalog.notes[0], catalog.notes[1]);
  assert.equal(result.type, 'idea');
  assert.equal(result.evidence, 'idea');
  assert.equal(result.observations.length, 0);
  assert.equal(result.claim, '');
  assert.deepEqual(result.parents, [catalog.notes[0].id, catalog.notes[1].id]);
  assert.ok(result.sources[0].scope.includes(catalog.notes[0].updatedAt));
  assert.ok(result.body.includes('未证明'));
});
test('handoff validation rejects unknown kind and bad timestamps; digest covers the full payload', async () => {
  const value = {
    kind: 'circuit',
    title: 'RC step',
    body: '尚未验证',
    netlist: 'R1 in out 1k',
    source: 'Circuit Lab',
    createdAt: '2026-11-05T10:00:00Z',
  };
  assert.equal(validateHandoff(value).kind, 'circuit');
  assert.throws(() => validateHandoff({ ...value, kind: 'script' }));
  assert.throws(() => validateHandoff({ ...value, createdAt: 2 }));
  assert.equal(await handoffDigest(value), await handoffDigest({ ...value }));
  assert.notEqual(await handoffDigest(value), await handoffDigest({ ...value, netlist: 'R1 in out 2k' }));
});
test('search combines course, scope, tags and all query terms; JSON export preserves structured evidence', () => {
  const notes = catalog.notes.map((note) => ({ ...note, origin: 'public' }));
  assert.ok(searchNotes(notes, { query: '工作点 模型' }).length > 0);
  assert.equal(searchNotes(notes, { scope: 'local' }).length, 0);
  assert.equal(searchNotes(notes, { course: '器件与工艺', type: 'paper' }).length, 2);
  assert.deepEqual(parseBundle(JSON.stringify(bundle({ notes }))).notes, catalog.notes);
  assert.ok(noteMarkdown(catalog.notes[1]).includes('10.1007/BF01239381'));
});
