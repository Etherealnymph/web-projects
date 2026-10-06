// 超管账号管理：重置密码 / 删除账号（走 service_role 的 Auth Admin API）
//
// 背景：新版 Supabase 已收回 postgres 对 auth.users 的写权限，SQL 里直接
// update/delete auth.users 会报 403。这里改用 Edge Function + service_role，
// 由服务端调用 GoTrue Admin API 完成这两个操作。
//
// 部署（本地需先 `supabase login` 且项目已 link）：
//   supabase functions deploy admin-auth --no-verify-jwt
// 说明：--no-verify-jwt 表示函数自行校验调用者，而不是依赖 Supabase 网关的 JWT 校验。
//       SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自动注入为环境变量。

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "bad_request" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. 从 Authorization 头解析调用者 JWT，确认其确为已登录的超管
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "superadmin") return json({ error: "forbidden" }, 403);

  // 2. 解析请求体
  let body: { action?: string; userId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  if (body.action === "reset_password") {
    const userId = body.userId;
    const password = String(body.password || "");
    if (!userId || password.length < 6) return json({ error: "invalid_password" }, 400);

    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: "user_not_found" }, 404);

    // 与旧逻辑一致：重置后强制下次登录改密
    await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
    return json({ ok: true });
  }

  if (body.action === "delete_user") {
    const userId = body.userId;
    if (!userId) return json({ error: "bad_request" }, 400);
    if (userId === user.id) return json({ error: "self_delete" }, 400);

    const { data: target } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (!target) return json({ error: "user_not_found" }, 404);

    if (target.role === "superadmin") {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "superadmin")
        .eq("status", "active");
      if ((count ?? 0) <= 1) return json({ error: "last_superadmin" }, 400);
    }

    // 删除 auth.users 会级联删除 profiles → contents/comments/reactions/grants
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: "user_not_found" }, 404);
    return json({ ok: true });
  }

  return json({ error: "bad_request" }, 400);
});
