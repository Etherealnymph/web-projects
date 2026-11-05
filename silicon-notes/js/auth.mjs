import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLIC_NOTES_TABLE } from './config.mjs';

const SESSION_KEY = 'silicon-notes.auth.v1';
const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    throw new Error('浏览器不允许保存登录状态，请检查站点存储权限');
  }
}
async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
  });
  const body = await response.text();
  let data = null;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    data = null;
  }
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || `云端请求失败 (${response.status})`);
  return data;
}

export function currentSession() {
  return readSession();
}
export function currentUser() {
  return readSession()?.user || null;
}
export async function restoreSession() {
  const session = readSession();
  if (!session?.access_token) return null;
  try {
    const user = await request('/auth/v1/user', { accessToken: session.access_token });
    const next = { ...session, user };
    saveSession(next);
    return next;
  } catch {
    saveSession(null);
    return null;
  }
}
export async function signUp(email, password) {
  const data = await request('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (data.access_token) saveSession(data);
  return data;
}
export async function signIn(email, password) {
  const data = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveSession(data);
  return data;
}
export async function signOut() {
  const session = readSession();
  if (session?.access_token) await request('/auth/v1/logout', { method: 'POST', accessToken: session.access_token });
  saveSession(null);
}
export async function listPublishedNotes() {
  const data = await request(`/rest/v1/${SUPABASE_PUBLIC_NOTES_TABLE}?select=note&order=updated_at.desc`);
  return data.map((row) => row.note);
}
export async function publishNote(note) {
  const session = readSession();
  if (!session?.access_token || !session.user?.id) throw new Error('请先登录，再发布公开笔记');
  const rows = await request(`/rest/v1/${SUPABASE_PUBLIC_NOTES_TABLE}?on_conflict=id`, {
    method: 'POST',
    accessToken: session.access_token,
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: note.id, owner_id: session.user.id, note }),
  });
  return rows[0]?.note || note;
}
