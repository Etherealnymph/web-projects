/**
 * 本地调试用的反向代理服务（Node 18+，无需任何依赖）。
 *
 *   node insight-space/proxy/dev.mjs
 *   # 然后访问 http://127.0.0.1:8787/health
 *
 * 与部署到 Deno Deploy 的是同一份处理器，用于在推送前本地验证。
 */
import http from 'node:http';
import { Readable } from 'node:stream';
import { createProxyHandler } from './supabase-proxy.js';

const PORT = Number(process.env.PORT || 8787);
const handler = createProxyHandler({ upstream: process.env.SUPABASE_ORIGIN });

const server = http.createServer(async (req, res) => {
  const init = { method: req.method, headers: req.headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = Readable.toWeb(req);
    init.duplex = 'half';
  }

  let webResponse;
  try {
    webResponse = await handler(new Request(`http://127.0.0.1:${PORT}${req.url}`, init));
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`本地代理异常：${error?.stack || error}`);
    return;
  }

  res.writeHead(webResponse.status, Object.fromEntries(webResponse.headers));
  if (webResponse.body) {
    for await (const chunk of webResponse.body) res.write(chunk);
  }
  res.end();
});

server.listen(PORT, () => {
  console.log(`Supabase 代理已启动：http://127.0.0.1:${PORT}`);
  console.log(`上游：${process.env.SUPABASE_ORIGIN || '默认项目'}`);
});
