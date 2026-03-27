import { createClient } from "@supabase/supabase-js";

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 配置");
  }

  return url;
}

function getSupabasePublishableKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!key) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY 配置");
  }

  return key;
}

function getSupabaseServerKey() {
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    throw new Error("缺少 SUPABASE_SECRET_KEY 或 SUPABASE_SERVICE_ROLE_KEY 配置");
  }

  return key;
}

export function getSupabaseAdmin() {
  return createClient(getSupabaseUrl(), getSupabaseServerKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function formatSupabaseError(error: unknown) {
  const currentUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "未配置";

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const code =
      "code" in error && typeof error.code === "string"
        ? error.code
        : "";
    const message = error.message;

    if (
      code === "ENOTFOUND" ||
      code === "UND_ERR_CONNECT_TIMEOUT" ||
      message.includes("fetch failed")
    ) {
      return `Supabase 无法连接，请检查 NEXT_PUBLIC_SUPABASE_URL。当前地址：${currentUrl}`;
    }

    if (code === "23505") {
      return "数据已存在，不能重复提交";
    }

    return message;
  }

  if (error instanceof Error) {
    if (error.message.includes("fetch failed")) {
      return `Supabase 无法连接，请检查 NEXT_PUBLIC_SUPABASE_URL。当前地址：${currentUrl}`;
    }

    return error.message;
  }

  return "服务器异常";
}
