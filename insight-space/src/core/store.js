/** 极简状态容器 + 事件总线 */

const listeners = new Map();

export const state = {
  user: null,
  modules: [],
  ready: false,
  mode: 'local',
  route: { name: 'home', params: {} },
};

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

export function emit(event, detail) {
  listeners.get(event)?.forEach((handler) => {
    try { handler(detail); } catch (error) { console.error('[store]', event, error); }
  });
}

export function setState(patch) {
  Object.assign(state, patch);
  emit('state', state);
}
