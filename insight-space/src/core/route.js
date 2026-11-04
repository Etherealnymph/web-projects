/** Hash routes stay compatible with static hosting and malformed pasted links. */
export function parseRoute(hash = '') {
  const raw = String(hash).replace(/^#\/?/, '');
  const split = raw.indexOf('?');
  const path = split < 0 ? raw : raw.slice(0, split);
  const search = split < 0 ? '' : raw.slice(split + 1);
  const decode = (part) => {
    try { return decodeURIComponent(part); } catch { return part; }
  };
  return {
    segments: path.split('/').filter(Boolean).map(decode),
    query: Object.fromEntries(new URLSearchParams(search)),
  };
}
