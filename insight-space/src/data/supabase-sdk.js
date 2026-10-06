/**
 * 按顺序尝试多个 CDN 加载 @supabase/supabase-js。
 *
 * 中国大陆对 cdn.jsdelivr.net 的干扰较频繁，一旦该域名被阻断整个应用就无法启动，
 * 所以这里退化为「依次尝试、任一成功即用」，而不是把全部希望押在单一 CDN 上。
 * （unpkg.com / esm.sh 的大陆可达性明显好于 jsDelivr。）
 */
const SDK_CDNS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
  'https://unpkg.com/@supabase/supabase-js@2/+esm',
  'https://esm.sh/@supabase/supabase-js@2',
];

let cached = null;

export async function loadSupabaseSdk() {
  if (cached) return cached;
  let lastError;
  for (const url of SDK_CDNS) {
    try {
      cached = await import(/* @vite-ignore */ url);
      return cached;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('无法加载 Supabase SDK');
}
