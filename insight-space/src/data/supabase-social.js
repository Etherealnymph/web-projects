/** Supabase：好友关系与私信 */

import { fail, mapUser } from './sb-core.js';

async function fetchUsers(client, ids) {
  if (!ids.length) return new Map();
  const { data } = await client.from('profiles').select('*').in('id', ids);
  return new Map((data || []).map((p) => [p.id, mapUser(p)]));
}

function pairOf(row, meId) {
  return row.requester_id === meId ? row.addressee_id : row.requester_id;
}

function pairFilter(meId, otherId) {
  return `and(requester_id.eq.${meId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${meId})`;
}

export function createFriendsApi(sb) {
  const { client } = sb;

  async function findPair(meId, otherId) {
    const { data } = await client.from('friendships').select('*').or(pairFilter(meId, otherId)).limit(1);
    return (data || [])[0] || null;
  }

  const api = {
    async relation(userId) {
      const me = sb.uid();
      if (!me || !userId) return 'none';
      if (me === userId) return 'self';
      const row = await findPair(me, userId);
      if (!row) return 'none';
      if (row.status === 'accepted') return 'accepted';
      if (row.status !== 'pending') return 'none';
      return row.requester_id === me ? 'pending_out' : 'pending_in';
    },

    async list() {
      const me = sb.requireUser();
      const { data, error } = await client.from('friendships').select('*').eq('status', 'accepted')
        .or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`);
      if (error) throw fail('msg.error');
      const rows = data || [];
      const users = await fetchUsers(client, rows.map((r) => pairOf(r, me.id)));
      return rows
        .map((r) => ({ id: r.id, user: users.get(pairOf(r, me.id)) || null, since: r.updated_at || r.created_at }))
        .filter((r) => r.user)
        .sort((a, b) => new Date(b.since) - new Date(a.since));
    },

    async requests() {
      const me = sb.requireUser();
      const { data, error } = await client.from('friendships').select('*')
        .eq('status', 'pending').eq('addressee_id', me.id).order('created_at', { ascending: false });
      if (error) throw fail('msg.error');
      const rows = data || [];
      const users = await fetchUsers(client, rows.map((r) => r.requester_id));
      return rows.map((r) => ({ id: r.id, user: users.get(r.requester_id) || null, note: r.note || '', createdAt: r.created_at }))
        .filter((r) => r.user);
    },

    async outgoing() {
      const me = sb.requireUser();
      const { data, error } = await client.from('friendships').select('*')
        .eq('status', 'pending').eq('requester_id', me.id).order('created_at', { ascending: false });
      if (error) throw fail('msg.error');
      const rows = data || [];
      const users = await fetchUsers(client, rows.map((r) => r.addressee_id));
      return rows.map((r) => ({ id: r.id, user: users.get(r.addressee_id) || null, createdAt: r.created_at }))
        .filter((r) => r.user);
    },

    async pendingCount() {
      const me = sb.uid();
      if (!me) return 0;
      const { count } = await client.from('friendships')
        .select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('addressee_id', me);
      return count || 0;
    },

    async search(q) {
      const me = sb.requireUser();
      const needle = String(q || '').trim();
      if (!needle) return [];
      const { data, error } = await client.from('profiles').select('*').neq('id', me.id)
        .or(`username.ilike.%${needle}%,nickname.ilike.%${needle}%`).limit(20);
      if (error) throw fail('msg.error');
      const rows = data || [];
      const rels = await Promise.all(rows.map((u) => api.relation(u.id)));
      return rows.map((u, i) => ({ user: mapUser(u), relation: rels[i] }));
    },

    async request(userId, note = '') {
      const me = sb.requireUser();
      if (userId === me.id) throw fail('friend.self');
      const existing = await findPair(me.id, userId);
      if (existing) {
        if (existing.status === 'accepted') throw fail('friend.already');
        if (existing.status === 'pending' && existing.requester_id === userId) {
          const { error } = await client.from('friendships')
            .update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', existing.id);
          if (error) throw fail('msg.error');
          return 'accepted';
        }
        if (existing.status === 'pending') throw fail('friend.pending');
        const { error } = await client.from('friendships')
          .update({
            requester_id: me.id, addressee_id: userId, status: 'pending',
            note: String(note || '').slice(0, 200), updated_at: new Date().toISOString(),
          }).eq('id', existing.id);
        if (error) throw fail('msg.error');
        return 'pending';
      }
      const { error } = await client.from('friendships').insert({
        requester_id: me.id,
        addressee_id: userId,
        status: 'pending',
        note: String(note || '').slice(0, 200),
      });
      if (error) throw fail('msg.error');
      return 'pending';
    },

    async accept(id) {
      const me = sb.requireUser();
      const { data, error } = await client.from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', id).eq('addressee_id', me.id).eq('status', 'pending').select('id');
      if (error) throw fail('msg.error');
      if (!data || !data.length) throw fail('friend.notFound');
      return true;
    },

    async decline(id) {
      const me = sb.requireUser();
      const { data, error } = await client.from('friendships')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', id).eq('addressee_id', me.id).eq('status', 'pending').select('id');
      if (error) throw fail('msg.error');
      if (!data || !data.length) throw fail('friend.notFound');
      return true;
    },

    async remove(userId) {
      const me = sb.requireUser();
      const { data, error } = await client.from('friendships').delete()
        .or(pairFilter(me.id, userId)).select('id');
      if (error) throw fail('msg.error');
      if (!data || !data.length) throw fail('friend.notFound');
      await client.from('messages').delete()
        .or(`and(from_id.eq.${me.id},to_id.eq.${userId}),and(from_id.eq.${userId},to_id.eq.${me.id})`);
      return true;
    },
  };

  return api;
}

export function createMessagesApi(sb) {
  const { client } = sb;

  async function areFriends(meId, otherId) {
    const { data } = await client.from('friendships').select('status')
      .eq('status', 'accepted').or(pairFilter(meId, otherId)).limit(1);
    return Boolean((data || []).length);
  }

  const dial = (meId, otherId) => `and(from_id.eq.${meId},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${meId})`;
  const mapMessage = (row) => ({
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    bodyMd: row.body_md || '',
    media: row.media || [],
    createdAt: row.created_at,
    readAt: row.read_at,
  });

  const api = {
    async list(userId, options = {}) {
      const me = sb.requireUser();
      let query = client.from('messages').select('*').or(dial(me.id, userId)).order('created_at', { ascending: true });
      if (options.limit) query = query.limit(options.limit);
      const { data, error } = await query;
      if (error) throw fail('msg.error');
      return (data || []).map(mapMessage);
    },

    async send(userId, payload = {}) {
      const me = sb.requireUser();
      if (!(await areFriends(me.id, userId))) throw fail('friend.needFriend');
      const bodyMd = String(payload.bodyMd || '').slice(0, 4000);
      const media = payload.media || [];
      if (!bodyMd.trim() && !media.length) throw fail('msg.empty');
      const { data, error } = await client.from('messages')
        .insert({ from_id: me.id, to_id: userId, body_md: bodyMd, media })
        .select().single();
      if (error) throw fail('msg.error');
      return mapMessage(data);
    },

    async markRead(userId) {
      const me = sb.requireUser();
      await client.from('messages').update({ read_at: new Date().toISOString() })
        .eq('from_id', userId).eq('to_id', me.id).is('read_at', null);
      return true;
    },

    async unreadTotal() {
      const me = sb.uid();
      if (!me) return 0;
      const { count } = await client.from('messages')
        .select('id', { count: 'exact', head: true }).eq('to_id', me).is('read_at', null);
      return count || 0;
    },

    async threads() {
      const me = sb.requireUser();
      const [friendRes, msgRes] = await Promise.all([
        client.from('friendships').select('*').eq('status', 'accepted')
          .or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`),
        client.from('messages').select('*')
          .or(`from_id.eq.${me.id},to_id.eq.${me.id}`)
          .order('created_at', { ascending: false }).limit(500),
      ]);
      if (friendRes.error) throw fail('msg.error');
      const rows = friendRes.data || [];
      const msgs = msgRes.data || [];
      const users = await fetchUsers(client, rows.map((r) => pairOf(r, me.id)));
      const out = new Map();
      for (const f of rows) {
        const other = pairOf(f, me.id);
        out.set(other, { user: users.get(other) || null, last: null, unread: 0, since: f.updated_at || f.created_at });
      }
      for (const m of msgs) {
        const other = m.from_id === me.id ? m.to_id : m.from_id;
        if (!out.has(other)) out.set(other, { user: null, last: null, unread: 0, since: m.created_at });
        const entry = out.get(other);
        if (!entry.last) entry.last = { bodyMd: m.body_md, media: m.media || [], createdAt: m.created_at, fromId: m.from_id };
        if (m.to_id === me.id && !m.read_at) entry.unread += 1;
      }
      const missing = Array.from(out.entries()).filter(([, v]) => !v.user).map(([k]) => k);
      if (missing.length) {
        const extra = await fetchUsers(client, missing);
        for (const [key, value] of out) if (!value.user) value.user = extra.get(key) || null;
      }
      return Array.from(out.values())
        .filter((t) => t.user)
        .sort((a, b) => new Date(b.last?.createdAt || b.since) - new Date(a.last?.createdAt || a.since));
    },
  };

  return api;
}
