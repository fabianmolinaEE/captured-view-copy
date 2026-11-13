import { z } from "zod";
import { analysisInput, analyze } from "./analysis.server";
import { backendRequest } from "./backend.server";
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
type Bindings = Record<string, unknown>;
const running = new Set<string>();
export function serverConfig(bindings: unknown = {}) {
  const env = bindings && typeof bindings === "object" ? (bindings as Bindings) : {};
  const read = (key: string) =>
    String(env[key] ?? (typeof process !== "undefined" ? process.env[key] : "") ?? "").trim();
  return {
    gemini: read("GEMINI_API_KEY"),
    model: read("GEMINI_MODEL") || DEFAULT_MODEL,
    access: read("RESEARCH_ACCESS_TOKEN"),
    url: read("SUPABASE_URL"),
    key: read("SUPABASE_SERVICE_ROLE_KEY"),
    bucket: read("RESEARCH_VIDEO_BUCKET") || "research-recordings",
  };
}
async function equal(a: string, b: string) {
  const hash = async (s: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}
export async function handleResearchRequest(request: Request, bindings: unknown = {}) {
  const url = new URL(request.url);
  const config = serverConfig(bindings);
  const json = (data: unknown, status = 200) =>
    Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.pathname === "/api/research/status" && request.method === "GET")
    return json({
      configured: !!config.gemini,
      model: config.model,
      backend_configured: !!(config.url && config.key),
      access_required: !!config.access || !local,
      message: config.gemini
        ? "Gemini is configured. Analysis sends consented checkout frames and events to Google."
        : "Set GEMINI_API_KEY in server secrets to enable real analysis.",
    });
  // Browser Origin protection plus an explicit shared workspace credential. Local dev may omit the credential.
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin)
    return json({ error: "Cross-origin research requests are not allowed." }, 403);
  if (!config.access && !local)
    return json(
      { error: "Set RESEARCH_ACCESS_TOKEN on the server before enabling remote research APIs." },
      503,
    );
  if (
    config.access &&
    !(await equal(request.headers.get("Authorization") ?? "", `Bearer ${config.access}`))
  )
    return json(
      { error: "Workspace access required. Enter the team access code in Settings." },
      401,
    );
  try {
    if (url.pathname === "/api/research/analyze" && request.method === "POST") {
      if (!config.gemini)
        return json({ error: "AI is not configured. Set GEMINI_API_KEY on the server." }, 503);
      if (Number(request.headers.get("Content-Length")) > 24 * 1024 * 1024)
        return json({ error: "Analysis payload exceeds 24 MB." }, 413);
      const body = await request.text();
      if (body.length > 24 * 1024 * 1024)
        return json({ error: "Analysis payload exceeds 24 MB." }, 413);
      const input = analysisInput.parse(JSON.parse(body));
      if (running.has(input.session_id))
        return json({ error: "This session already has an analysis in progress." }, 409);
      // This guard is per process/isolate; the browser also guards per session.
      if (running.size >= 3)
        return json({ error: "Analysis capacity is busy. Retry after another run finishes." }, 429);
      running.add(input.session_id);
      try {
        return json(await analyze(input, config.gemini, config.model));
      } finally {
        running.delete(input.session_id);
      }
    }
    if (url.pathname.startsWith("/api/research/sessions")) {
      if (!config.url || !config.key)
        return json(
          { error: "Private shared storage is not configured. Local data remains available." },
          503,
        );
      const match = /^\/api\/research\/sessions(?:\/([a-f0-9-]{36}))?$/.exec(url.pathname);
      if (!match) return json({ error: "Unknown endpoint." }, 404);
      const response = await backendRequest(
        request,
        { url: config.url, key: config.key, bucket: config.bucket },
        match[1],
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    return json({ error: "Unknown endpoint or method." }, 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error:
            "Invalid analysis input or model response: " +
            error.issues
              .slice(0, 3)
              .map((e) => `${e.path.join(".")}: ${e.message}`)
              .join("; "),
        },
        422,
      );
    if (error instanceof SyntaxError)
      return json({ error: "Invalid JSON received. No analysis was saved." }, 422);
    return json(
      { error: error instanceof Error ? error.message : "Research request failed." },
      502,
    );
  }
}
