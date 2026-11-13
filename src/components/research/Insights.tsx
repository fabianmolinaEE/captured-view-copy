import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Search, Globe2, Film, Layers3, CirclePlus } from "lucide-react";
import { Shell, PageHeading } from "./Shell";
import { Button } from "@/components/ui/button";
import { listSessions } from "@/lib/research/sessionStorage";
import { aggregateInsights, latestFindings } from "@/lib/research/insights";
import { duration, label, type Session } from "@/lib/research/types";

export function Insights() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"internal" | "external">("internal");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  const entries = sessions.flatMap((session) =>
    latestFindings(session).map((finding) => ({ session, finding })),
  );
  const groups = aggregateInsights(sessions);
  const shown = entries.filter(
    ({ finding }) =>
      (filter === "all" || finding.review_status === filter) &&
      `${finding.title} ${finding.category} ${finding.screen ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const filteredGroups = groups.filter((g) =>
    `${g.title} ${g.category} ${g.screen}`.toLowerCase().includes(search.toLowerCase()),
  );
  const stats = [
    {
      title: "Awaiting your review",
      value: entries.filter((e) => e.finding.review_status === "pending").length,
      icon: Sparkles,
    },
    {
      title: "Accepted findings",
      value: entries.filter((e) => e.finding.review_status === "accepted").length,
      icon: Film,
    },
    { title: "Prioritized issues", value: groups.length, icon: Layers3 },
  ];
  return (
    <Shell section="Insights">
      <PageHeading
        title="A little friction. A useful next step."
        description="Look closer at what happened, then decide what deserves to change."
        action={
          <Button asChild>
            <Link to="/test-app">
              <CirclePlus />
              Record a session
            </Link>
          </Button>
        }
      />
      <div className="source-tabs" role="group" aria-label="Insight source">
        <Button
          variant="ghost"
          aria-pressed={source === "internal"}
          className={source === "internal" ? "selected" : ""}
          onClick={() => setSource("internal")}
        >
          <Film size={15} />
          Internal<span>Your recordings</span>
        </Button>
        <Button
          variant="ghost"
          aria-pressed={source === "external"}
          className={source === "external" ? "selected" : ""}
          onClick={() => setSource("external")}
        >
          <Globe2 size={15} />
          External<span className="coming-label">Coming soon</span>
        </Button>
      </div>
      {error && (
        <div className="error-note my-4" role="alert">
          {error}
        </div>
      )}
      {source === "external" ? (
        <div className="future-page external-empty">
          <span className="future-icon">
            <Globe2 size={30} />
          </span>
          <span className="status-badge coming-soon">Coming soon</span>
          <h2>A wider view of what’s possible.</h2>
          <p>
            Explore competitor-app recordings, discover patterns, and bring new ideas back to your
            own product. External recording analysis is planned; no competitor agents or external
            findings are connected yet.
          </p>
          <div className="info-note">
            External evidence will stay clearly sourced and separate from your internal research.
          </div>
          <Button variant="outline" onClick={() => setSource("internal")}>
            Explore internal insights
            <ArrowRight size={14} />
          </Button>
        </div>
      ) : (
        <>
          <div className="insight-stats">
            {stats.map((stat) => (
              <div className="insight-stat" key={stat.title}>
                <stat.icon size={18} />
                <div>
                  <strong>{loaded && !error ? stat.value : "—"}</strong>
                  <span>{stat.title}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="section-toolbar insight-toolbar">
            <div className="filter-tabs">
              {[
                { id: "all", name: "All findings" },
                { id: "pending", name: "Needs review" },
                { id: "accepted", name: "Accepted" },
                { id: "rejected", name: "Rejected" },
                { id: "prioritized", name: "Prioritized" },
              ].map((item) => (
                <Button
                  variant="ghost"
                  aria-pressed={filter === item.id}
                  key={item.id}
                  className={`filter-tab ${filter === item.id ? "selected" : ""}`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.name}
                </Button>
              ))}
            </div>
            <label className="search-field">
              <Search />
              <input
                aria-label="Search insights"
                placeholder="Find an insight…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {!loaded ? (
            <div className="empty-sessions">
              <p>Opening your research…</p>
            </div>
          ) : error ? (
            <div className="empty-sessions">
              <h2>Your research could not be loaded.</h2>
              <p>
                Refresh to try opening browser storage again. Existing recordings have not been
                deleted.
              </p>
            </div>
          ) : filter === "prioritized" ? (
            <>
              <div className="info-note my-5">
                Ranked issues use accepted findings from fully reviewed sessions’ latest video +
                events runs. Category + screen defines a group; each session counts once. These are
                triage estimates, not measured business impact.
              </div>
              <details className="priority-method">
                <summary>How estimated priority works</summary>
                <p>
                  Priority / 100 = 40 × frequency + 35 × severity + 15 × repeated-retry rate + 10 ×
                  evidence quality. Severity is minor 0.2, major 0.6 (default), blocker 1.
                  Human-marked blockers have a minimum score of 85. Quality combines timestamp
                  (0.3), linked events (0.2), human-verified evidence (0.4), and confidence (0.1).
                  Components count once per affected session. Repeated retry means at least two
                  retries within 10 seconds of a finding.
                </p>
              </details>
              {groups.length > 0 && filteredGroups.length === 0 && (
                <div className="empty-sessions">
                  <h2>No priorities match your search.</h2>
                  <Button variant="outline" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                </div>
              )}
              {!groups.length ? (
                <div className="empty-sessions">
                  <Layers3 className="text-primary" />
                  <h2>Your priorities start with review.</h2>
                  <p>
                    Accept supported findings and resolve pending proposals in each session to build
                    cross-session priorities.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => setFilter("pending")}>
                    Review proposed findings
                    <ArrowRight size={14} />
                  </Button>
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <section className="grouped-insight" key={group.key}>
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <span className="eyebrow">{label(group.category)} · Human accepted</span>
                        <h2>{group.title}</h2>
                      </div>
                      <span className="priority-number">
                        {group.priority}
                        <small>estimated priority / 100</small>
                      </span>
                    </div>
                    <p>
                      {group.affected} of {group.eligible} eligible sessions ·{" "}
                      {group.percentage.toFixed(0)}% · {group.severity} severity
                    </p>
                    {group.affected === 1 && (
                      <p>One affected recording. Frequency and impact remain uncertain.</p>
                    )}
                    <div className="group-evidence">
                      {group.evidence.map(({ session, finding }) => (
                        <Link
                          key={finding.id}
                          to="/insights/$sessionId/$findingId"
                          params={{ sessionId: session.id, findingId: finding.id }}
                        >
                          <Film size={14} />
                          <span>
                            {session.title} · {duration(finding.timestamp_ms)}
                          </span>
                          <ArrowRight size={14} />
                        </Link>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </>
          ) : shown.length === 0 ? (
            <div className="empty-sessions insights-empty">
              <Sparkles size={28} className="text-primary" />
              <h2>
                {entries.length
                  ? "No findings match this view."
                  : "Your next insight starts with a recording."}
              </h2>
              <p>
                {entries.length
                  ? "Try another status or search."
                  : "Record the controlled checkout, run a real analysis, and review the moments worth improving."}
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link to="/sessions">
                  Open recordings
                  <ArrowRight size={14} />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="insight-list">
              {shown.map(({ session, finding }) => (
                <Link
                  to="/insights/$sessionId/$findingId"
                  params={{ sessionId: session.id, findingId: finding.id }}
                  className="insight-list-row"
                  key={finding.id}
                >
                  <span className={`finding-status-dot ${finding.review_status}`} />
                  <div className="insight-row-content">
                    <div className="insight-row-labels">
                      <span>{label(finding.category)}</span>
                      <span>Internal · Saved real analysis</span>
                    </div>
                    <h2>{finding.title}</h2>
                    <p>{finding.observed_evidence ?? finding.description}</p>
                    <div className="insight-row-meta">
                      <Film size={12} />
                      {session.title}
                      <span>· {duration(finding.timestamp_ms)}</span>
                      <span
                        className={`status-badge ${finding.review_status === "accepted" ? "reviewed" : ""}`}
                      >
                        {finding.review_status === "pending"
                          ? "Needs review"
                          : label(finding.review_status)}
                      </span>
                      {finding.next_step && <span>Next step: {finding.next_step.status}</span>}
                    </div>
                  </div>
                  <ArrowRight className="insight-row-arrow" size={18} />
                </Link>
              ))}
            </div>
          )}
          <p className="insights-footnote">
            Latest completed video + events proposals per recording. Events-only runs and original
            session history remain in Recordings and Evaluation.
          </p>
        </>
      )}
    </Shell>
  );
}
