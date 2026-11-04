/** Supabase 模式入口：组装各模块 API（接口与本地模式完全一致） */

import { CONFIG, resolveSupabaseUrl } from '../config.js';
import { loadSupabaseSdk } from './supabase-sdk.js';
import { createContext } from './sb-core.js';
import { createAuthApi, createModulesApi } from './supabase-auth.js';
import { createContentsApi, createCommentsApi, createReactionsApi } from './supabase-content.js';
import { createInvitesApi, createGrantsApi, createAdminApi, createMediaApi } from './supabase-ops.js';
import { createPermissionRequestsApi } from './supabase-ops.js';

export async function createSupabaseApi() {
  const { createClient } = await loadSupabaseSdk();
  const client = createClient(resolveSupabaseUrl(), CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const sb = createContext(client);
  const modules = createModulesApi(sb);

  return {
    mode: 'supabase',
    client,
    async init() {
      await sb.loadProfile();
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') sb.clearSession();
        if (event === 'SIGNED_IN' && session?.user?.id !== sb.profile?.id) sb.clearSession();
        // Keep the auth callback synchronous; old auth-js versions hold a session lock here.
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          setTimeout(() => sb.loadProfile().catch((error) => console.warn('[insight-space] 资料刷新失败', error)), 0);
        }
      });
      return true;
    },
    auth: createAuthApi(sb),
    modules,
    contents: createContentsApi(sb, modules),
    comments: createCommentsApi(sb),
    reactions: createReactionsApi(sb),
    invites: createInvitesApi(sb),
    grants: createGrantsApi(sb),
    permissionRequests: createPermissionRequestsApi(sb),
    admin: createAdminApi(sb, modules),
    media: createMediaApi(sb),
    friends: createFriendsApi(sb),
    messages: createMessagesApi(sb),
  };
}
import { createFriendsApi, createMessagesApi } from './supabase-social.js';
