import { z } from "zod";
// One JSON document per session preserves the prototype schema without a framework migration.
// Provision this table and private bucket through Lovable; this adapter never creates schema.
export interface BackendConfig {
  url: string;
  key: string;
  bucket: string;
}
const idSchema = z.string().uuid();
const documentSchema = z
  .object({
    id: idSchema,
    title: z.string().max(300),
    created_at: z.string().datetime(),
    mime_type: z.string().regex(/^video\//),
    extension: z.enum(["webm", "mp4"]),
    duration_ms: z.number().nonnegative(),
    events: z.array(z.unknown()).max(10000),
    findings: z.array(z.unknown()).max(10000),
    issues: z.array(z.unknown()),
    matches: z.array(z.unknown()),
    runs: z.array(z.unknown()),
  })
  .passthrough();
export async function backendRequest(request: Request, config: BackendConfig, id?: string) {
  if (id) idSchema.parse(id);
  const base = config.url.replace(/\/$/, "");
  const headers = { apikey: config.key, Authorization: `Bearer ${config.key}` };
  const upstream = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw new Error(
        `Private backend operation failed (HTTP ${response.status}). Check Lovable table, private bucket and server permissions.`,
      );
    return response;
  };
  const table = "/rest/v1/research_sessions";
  const storage = `/storage/v1/object/${encodeURIComponent(config.bucket)}/${id}/recording`;
  if (request.method === "GET" && !id) {
    const response = await upstream(
      `${table}?select=id,title,created_at&order=created_at.desc&limit=100`,
    );
    return Response.json(await response.json());
  }
  if (!id) return Response.json({ error: "Session ID is required." }, { status: 400 });
  if (request.method === "PUT") {
    if (Number(request.headers.get("Content-Length")) > 30 * 1024 * 1024)
      return Response.json({ error: "Shared upload exceeds 30 MB." }, { status: 413 });
    const data = await request.formData();
    const video = data.get("video");
    const raw = data.get("document");
    if (
      !(video instanceof Blob) ||
      typeof raw !== "string" ||
      video.size > 25 * 1024 * 1024 ||
      raw.length > 5 * 1024 * 1024
    )
      return Response.json(
        { error: "Expected a video under 25 MB and session document under 5 MB." },
        { status: 400 },
      );
    const document = documentSchema.parse(JSON.parse(raw));
    if (
      document.id !== id ||
      !video.size ||
      !["video/webm", "video/mp4"].some((type) => document.mime_type.startsWith(type))
    )
      return Response.json({ error: "Session ID or video metadata is invalid." }, { status: 400 });
    const bucket = (await (
      await upstream(`/storage/v1/bucket/${encodeURIComponent(config.bucket)}`)
    ).json()) as { public?: boolean };
    if (bucket.public !== false)
      return Response.json(
        {
          error:
            "Uploads require a verified private bucket. Change the bucket visibility through Lovable.",
        },
        { status: 409 },
      );
    const previous = await upstream(`${table}?id=eq.${id}&select=id,updated_at`);
    const rows = (await previous.json()) as { id: string; updated_at: string }[];
    const synced_at = new Date(
      Math.max(Date.now(), rows[0] ? new Date(rows[0].updated_at).getTime() + 1 : 0),
    ).toISOString();
    if (rows.length) {
      const version = request.headers.get("If-Match");
      if (!version || new Date(version).getTime() !== new Date(rows[0]!.updated_at).getTime())
        return Response.json(
          {
            error:
              "Another researcher changed this shared session. Export local edits before importing the latest shared copy.",
          },
          { status: 409 },
        );
      const response = await upstream(
        `${table}?id=eq.${id}&updated_at=eq.${encodeURIComponent(version)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ document, title: document.title, updated_at: synced_at }),
        },
      );
      if (!((await response.json()) as unknown[]).length)
        return Response.json(
          { error: "A concurrent shared edit was detected. Your local data is unchanged." },
          { status: 409 },
        );
      return Response.json({ synced_at });
    }
    // Upload a new private video; subsequent document edits use optimistic concurrency.
    await upstream(storage, {
      method: "POST",
      headers: { "Content-Type": document.mime_type },
      body: video,
    });
    try {
      await upstream(table, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: document.title,
          created_at: document.created_at,
          document,
          updated_at: synced_at,
        }),
      });
    } catch (error) {
      await upstream(`/storage/v1/object/${encodeURIComponent(config.bucket)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [`${id}/recording`] }),
      }).catch(() => {});
      throw error;
    }
    return Response.json({ synced_at });
  }
  if (request.method === "GET") {
    const response = await upstream(`${table}?id=eq.${id}&select=document,updated_at`);
    const rows = (await response.json()) as {
      document: Record<string, unknown>;
      updated_at: string;
    }[];
    if (!rows[0]) return Response.json({ error: "Shared session not found." }, { status: 404 });
    const video = await upstream(
      `/storage/v1/object/authenticated/${encodeURIComponent(config.bucket)}/${id}/recording`,
    );
    const form = new FormData();
    form.set(
      "document",
      JSON.stringify({
        ...rows[0].document,
        sync: { state: "synced", synced_at: rows[0].updated_at },
      }),
    );
    form.set("video", await video.blob(), "recording");
    return new Response(form);
  }
  if (request.method === "DELETE") {
    await upstream(`/storage/v1/object/${encodeURIComponent(config.bucket)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [`${id}/recording`] }),
    });
    await upstream(`${table}?id=eq.${id}`, { method: "DELETE" });
    return Response.json({ deleted: true });
  }
  return Response.json({ error: "Method not allowed." }, { status: 405 });
}
