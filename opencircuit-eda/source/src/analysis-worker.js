import { executeAnalysis } from './analysis-engine.js';

self.onmessage = async ({ data }) => {
  try {
    const { default: createModule } = await import(/* @vite-ignore */ data.moduleURL);
    const result = await executeAnalysis(data.request, createModule);
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({ ok: false, error: error.message || String(error) });
  }
};
