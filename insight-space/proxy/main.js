/** Deno Deploy 入口：项目的 Entrypoint 指向本文件 */
import { createProxyHandler } from './supabase-proxy.js';

const handler = createProxyHandler({ upstream: Deno.env.get('SUPABASE_ORIGIN') });

Deno.serve(handler);
