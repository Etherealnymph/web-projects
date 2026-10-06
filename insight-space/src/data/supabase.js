/** Supabase 模式入口：组装各模块 API（接口与本地模式完全一致） */

import { CONFIG, resolveSupabaseUrl } from '../config.js';
import { loadSupabaseSdk } from './supabase-sdk.js';
import { createContext } from './sb-core.js';
import { createAuthApi, createModulesApi } from './supabase-auth.js';
import { createContentsApi, createCommentsApi, createReactionsApi } from './supabase-content.js';
import { createInvitesApi, createGrantsApi, createAdminApi, createMediaApi } from './supabase-ops.js';

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
      client.auth.onAuthStateChange(async (event) => {
        if (event === 'SIGNED_OUT') { sb.profile = null; sb.grants = []; }
        if (event === 'SIGNED_IN') await sb.loadProfile();
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
    admin: createAdminApi(sb, modules),
    media: createMediaApi(sb),
    friends: createFriendsApi(sb),
    messages: createMessagesApi(sb),
  };
}
import { createFriendsApi, createMessagesApi } from './supabase-social.js';
