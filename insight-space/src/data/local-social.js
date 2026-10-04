/** 本地模式：好友关系与私信 */

import { uid, nowIso } from '../core/util.js';
import { publicUser, relationOf, areFriends } from './local-core.js';
import { fail } from './local-content.js';

function requireLogin(ctx) {
  const user = ctx.user();
  if (!user) throw fail('common.loginRequired');
  return user;
}

function userMapOf(db) {
  return new Map(db.users.map((u) => [u.id, publicUser(u)]));
}

function pairWith(row, meId) {
  return row.requesterId === meId ? row.addresseeId : row.requesterId;
}

export function createFriendsApi(ctx) {
  return {
    async relation(userId) {
      const db = await ctx.db();
      const me = ctx.user();
      if (!me) return 'none';
      return relationOf(db, me.id, userId);
    },

    async list() {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      const users = userMapOf(db);
      return (db.friendships || [])
        .filter((f) => f.status === 'accepted' && (f.requesterId === me.id || f.addresseeId === me.id))
        .map((f) => ({ id: f.id, user: users.get(pairWith(f, me.id)) || null, since: f.updatedAt || f.createdAt }))
        .filter((f) => f.user)
        .sort((a, b) => new Date(b.since) - new Date(a.since));
    },

    async requests() {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      const users = userMapOf(db);
      return (db.friendships || [])
        .filter((f) => f.status === 'pending' && f.addresseeId === me.id)
        .map((f) => ({ id: f.id, user: users.get(f.requesterId) || null, note: f.note || '', createdAt: f.createdAt }))
        .filter((f) => f.user)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async outgoing() {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      const users = userMapOf(db);
      return (db.friendships || [])
        .filter((f) => f.status === 'pending' && f.requesterId === me.id)
        .map((f) => ({ id: f.id, user: users.get(f.addresseeId) || null, createdAt: f.createdAt }))
        .filter((f) => f.user)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async pendingCount() {
      const db = await ctx.db();
      const me = ctx.user();
      if (!me) return 0;
      return (db.friendships || []).filter((f) => f.status === 'pending' && f.addresseeId === me.id).length;
    },

    async search(q) {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      const needle = String(q || '').trim().toLowerCase();
      if (!needle) return [];
      return db.users
        .filter((u) => u.id !== me.id && u.status !== 'disabled')
        .filter((u) => u.username.toLowerCase().includes(needle) || String(u.nickname || '').toLowerCase().includes(needle))
        .slice(0, 20)
        .map((u) => ({ user: publicUser(u), relation: relationOf(db, me.id, u.id) }));
    },

    async request(userId, note = '') {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      if (userId === me.id) throw fail('friend.self');
      if (!db.users.some((u) => u.id === userId)) throw fail('friend.notFound');
      const existing = (db.friendships || []).find((f) => (
        (f.requesterId === me.id && f.addresseeId === userId)
        || (f.requesterId === userId && f.addresseeId === me.id)
      ));
      if (existing) {
        if (existing.status === 'accepted') throw fail('friend.already');
        if (existing.status === 'pending' && existing.requesterId === userId) {
          existing.status = 'accepted';
          existing.updatedAt = nowIso();
          await ctx.save();
          return 'accepted';
        }
        if (existing.status === 'pending') throw fail('friend.pending');
        existing.requesterId = me.id;
        existing.addresseeId = userId;
        existing.status = 'pending';
        existing.note = String(note || '').slice(0, 200);
        existing.updatedAt = nowIso();
        await ctx.save();
        return 'pending';
      }
      db.friendships.push({
        id: uid('fr'),
        requesterId: me.id,
        addresseeId: userId,
        status: 'pending',
        note: String(note || '').slice(0, 200),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      await ctx.save();
      return 'pending';
    },

    async accept(id) {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      const row = (db.friendships || []).find((f) => f.id === id && f.addresseeId === me.id && f.status === 'pending');
      if (!row) throw fail('friend.notFound');
      row.status = 'accepted';
      row.updatedAt = nowIso();
      await ctx.save();
      return true;
    },

    async decline(id) {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      const row = (db.friendships || []).find((f) => f.id === id && f.addresseeId === me.id && f.status === 'pending');
      if (!row) throw fail('friend.notFound');
      row.status = 'declined';
      row.updatedAt = nowIso();
      await ctx.save();
      return true;
    },

    async remove(userId) {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      const before = (db.friendships || []).length;
      db.friendships = db.friendships.filter((f) => !(
        (f.requesterId === me.id && f.addresseeId === userId)
        || (f.requesterId === userId && f.addresseeId === me.id)
      ));
      if (db.friendships.length === before) throw fail('friend.notFound');
      db.messages = db.messages.filter((m) => !(
        (m.fromId === me.id && m.toId === userId) || (m.fromId === userId && m.toId === me.id)
      ));
      await ctx.save();
      return true;
    },
  };
}

export function createMessagesApi(ctx) {
  const threadMessages = (db, meId, userId) => (db.messages || []).filter((m) => (
    (m.fromId === meId && m.toId === userId) || (m.fromId === userId && m.toId === meId)
  ));

  return {
    async list(userId, options = {}) {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      if (!areFriends(db, me.id, userId)) throw fail('friend.needFriend');
      let rows = threadMessages(db, me.id, userId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      if (options.limit) rows = rows.slice(-options.limit);
      return rows.map((m) => ({ ...m }));
    },

    async send(userId, payload = {}) {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      if (!areFriends(db, me.id, userId)) throw fail('friend.needFriend');
      const bodyMd = String(payload.bodyMd || '').slice(0, 4000);
      const media = payload.media || [];
      if (!bodyMd.trim() && !media.length) throw fail('msg.empty');
      const row = {
        id: uid('msg'),
        fromId: me.id,
        toId: userId,
        bodyMd,
        media,
        createdAt: nowIso(),
        readAt: null,
      };
      db.messages.push(row);
      await ctx.save();
      return { ...row };
    },

    async markRead(userId) {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      let changed = false;
      for (const m of db.messages) {
        if (m.fromId === userId && m.toId === me.id && !m.readAt) { m.readAt = nowIso(); changed = true; }
      }
      if (changed) await ctx.save();
      return true;
    },

    async unreadTotal() {
      const db = await ctx.db();
      const me = ctx.user();
      if (!me) return 0;
      return (db.messages || []).filter((m) => m.toId === me.id && !m.readAt).length;
    },

    async threads() {
      const db = await ctx.db();
      const me = requireLogin(ctx);
      const users = userMapOf(db);
      const out = new Map();
      for (const f of db.friendships || []) {
        if (f.status !== 'accepted' || (f.requesterId !== me.id && f.addresseeId !== me.id)) continue;
        const other = pairWith(f, me.id);
        out.set(other, { user: users.get(other) || null, last: null, unread: 0, since: f.updatedAt || f.createdAt });
      }
      for (const m of db.messages || []) {
        if (m.fromId !== me.id && m.toId !== me.id) continue;
        const other = m.fromId === me.id ? m.toId : m.fromId;
        if (!out.has(other)) out.set(other, { user: users.get(other) || null, last: null, unread: 0, since: m.createdAt });
        const entry = out.get(other);
        if (!entry.last || new Date(m.createdAt) >= new Date(entry.last.createdAt)) {
          entry.last = { bodyMd: m.bodyMd, media: m.media || [], createdAt: m.createdAt, fromId: m.fromId };
        }
        if (m.toId === me.id && !m.readAt) entry.unread += 1;
      }
      return Array.from(out.values())
        .filter((t) => t.user)
        .sort((a, b) => new Date(b.last?.createdAt || b.since) - new Date(a.last?.createdAt || a.since));
    },
  };
}
