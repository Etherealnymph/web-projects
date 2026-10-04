/** 数据访问入口：根据配置在「本地模式」与「Supabase 模式」之间切换 */

import { CONFIG } from '../config.js';
import { t } from '../core/i18n.js';

export function isCloudConfigured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

let instance = null;
let loading = null;

export function getApiSync() {
  return instance;
}

export function getApi() {
  if (instance) return Promise.resolve(instance);
  if (!loading) {
    loading = (async () => {
      let created;
      if (isCloudConfigured()) {
        try {
          const mod = await import('./supabase.js');
          created = await mod.createSupabaseApi();
        } catch (error) {
          console.error('[体悟集] Supabase 初始化失败，回退到本地模式：', error);
          const mod = await import('./local.js');
          created = await mod.createLocalApi();
        }
      } else {
        const mod = await import('./local.js');
        created = await mod.createLocalApi();
      }
      await created.init();
      instance = created;
      return created;
    })();
  }
  return loading;
}

/** 错误对象 → 用户可读文案 */
export function errText(error) {
  if (!error) return t('msg.error');
  if (error.code) return t(error.code);
  const message = String(error.message || '');
  if (!message) return t('msg.error');
  if (['Failed to fetch', 'NetworkError', 'Load failed'].some((x) => message.includes(x))) return t('msg.networkError');
  return message;
}

export function isFatalPermission(error) {
  const code = error?.code || '';
  return code === 'common.loginRequired' || code === 'common.noPermission';
}
