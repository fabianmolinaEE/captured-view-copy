import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  FlaskConical,
  Rocket,
  CirclePlus,
  Film,
  ShieldCheck,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell, Footer } from "./Shell";
import { LoopJourney } from "./LoopJourney";
import { listSessions } from "@/lib/research/sessionStorage";
import { latestFindings } from "@/lib/research/insights";
import type { Session } from "@/lib/research/types";

export function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);
  const findings = sessions.flatMap((s) => latestFindings(s));
  const areas = [
    {
      to: "/insights" as const,
      title: "Insights",
      icon: Sparkles,
      step: "01",
      status: "Start here",
      description: "Find the friction. See the evidence. Decide what deserves your attention.",
      action: "Explore insights",
      live: true,
      tone: "insight",
    },
    {
      to: "/ab-tests" as const,
      title: "A/B Tests",
      icon: FlaskConical,
      step: "02",
      status: "Coming soon",
      description:
        "Turn reviewed opportunities into experiments, with you in control of what runs.",
      action: "See the plan",
      live: false,
      tone: "experiment",
    },
    {
      to: "/rollouts" as const,
      title: "Rollouts",
      icon: Rocket,
      step: "03",
      status: "Coming soon",
      description: "Follow approved improvements into release and learn from what happens next.",
      action: "See the plan",
      live: false,
      tone: "rollout",
    },
  ];
  return (
    <Shell section="Home">
      <section className="loop-hero">
        <div className="loop-hero-copy">
          <span className="section-kicker">
            <span />
            The human-guided improvement loop
          </span>
          <h1>
            From zero to hero.
            <br />
            <span>One loop at a time.</span>
          </h1>
          <p>
            Turn the moments your users struggle with into your next product win. Real evidence,
            bright ideas, and your judgment — all connected.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Button asChild>
              <Link to="/insights">
                Explore insights
                <ArrowRight size={15} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/test-app">
                <CirclePlus size={15} />
                Record a session
              </Link>
            </Button>
          </div>
          <div className="hero-footnote">
            <ShieldCheck size={13} />
            Real recordings. Reviewed by you.
          </div>
        </div>
        <LoopJourney />
      </section>
      <div className="section-heading">
        <div>
          <span className="section-kicker">Your improvement loop</span>
          <h2>Good products keep getting better.</h2>
        </div>
        <p>Discover. Test. Grow. Repeat.</p>
      </div>
      <div className="workflow-cards">
        {areas.map((area) => (
          <Link
            key={area.to}
            to={area.to}
            className={`workflow-card workflow-${area.tone} ${area.live ? "workflow-card-live" : ""}`}
          >
            <div className="workflow-card-top">
              <span className="workflow-icon">
                <area.icon size={22} />
              </span>
              <span className={`status-badge ${area.live ? "reviewed" : "coming-soon"}`}>
                {area.status}
              </span>
            </div>
            <span className="workflow-step">{area.step}</span>
            <h3>{area.title}</h3>
            <p>{area.description}</p>
            <span className="workflow-card-action">
              {area.action}
              <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
      {error && (
        <div className="error-note mt-5" role="alert">
          {error}
        </div>
      )}
      <div className="home-bottom">
        <section className="panel home-start">
          <span className="section-kicker">
            {sessions.length ? "Pick up where you left off" : "Your first loop"}
          </span>
          <h2>
            {sessions.length
              ? "Your evidence is waiting."
              : "A recording is a great place to start."}
          </h2>
          <p>
            {sessions.length
              ? "Open a recording to replay the moment, run analysis, or finish reviewing its findings."
              : "Explore the controlled checkout, record a few interactions, and let Gemini propose findings for you to review."}
          </p>
          {sessions.slice(0, 3).map((session) => (
            <Link
              className="recent-recording"
              key={session.id}
              to="/sessions/$id"
              params={{ id: session.id }}
            >
              <Film size={15} />
              <span>{session.title}</span>
              <ArrowRight size={14} />
            </Link>
          ))}
          <Button asChild variant="outline" size="sm">
            <Link to={sessions.length ? "/sessions" : "/test-app"}>
              {sessions.length ? "All recordings" : "Record your first session"}
              <ArrowRight size={14} />
            </Link>
          </Button>
        </section>
        <section className="panel home-snapshot">
          <span className="section-kicker">In this browser</span>
          <h2>Your research, so far.</h2>
          <div className="snapshot-row">
            <span>
              <Film size={15} />
              Saved recordings
            </span>
            <strong>{loaded && !error ? sessions.length : "—"}</strong>
          </div>
          <div className="snapshot-row">
            <span>
              <Clock3 size={15} />
              Findings awaiting review
            </span>
            <strong>
              {loaded && !error
                ? findings.filter((f) => f.review_status === "pending").length
                : "—"}
            </strong>
          </div>
          <div className="snapshot-row">
            <span>
              <CheckCircle2 size={15} />
              Accepted findings
            </span>
            <strong>
              {loaded && !error
                ? findings.filter((f) => f.review_status === "accepted").length
                : "—"}
            </strong>
          </div>
          <p>
            Findings come from each session’s latest completed video + events analysis. All
            decisions stay with the evidence.
          </p>
        </section>
      </div>
      <Footer />
    </Shell>
  );
}
