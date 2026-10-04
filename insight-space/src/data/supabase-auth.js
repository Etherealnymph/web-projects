/** Supabase：账号与模块 */

import { fail, mapUser, mapModule, usernameToEmail } from './sb-core.js';

export function createAuthApi(sb) {
  const { client } = sb;

  return {
    async bootstrapState() {
      const { data, error } = await client.rpc('app_bootstrap_state');
      if (error) throw fail('msg.networkError');
      return {
        hasUsers: Boolean(data?.has_users),
        hasSuperadmin: Boolean(data?.has_superadmin),
        autoCreate: false,
      };
    },

    async createInitialSuperadmin({ username, password, nickname }) {
      if (!/^[A-Za-z0-9_]{3,20}$/.test(String(username || ''))) throw fail('auth.errUserLen');
      if (String(password || '').length < 6) throw fail('auth.errPwShort');
      const { error } = await client.auth.signUp({ email: usernameToEmail(username), password });
      if (error) throw fail(error.message?.includes('already') ? 'auth.errExists' : 'auth.errBad');
      const { error: rpcError } = await client.rpc('claim_first_superadmin', {
        p_username: username,
        p_nickname: nickname || username,
      });
      if (rpcError) throw fail('common.noPermission');
      await sb.loadProfile();
      return sb.profile;
    },

    async login(username, password) {
      const { error } = await client.auth.signInWithPassword({ email: usernameToEmail(username), password });
      if (error) throw fail('auth.errBad');
      await sb.loadProfile();
      if (!sb.profile) throw fail('auth.errBad');
      if (sb.profile.status === 'disabled') { await client.auth.signOut(); throw fail('common.noPermission'); }
      return sb.profile;
    },

    async register({ username, password, nickname, inviteCode }) {
      if (!/^[A-Za-z0-9_]{3,20}$/.test(String(username || ''))) throw fail('auth.errUserLen');
      if (String(password || '').length < 6) throw fail('auth.errPwShort');
      const { error } = await client.auth.signUp({ email: usernameToEmail(username), password });
      if (error) throw fail(error.message?.includes('already') ? 'auth.errExists' : 'auth.errBad');
      const { error: rpcError } = await client.rpc('register_with_invite', {
        p_username: username,
        p_nickname: nickname || username,
        p_invite_code: String(inviteCode || '').trim().toUpperCase(),
      });
      if (rpcError) {
        await client.auth.signOut();
        const message = rpcError.message || '';
        if (message.includes('invite_invalid')) throw fail('auth.errInviteInvalid');
        if (message.includes('invite_expired')) throw fail('auth.errInviteExpired');
        if (message.includes('invite_used_up')) throw fail('auth.errInviteUsedUp');
        if (message.includes('invite_disabled')) throw fail('auth.errInviteDisabled');
        if (message.includes('user_exists')) throw fail('auth.errExists');
        throw fail('msg.error');
      }
      await sb.loadProfile();
      return sb.profile;
    },

    async logout() {
      await client.auth.signOut();
      sb.profile = null;
      sb.grants = [];
      return true;
    },

    async current() {
      if (sb.profile) return sb.profile;
      return sb.loadProfile();
    },

    async updateProfile(patch) {
      const user = sb.requireUser();
      const row = {};
      if (patch.nickname != null) row.nickname = String(patch.nickname).trim().slice(0, 30);
      if (patch.bio != null) row.bio = String(patch.bio).slice(0, 300);
      if (patch.avatar != null) row.avatar = String(patch.avatar).trim().slice(0, 500);
      const { data, error } = await client.from('profiles').update(row).eq('id', user.id).select().single();
      if (error) throw fail('msg.error');
      sb.profile = mapUser(data);
      return sb.profile;
    },

    async changePassword(oldPassword, newPassword) {
      const user = sb.requireUser();
      if (String(newPassword || '').length < 6) throw fail('auth.errPwShort');
      const { error: signInError } = await client.auth.signInWithPassword({
        email: usernameToEmail(user.username),
        password: oldPassword,
      });
      if (signInError) throw fail('profile.errOldPw');
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw fail('msg.error');
      await client.from('profiles').update({ must_change_password: false }).eq('id', user.id);
      sb.profile.mustChangePassword = false;
      return true;
    },

    async listUsers() {
      sb.requireAdmin();
      const { data, error } = await client.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw fail('msg.error');
      const [grantRes, contentRes, commentRes, statRes] = await Promise.all([
        client.from('grants').select('*'),
        client.from('contents').select('id, author_id'),
        client.from('comments').select('id, author_id'),
        client.from('content_stats').select('*'),
      ]);
      const statMap = new Map((statRes.data || []).map((s) => [s.content_id, s]));
      return (data || []).map((row) => {
        const own = (contentRes.data || []).filter((c) => c.author_id === row.id);
        return {
          ...mapUser(row),
          stats: {
            contents: own.length,
            comments: (commentRes.data || []).filter((c) => c.author_id === row.id).length,
            likes: own.reduce((sum, c) => sum + (statMap.get(c.id)?.like_count || 0), 0),
          },
          grants: (grantRes.data || []).filter((g) => g.user_id === row.id).map((g) => ({
            id: g.id,
            moduleId: g.module_id,
            module: null,
            allModules: g.module_id === null,
            write: Boolean(g.write),
            expiresAt: g.expires_at,
            valid: !g.expires_at || new Date(g.expires_at) > new Date(),
            inviteId: g.invite_id,
          })),
        };
      });
    },

    async createUser({ username, password, nickname, role = 'member', moduleIds = [], write = true, expiresAt = null }) {
      sb.requireAdmin();
      const { error } = await client.rpc('admin_create_user', {
        p_username: username,
        p_password: password,
        p_nickname: nickname || username,
        p_role: role,
        p_module_ids: moduleIds.length ? moduleIds : null,
        p_write: write,
        p_expires_at: expiresAt || null,
      });
      if (error) {
        const message = error.message || '';
        if (message.includes('user_exists')) throw fail('auth.errExists');
        if (message.includes('invalid_password')) throw fail('auth.errPwShort');
        throw fail('msg.error');
      }
      return true;
    },

    async updateUser(id, patch) {
      sb.requireAdmin();
      if (patch.role) {
        const { error } = await client.rpc('admin_set_role', { p_user_id: id, p_role: patch.role });
        if (error) throw fail('msg.error');
      }
      const row = {};
      if (patch.nickname != null) row.nickname = String(patch.nickname).trim().slice(0, 30);
      if (patch.status) row.status = patch.status;
      if (patch.mustChangePassword != null) row.must_change_password = Boolean(patch.mustChangePassword);
      if (Object.keys(row).length) {
        const { error } = await client.from('profiles').update(row).eq('id', id);
        if (error) throw fail('msg.error');
      }
      return true;
    },

    async resetPassword(id, newPassword) {
      sb.requireAdmin();
      if (String(newPassword || '').length < 6) throw fail('auth.errPwShort');
      const { error } = await client.rpc('admin_reset_password', { p_user_id: id, p_password: newPassword });
      if (error) throw fail('msg.error');
      return true;
    },

    async removeUser(id) {
      const admin = sb.requireAdmin();
      if (admin.id === id) throw fail('admin.selfDelete');
      const { error } = await client.rpc('admin_delete_user', { p_user_id: id });
      if (error) throw fail('msg.error');
      return true;
    },
  };
}

