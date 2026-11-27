export {};

const origin = "https://joseph1234-web.github.io";
const bucket = "ekklo-presenter-downloads";
const partSize = 40 * 1024 * 1024;
const encoder = new TextEncoder();
const androidRelease = {
  fileName: "Ekklo_Android_1.17.0.apk",
  bytes: 149_698_468,
  contentType: "application/vnd.android.package-archive",
} as const;

function reply(status: number, body: Record<string, unknown> | null = null) {
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  return body === null
    ? new Response(null, { status, headers })
    : Response.json(body, { status, headers });
}

async function digest(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return [...new Uint8Array(bytes)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function readLicense(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) return "";
  let text = "";
  let size = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return "";
      }
      text += decoder.decode(value, { stream: true });
    }
    const body = JSON.parse(text + decoder.decode());
    return typeof body?.license === "string"
      ? body.license.toUpperCase().replace(/\s+/g, "")
      : "";
  } catch {
    return "";
  } finally {
    reader.releaseLock();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply(204);
  const requestOrigin = req.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) return reply(403, { code: "origin" });
  if (req.method !== "POST") return reply(405, { code: "method" });
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { code: "signin" });

  try {
    const project = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ??
      JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default;
    const roleToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const service = roleToken ??
      JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
    if (!project || !anon || !service) return reply(503, { code: "unavailable" });
    const account = await fetch(`${project}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: authorization },
      signal: AbortSignal.timeout(8000),
    });
    if (account.status === 401 || account.status === 403) {
      return reply(401, { code: "signin" });
    }
    if (!account.ok) return reply(503, { code: "unavailable" });
    const user = await account.json();
    if (!user || typeof user !== "object" ||
      !("id" in user) || typeof user.id !== "string" ||
      !("email" in user) || !user.email ||
      !("email_confirmed_at" in user) || !user.email_confirmed_at ||
      ("is_anonymous" in user && user.is_anonymous)) {
      return reply(401, { code: "signin" });
    }

    const license = await readLicense(req);
    if (!/^LHP(?:-[A-Z0-9]{6}){5}$/.test(license)) {
      return reply(400, { code: "invalid" });
    }
    const headers: Record<string, string> = {
      apikey: service,
      "Content-Type": "application/json",
    };
    if (roleToken) headers.Authorization = `Bearer ${roleToken}`;
    const check = await fetch(`${project}/rest/v1/rpc/ekklo_check_presenter_android_license`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_key_digest: await digest(license),
        p_account_digest: await digest(`presenter-android-download:${user.id}`),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!check.ok) return reply(503, { code: "unavailable" });
    const result = await check.json();
    if (result === "limited") return reply(429, { code: "limited" });
    if (result === "invalid") return reply(403, { code: "invalid" });
    if (result !== "accepted") return reply(503, { code: "unavailable" });

    const paths = Array.from({ length: Math.ceil(androidRelease.bytes / partSize) }, (_, index) =>
      `${androidRelease.fileName}.part-${String(index).padStart(2, "0")}.bin`);
    const signed = await fetch(`${project}/storage/v1/object/sign/${bucket}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paths, expiresIn: 900 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!signed.ok) return reply(503, { code: "unavailable" });
    const parts = await signed.json();
    if (!Array.isArray(parts)) return reply(503, { code: "unavailable" });
    const urls = paths.map((path) => {
      const part = parts.find((candidate) => candidate.path === path);
      const suffix = part?.signedURL ?? part?.signedUrl;
      if (typeof suffix !== "string" || !suffix.startsWith(`/object/sign/${bucket}/`)) {
        throw new Error("No signed release part");
      }
      return `${project}/storage/v1${suffix}`;
    });
    return reply(200, { ...androidRelease, urls });
  } catch {
    return reply(503, { code: "unavailable" });
  }
});
