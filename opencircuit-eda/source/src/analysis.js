export { inferAnalysis, engineeringNumber, analysisCommand } from './analysis-deck.js';

/** Run one isolated browser-local ngspice analysis. An AbortSignal can cancel a pending run. */
export function runAnalysis({ files, entry, config }, { signal } = {}) {
  if (signal?.aborted) return Promise.reject(new DOMException('仿真已取消', 'AbortError'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analysis-worker.js', import.meta.url), { type: 'module' });
    const abort = () => finish(reject, new DOMException('仿真已取消', 'AbortError'));
    const timer = setTimeout(
      () => finish(reject, new Error('仿真超过 60 秒，请缩小扫描范围或检查收敛设置')),
      60000,
    );
    function finish(done, value) {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      done(value);
    }
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = (event) =>
      finish(reject, new Error(event.message || 'ngspice 工作线程加载失败，请使用 HTTP(S) 打开工作台'));
    worker.onmessageerror = () => finish(reject, new Error('无法读取工作线程的结果'));
    worker.onmessage = ({ data }) =>
      data.ok ? finish(resolve, data.result) : finish(reject, new Error(data.error));
    try {
      const request = { files: files.map(({ path, content }) => ({ path, content })), entry, config };
      worker.postMessage({ request, moduleURL: new URL('./engine/ngspice.mjs', document.baseURI).href });
    } catch (error) {
      finish(reject, error);
    }
  });
}