export function createModulesApi(sb) {
  const { client } = sb;

  const api = {
    async list() {
      const { data, error } = await client.from('modules').select('*').order('sort', { ascending: true });
      if (error) throw fail('msg.error');
      const { data: contentRows } = await client.from('contents').select('id, module_id, status');
      const counts = new Map();
      for (const row of contentRows || []) {
        if (row.status === 'draft') continue;
        counts.set(row.module_id, (counts.get(row.module_id) || 0) + 1);
      }
      return (data || []).map((row) => mapModule(
        row,
        sb.profile ? sb.accessFor(row.id) : { visible: false, write: false, expiresAt: null },
        { contents: counts.get(row.id) || 0 },
      ));
    },

    async accessible() {
      const all = await api.list();
      return all.filter((m) => m.access.visible);
    },

    async create(patch) {
      sb.requireAdmin();
      const key = String(patch.key || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      const { data, error } = await client.from('modules').insert({
        key,
        name_zh: patch.nameZh || key,
        name_en: patch.nameEn || patch.nameZh || key,
        desc_zh: patch.descZh || '',
        desc_en: patch.descEn || '',
        icon: patch.icon || '❖',
        sort: Number(patch.sort) || 99,
        hot: Boolean(patch.hot),
      }).select().single();
      if (error) throw fail(error.message?.includes('duplicate') ? 'module.keyExists' : 'msg.error');
      return mapModule(data);
    },

    async update(id, patch) {
      sb.requireAdmin();
      const row = {};
      if (patch.key != null) row.key = String(patch.key).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (patch.nameZh != null) row.name_zh = patch.nameZh;
      if (patch.nameEn != null) row.name_en = patch.nameEn;
      if (patch.descZh != null) row.desc_zh = patch.descZh;
      if (patch.descEn != null) row.desc_en = patch.descEn;
      if (patch.icon != null) row.icon = patch.icon;
      if (patch.sort != null) row.sort = Number(patch.sort) || 0;
      if (patch.hot != null) row.hot = Boolean(patch.hot);
      const { data, error } = await client.from('modules').update(row).eq('id', id).select().single();
      if (error) throw fail(error.message?.includes('duplicate') ? 'module.keyExists' : 'msg.error');
      return mapModule(data);
    },

    async remove(id) {
      sb.requireAdmin();
      const { error } = await client.from('modules').delete().eq('id', id);
      if (error) throw fail('msg.error');
      return true;
    },
  };

  return api;
}
