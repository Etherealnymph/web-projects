import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPABASE_PUBLIC_NOTES_TABLE, SUPABASE_URL } from '../js/config.mjs';

test('uses the dedicated Silicon Notes Supabase project', () => {
  assert.equal(SUPABASE_URL, 'https://udruenzjxexjogwmvscf.supabase.co');
  assert.equal(SUPABASE_PUBLIC_NOTES_TABLE, 'silicon_notes_public');
});
