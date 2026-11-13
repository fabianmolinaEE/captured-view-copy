// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { backendRequest } from "@/lib/research/server/backend.server";
import { makeSession } from "./research-fixtures";
const config = {
  url: "https://private.example",
  key: "server-secret",
  bucket: "research-recordings",
};
afterEach(() => vi.unstubAllGlobals());
function upload(id: string, version?: string) {
  const s = makeSession({ id });
  const { video_blob, ...document } = s;
  const form = new FormData();
  form.set("video", video_blob, "recording");
  form.set("document", JSON.stringify(document));
  return new Request(`https://app.example/api/research/sessions/${id}`, {
    method: "PUT",
    headers: version ? { "If-Match": version } : {},
    body: form,
  });
}
describe("private backend adapter", () => {
  it("persists complete document and video with server-only authorization", async () => {
    const id = crypto.randomUUID();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ public: false }))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    const response = await backendRequest(upload(id), config, id);
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(4);
    const videoCall = fetcher.mock.calls[2]!;
    expect(videoCall[0]).toContain(`/storage/v1/object/research-recordings/${id}/recording`);
    expect(videoCall[1].headers.Authorization).toBe("Bearer server-secret");
    const row = JSON.parse(fetcher.mock.calls[3]![1].body);
    expect(row.document).toHaveProperty("runs");
    expect(row.document).toHaveProperty("matches");
    expect(row.updated_at).toBe((await response.json()).synced_at);
  });
  it("refuses to upload into a public bucket", async () => {
    const id = crypto.randomUUID();
    const fetcher = vi.fn().mockResolvedValue(Response.json({ public: true }));
    vi.stubGlobal("fetch", fetcher);
    expect((await backendRequest(upload(id), config, id)).status).toBe(409);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("protects shared edits with optimistic concurrency", async () => {
    const id = crypto.randomUUID();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ public: false }))
        .mockResolvedValue(Response.json([{ id, updated_at: "2026-11-11T00:00:00+00:00" }])),
    );
    expect((await backendRequest(upload(id, "2026-11-10T00:00:00Z"), config, id)).status).toBe(409);
  });
  it("updates metadata without reuploading video and accepts equivalent ISO timestamps", async () => {
    const id = crypto.randomUUID();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ public: false }))
      .mockResolvedValueOnce(Response.json([{ id, updated_at: "2026-11-11T00:00:00+00:00" }]))
      .mockResolvedValueOnce(Response.json([{ id }]));
    vi.stubGlobal("fetch", fetcher);
    expect((await backendRequest(upload(id, "2026-11-11T00:00:00.000Z"), config, id)).status).toBe(
      200,
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2]![1].method).toBe("PATCH");
  });
  it("fetches authenticated private video and document, never a public URL", async () => {
    const s = makeSession();
    const { video_blob, ...document } = s;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json([{ document, updated_at: s.created_at }]))
      .mockResolvedValueOnce(new Response(video_blob));
    vi.stubGlobal("fetch", fetcher);
    const result = await backendRequest(
      new Request(`https://app.example/api/research/sessions/${s.id}`),
      config,
      s.id,
    );
    const form = await result.formData();
    expect(JSON.parse(String(form.get("document"))).sync.state).toBe("synced");
    expect(fetcher.mock.calls[1]![0]).toContain("/object/authenticated/");
    expect(form.get("video")).toBeInstanceOf(Blob);
  });
  it("deletes both private object and research document using the storage bulk-delete protocol", async () => {
    const id = crypto.randomUUID();
    const fetcher = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetcher);
    await backendRequest(
      new Request(`https://app.example/api/research/sessions/${id}`, { method: "DELETE" }),
      config,
      id,
    );
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ prefixes: [`${id}/recording`] });
    expect(fetcher.mock.calls[1]![0]).toContain("/rest/v1/research_sessions");
  });
});
