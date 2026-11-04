/** Same-origin, pinned SDK: no third-party CDN waterfall on application startup. */
let loading = null;

export async function loadSupabaseSdk() {
  if (!loading) {
    loading = import('../../vendor/supabase-2.118.0.min.js').catch((error) => {
      loading = null;
      throw new Error('无法加载本地 Supabase SDK，请确认 vendor/ 目录已完整部署。', { cause: error });
    });
  }
  return loading;
}
