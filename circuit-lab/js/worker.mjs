import { simulate } from './engine.mjs';
self.onmessage = async (event) => {
  try {
    const start = performance.now();
    const result = await simulate(event.data);
    self.postMessage({ ok: true, result, elapsed: performance.now() - start });
  } catch (error) {
    self.postMessage({ ok: false, error: error.message });
  }
};
