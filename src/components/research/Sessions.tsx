import {
  evidenceDuration,
  pregeneratedLabel,
  publicSessionNotes,
} from "@/lib/research/publicVideo";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import { notifySessionsChanged } from "@/lib/research/demo/importTrackerRuns";
import { useProduct } from "@/hooks/use-product";
import {
  sessionsForProduct,
  productNameForSource,
  isArchivedSession,
} from "@/lib/research/products";
import { competitorOf, competitorSessionsFor } from "@/lib/research/competitors";
import { discardRunsForSession } from "@/lib/research/simulation";
import { PublicSourceLibrary } from "./UberEatsSources";
import { ScoutMascot } from "./ScoutMascot";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CirclePlus,
  Clapperboard,
  Sparkles,
  CheckCheck,
  Clock3,
  Search,
  ArrowRight,
  ShieldCheck,
  FlaskConical,
  Film,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hero } from "./Hero";
import { Shell, PageHeading, Footer } from "./Shell";
import {
  deleteSession,
  listSessions,
  exportSession,
  downloadFile,
} from "@/lib/research/sessionStorage";
import { listShared, fetchShared, type SharedSummary } from "@/lib/research/sharedStorage";
import { duration, type Session } from "@/lib/research/types";
/** Caveats such as "Historical UI (2020)" or "Tracker found no insights in this clip". */
function SessionNotes({ session }: { session: Session }) {
  const notes = publicSessionNotes(session);
  if (!notes.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {notes.map((note) => (
        <span
          key={note}
          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          {note}
        </span>
      ))}
    </div>
  );
}
export function Sessions() {
  const navigate = useNavigate();
  const [shared, setShared] = useState<SharedSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const { productId, product } = useProduct();
  const [allSessions, setSessions] = useState<Session[]>([]);
  const sessions = sessionsForProduct(allSessions, productId);
  const archived = allSessions.filter(isArchivedSession);
  const competitor = competitorOf(productId);
  const competitorSessions = competitorSessionsFor(allSessions, productId);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All sessions");
  const [search, setSearch] = useState("");
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  // The automatic Tracker import can finish after this list has loaded.
  useSessionsChanged(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {});
  });
  const shown = sessions.filter(
    (s) =>
      (filter === "All sessions" || s.status === filter.toLowerCase()) &&
      s.title.toLowerCase().includes(search.toLowerCase()),
  );
  const stats = [
    {
      title: "Total sessions",
      value: sessions.length,
      sub: "This product",
      icon: Clapperboard,
    },
    {
      title: "AI proposals",
      value: sessions.reduce((n, s) => n + s.findings.length, 0),
      sub: "Real model output",
      icon: Sparkles,
    },
    {
      title: "Reviewed sessions",
      value: sessions.filter((s) => s.status === "reviewed").length,
      sub: "Checked by a person",
      icon: CheckCheck,
    },
    {
      title: "Recorded time",
      value: duration(sessions.reduce((n, s) => n + evidenceDuration(s), 0)),
      sub: "Total footage",
      icon: Clock3,
    },
  ];
  const record = (
    <Button asChild>
      <Link to="/test-app">
        <CirclePlus />
        {productId === "uber-eats" ? "Add recording" : "Record a session"}
      </Link>
    </Button>
  );
  return (
    <Shell section="Sessions">
      <PageHeading
        title="Sessions"
        description={`${product?.name ?? "Product"} · Recordings and review progress`}
        action={record}
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setShared(await listShared());
            } catch (e) {
              setError(e instanceof Error ? e.message : "Shared loading failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Load team’s shared sessions
        </Button>
      </div>
      {sessionsForProduct(shared, productId).map((s) => (
        <div className="flex justify-between gap-2 mb-3" key={s.id}>
          <span className="text-sm">{s.title} · Shared</span>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              if (
                allSessions.some((local) => local.id === s.id) &&
                !window.confirm(
                  "Replace the local copy with the shared version? Export any unsynced local edits first.",
                )
              )
                return;
              setBusy(true);
              try {
                await fetchShared(s.id);
                setSessions(await listSessions());
              } catch (e) {
                setError(e instanceof Error ? e.message : "Import failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Import private copy
          </Button>
        </div>
      ))}
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat" key={s.title}>
            <div className="stat-title">
              {s.title}
              <s.icon />
            </div>
            <div className="stat-value">{loaded ? s.value : "—"}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="section-toolbar">
        <div className="filter-tabs">
          {["All sessions", "Captured", "Analyzed", "Reviewed"].map((f) => (
            <Button
              key={f}
              variant="ghost"
              className={`filter-tab ${filter === f ? "selected" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
              {f === "All sessions" && (
                <span className="text-[10px] rounded bg-secondary px-1.5 py-0.5">
                  {sessions.length}
                </span>
              )}
            </Button>
          ))}
        </div>
        <div className="search-field">
          <Search />
          <input
            aria-label="Search sessions"
            placeholder="Search sessions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="session-table-header">
        <span>SESSION</span>
        <span>STATUS</span>
        <span>DURATION</span>
        <span>PROPOSALS</span>
      </div>
      {error && <div className="error-note">{error}</div>}
      {!loaded ? (
        <div className="empty-sessions">
          <p>Opening local sessions…</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-sessions">
          <Hero large />
          <h2>{sessions.length ? "No matching sessions" : "Every hero needs an origin story."}</h2>
          <p>
            {sessions.length
              ? "Try another search or status."
              : productId === "uber-eats"
                ? "Play a walkthrough below and save a clip."
                : "Add your first recording."}
          </p>
          {sessions.length === 0 && (
            <div className="empty-action">
              {productId === "uber-eats" ? (
                // The walkthrough library is rendered below on this page; no need to leave it.
                <Button
                  onClick={() =>
                    document
                      .getElementById("own-footage")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  <CirclePlus />
                  Choose a walkthrough below
                </Button>
              ) : (
                record
              )}
            </div>
          )}
          <div className="empty-footnote">
            <ShieldCheck size={12} />
            No sample recordings or invented findings
          </div>
        </div>
      ) : (
        shown.map((s) => (
          <div className="session-row" key={s.id}>
            <div className="session-row-title">
              <div className="session-icon">
                <Film size={18} />
              </div>
              <div>
                <Link to="/sessions/$id" params={{ id: s.id }}>
                  {s.title}
                </Link>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {productNameForSource(s.source_app)} ·{" "}
                  {new Date(s.created_at).toLocaleDateString()} · {s.event_count} events ·{" "}
                  {s.public_video ? "Video linked" : s.video_blob.size ? "Video saved" : "No video"}{" "}
                  ·{" "}
                  {s.sync?.state === "synced"
                    ? "Shared copy saved"
                    : s.sync
                      ? "Local changes"
                      : "Local only"}
                  {pregeneratedLabel(s) && <> · {pregeneratedLabel(s)}</>}
                </div>
                <SessionNotes session={s} />
              </div>
            </div>
            <div>
              <span className={`status-badge ${s.status}`}>{s.status}</span>
            </div>
            <span className="desktop-cell font-mono">{duration(evidenceDuration(s))}</span>
            <div className="desktop-cell flex justify-between items-center">
              <span>{s.findings.length}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${s.title}`}
                title="Delete session"
                onClick={async () => {
                  if (
                    window.confirm(
                      "Delete this recording and all associated evidence? This cannot be undone.",
                    )
                  ) {
                    await deleteSession(s.id);
                    discardRunsForSession(s.id);
                    setSessions((list) => list.filter((v) => v.id !== s.id));
                    notifySessionsChanged();
                  }
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))
      )}
      {productId === "uber-eats" && (
        <PublicSourceLibrary
          sessions={allSessions}
          includeCompetitors={!!competitor}
          onSaved={(session) => setSessions((list) => [session, ...list])}
        />
      )}
      {competitor && competitorSessions.length > 0 && (
        <section aria-label={`Saved ${competitor.name} recordings`} className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ScoutMascot scout="explorer" size={28} decorative />
            Saved {competitor.name} recordings · Explorer
          </h2>
          {competitorSessions.map((s) => (
            <div className="session-row competitor-row" key={s.id}>
              <div className="session-row-title">
                <div className="session-icon">
                  <Film size={18} />
                </div>
                <div>
                  <Link to="/sessions/$id" params={{ id: s.id }}>
                    {s.title}
                  </Link>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Competitor · {competitor.name} · {s.public_video?.creator} · Not counted in{" "}
                    {product?.name} metrics
                  </div>
                  <SessionNotes session={s} />
                </div>
              </div>
              <div>
                <span className={`status-badge ${s.status}`}>{s.status}</span>
              </div>
              <span className="desktop-cell font-mono">{duration(evidenceDuration(s))}</span>
              <div className="desktop-cell flex justify-between items-center">
                <span>{s.findings.length}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${s.title}`}
                  title="Delete recording"
                  onClick={async () => {
                    if (
                      window.confirm("Delete this competitor recording reference and its analysis?")
                    ) {
                      await deleteSession(s.id);
                      discardRunsForSession(s.id);
                      setSessions((list) => list.filter((v) => v.id !== s.id));
                      notifySessionsChanged();
                    }
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="research-band">
        <div className="research-symbol">
          <FlaskConical size={19} />
        </div>
        <div>
          <h3>Check AI accuracy</h3>
          <p>Compare insights with what you saw.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/evaluation">
            View evaluation
            <ArrowRight />
          </Link>
        </Button>
      </div>
      {!!archived.length && (
        <details className="recording-provenance">
          <summary>Archived recordings · {archived.length}</summary>
          {archived.map((session) => (
            <div className="flex flex-wrap items-center gap-3 my-3" key={session.id}>
              <span>{session.title}</span>
              <Button size="sm" variant="outline" onClick={() => exportSession(session)}>
                Export data
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!session.video_blob.size}
                onClick={() =>
                  downloadFile(session.video_blob, `loopmate-${session.id}.${session.extension}`)
                }
              >
                Download video
              </Button>
            </div>
          ))}
        </details>
      )}
      <Footer />
    </Shell>
  );
}
