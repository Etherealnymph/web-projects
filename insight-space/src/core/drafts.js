/** Drafts belong to one signed-in user and one document in this browser. */
export function editorDraftKey(mode, userId, contentId = 'new') {
  return `tiwu.editor.v1:${[mode, userId, contentId].map((part) => encodeURIComponent(part)).join(':')}`;
}

export function readEditorDraft(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    if (value?.version !== 1 || !value.snapshot || typeof value.snapshot.bodyMd !== 'string'
      || typeof value.snapshot.title !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) return null;
    return value;
  } catch { return null; }
}

export function writeEditorDraft(storage, key, snapshot, now = new Date()) {
  // Keep media references, never the binary blobs or temporary signed display URLs.
  const media = (snapshot.media || []).map(({ displayUrl, ...reference }) => reference);
  const record = { version: 1, updatedAt: now.toISOString(), snapshot: { ...snapshot, media } };
  storage.setItem(key, JSON.stringify(record));
  return record;
}
