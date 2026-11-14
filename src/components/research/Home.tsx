import { productNameForSource, productForSource } from "@/lib/research/products";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Film, ShieldCheck, CheckCircle2, Clock3, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell, Footer } from "./Shell";
import { LoopJourney } from "./LoopJourney";
import { listSessions } from "@/lib/research/sessionStorage";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import { latestFindings } from "@/lib/research/insights";
import { publicSessionNotes } from "@/lib/research/publicVideo";
import type { Session } from "@/lib/research/types";
import { getScout, scoutsSummary, type ScoutId } from "@/lib/research/scouts";
import { ScoutStatusPill } from "./ScoutCard";
import { ScoutMascot } from "./ScoutMascot";
import { selectProduct, useProduct } from "@/hooks/use-product";
import { sampleInsights } from "@/lib/research/demo/happyPath";

/** Insights is product-scoped: links from Home land on the demo product when none is chosen. */
function useEnsureProduct() {
  const { productId } = useProduct();
  return () => {
    const demo = sampleInsights()[0]?.product_id;
    if (!productId && demo) selectProduct(demo);
  };
}

/** Where each agent's work shows up. Explorer insights live in the unified Insights view. */
const scoutLinks: Record<ScoutId, { to: "/insights" | "/ab-tests" | "/rollouts"; search: object }> =
  {
    tracker: { to: "/insights", search: {} },
    explorer: { to: "/insights", search: { source: "explorer" } },
    experimenter: { to: "/ab-tests", search: {} },
    fixer: { to: "/rollouts", search: {} },
  };
/** Display order: the demo path (Tracker, Explorer, Experimenter), Fixer last and quieter. */
const teamOrder: readonly ScoutId[] = ["tracker", "explorer", "experimenter", "fixer"];

/** The four agents, one line each. Presentation only: no counters. */
function Team() {
  const ensureProduct = useEnsureProduct();
  return (
    <section id="scouts" aria-labelledby="scouts-heading" className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 id="scouts-heading" className="m-0 text-lg font-semibold">
          Meet the team
        </h2>
        <p className="m-0 text-xs text-[color:var(--muted-foreground)]">{scoutsSummary}</p>
      </div>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {teamOrder.map((id) => {
          const scout = getScout(id);
          const quiet = id === "fixer";
          return (
            <li key={id}>
              <Link
                to={scoutLinks[id].to}
                search={scoutLinks[id].search as never}
                onClick={scoutLinks[id].to === "/insights" ? ensureProduct : undefined}
                aria-label={`${scout.name}: ${scout.tagline}`}
                className={`flex h-full items-center gap-3 rounded-xl border p-3 no-underline transition-colors hover:bg-[#ffffff0d] ${
                  quiet ? "border-[#ffffff12] opacity-80" : "border-[#ffffff1f] bg-[#ffffff06]"
                }`}
              >
                <ScoutMascot scout={id} size={quiet ? 34 : 44} animated={!quiet} decorative />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold" style={{ color: scout.colors.main }}>
                      {scout.name}
                    </span>
                    <ScoutStatusPill scout={id} />
                  </span>
                  <span className="text-xs leading-snug text-[color:var(--foreground)]">
                    {scout.tagline}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Home() {
  const [allSessions, setSessions] = useState<Session[]>([]);
  const sessions = allSessions.filter((session) => !!productForSource(session.source_app));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  useSessionsChanged(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {});
  });
  const findings = sessions.flatMap((s) => latestFindings(s));
  const ensureProduct = useEnsureProduct();
  const count = (value: number) => (loaded && !error ? value : "—");
  return (
    <Shell section="Home">
      <section className="loop-hero">
        <div className="loop-hero-copy">
          <span className="section-kicker">
            <span />
            The automated improvement loop
          </span>
          <h1>
            From zero to hero.
            <br />
            <span>One loop at a time.</span>
          </h1>
          <p>Agents find what to improve, test it and ship it. You approve.</p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Button asChild>
              <Link to="/hq">
                <Radar size={15} />
                Open HQ
                <ArrowRight size={15} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/insights" onClick={ensureProduct}>
                Insights
              </Link>
            </Button>
          </div>
          <div className="hero-footnote">
            <ShieldCheck size={13} />
            Real insights. Labeled simulations. You decide.
          </div>
        </div>
        <LoopJourney />
      </section>
      <Team />
      {error && (
        <div className="error-note mt-5" role="alert">
          {error}
        </div>
      )}
      <div className="home-bottom">
        <section className="panel home-start" aria-labelledby="recent-heading">
          <span className="section-kicker">Across your products</span>
          <h2 id="recent-heading">{sessions.length ? "Recent recordings" : "No recordings yet"}</h2>
          {sessions.slice(0, 3).map((session) => (
            <Link
              className="recent-recording"
              key={session.id}
              to="/sessions/$id"
              params={{ id: session.id }}
            >
              <Film size={15} />
              <span>
                {session.title}
                <small className="block text-[10px] text-muted-foreground mt-1">
                  {[productNameForSource(session.source_app), ...publicSessionNotes(session)].join(
                    " · ",
                  )}
                </small>
              </span>
              <ArrowRight size={14} />
            </Link>
          ))}
          <Button asChild variant="outline" size="sm">
            <Link to={sessions.length ? "/sessions" : "/test-app"}>
              {sessions.length ? "All recordings" : "Record a session"}
              <ArrowRight size={14} />
            </Link>
          </Button>
        </section>
        <section className="panel home-snapshot" aria-label="Real research records">
          <span className="section-kicker">Real records</span>
          <h2>Your research so far</h2>
          <div className="snapshot-row">
            <span>
              <Film size={15} />
              Recordings
            </span>
            <strong>{count(sessions.length)}</strong>
          </div>
          <div className="snapshot-row">
            <span>
              <Clock3 size={15} />
              Awaiting review
            </span>
            <strong>{count(findings.filter((f) => f.review_status === "pending").length)}</strong>
          </div>
          <div className="snapshot-row">
            <span>
              <CheckCircle2 size={15} />
              Accepted
            </span>
            <strong>{count(findings.filter((f) => f.review_status === "accepted").length)}</strong>
          </div>
        </section>
      </div>
      <Footer />
    </Shell>
  );
}
