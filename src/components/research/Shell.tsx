import { Link, useLocation } from "@tanstack/react-router";
import {
  Pause,
  Play,
  Home as HomeIcon,
  Sparkles,
  Rocket,
  Clapperboard,
  Smartphone,
  ChartNoAxesCombined,
  Settings2,
  HardDrive,
  ChevronDown,
  ShieldCheck,
  FlaskConical,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Hero } from "./Hero";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { listSessions } from "@/lib/research/sessionStorage";
export function Shell({ children, section }: { children: ReactNode; section: string }) {
  const path = useLocation({ select: (l) => l.pathname });
  const motion = useMotionPreference();
  const [count, setCount] = useState(0);
  useEffect(() => {
    listSessions()
      .then((s) => setCount(s.length))
      .catch(() => {});
  }, [path]);
  const primary = [
    { to: "/insights" as const, text: "Insights", icon: Sparkles },
    { to: "/ab-tests" as const, text: "A/B Tests", icon: FlaskConical },
    { to: "/rollouts" as const, text: "Rollouts", icon: Rocket },
  ];
  const tools = [
    { to: "/sessions" as const, text: "Recordings", icon: Clapperboard },
    { to: "/test-app" as const, text: "Record a session", icon: Smartphone },
    { to: "/evaluation" as const, text: "Evaluation", icon: ChartNoAxesCombined },
    { to: "/settings" as const, text: "Settings", icon: Settings2 },
  ];
  return (
    <div
      className="app-shell"
      data-theme="loop"
      data-motion={motion.enabled ? "on" : "off"}
      data-section={section}
    >
      <aside className="sidebar">
        <Link to="/" className="wordmark">
          <Hero />
          LoopMate
        </Link>
        <Link
          to="/"
          className={`nav-link home-nav ${path === "/" ? "active" : ""}`}
          aria-current={path === "/" ? "page" : undefined}
        >
          <HomeIcon />
          <span>Home</span>
        </Link>
        <div className="workspace-label primary-nav-label">Your improvement loop</div>
        <nav className="primary-nav" aria-label="Improvement loop">
          {primary.map((n) => (
            <Link
              to={n.to}
              key={n.to}
              className={`nav-link ${path.startsWith(n.to) ? "active" : ""}`}
              aria-current={path.startsWith(n.to) ? "page" : undefined}
            >
              <n.icon />
              <span>{n.text}</span>
            </Link>
          ))}
        </nav>
        <div className="workspace-label tools-nav-label">Research tools</div>
        <nav className="tools-nav" aria-label="Research tools">
          {tools.map((n) => (
            <Link
              to={n.to}
              key={n.to}
              className={`nav-link ${path.startsWith(n.to) ? "active" : ""}`}
              aria-current={path.startsWith(n.to) ? "page" : undefined}
            >
              <n.icon />
              <span>{n.text}</span>
              {n.to === "/sessions" && <span className="nav-counter">{count}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-label">
            <HardDrive size={15} />
            <span>Browser workspace</span>
            <span className="status-dot ml-auto" />
          </div>
          <div className="profile">
            <div className="avatar">LM</div>
            <div className="flex-1">
              <div className="text-xs font-semibold">Team research</div>
              <div className="text-[10px] text-muted-foreground mt-1">Internal prototype</div>
            </div>
            <ChevronDown size={13} className="text-muted-foreground" />
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="desktop-crumb">
            Workspace <span className="mx-3 text-border">/</span>
            <span className="text-foreground">{section}</span>
          </div>
          <Link to="/" className="wordmark mobile-brand">
            <Hero />
            LoopMate
          </Link>
          <div className="topbar-right">
            <details className="mobile-tool-menu">
              <summary>Research tools</summary>
              <div>
                {tools.map((tool) => (
                  <Link key={tool.to} to={tool.to}>
                    {tool.text}
                  </Link>
                ))}
              </div>
            </details>
            <button
              type="button"
              className="motion-control"
              disabled={motion.reduced}
              onClick={motion.toggle}
              aria-pressed={motion.enabled}
              aria-label={
                motion.reduced
                  ? "Animations reduced by system preference"
                  : motion.enabled
                    ? "Pause animations"
                    : "Resume animations"
              }
              title={
                motion.reduced
                  ? "Motion is reduced by your system setting"
                  : motion.enabled
                    ? "Pause decorative motion"
                    : "Resume decorative motion"
              }
            >
              {motion.enabled ? <Pause size={13} /> : <Play size={13} />}
              <span>
                {motion.reduced
                  ? "Motion reduced"
                  : motion.enabled
                    ? "Pause motion"
                    : "Resume motion"}
              </span>
            </button>
            <span className="local-top flex items-center gap-2">
              <ShieldCheck size={14} /> Private by default
            </span>
            <span className="beta">PROTOTYPE v1</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Footer() {
  return (
    <div className="footer-note">
      <span className="flex items-center gap-2">
        <HardDrive size={12} /> Saved locally. Shared copies use separate upload and deletion
        controls.
      </span>
      <span className="flex items-center gap-2">
        <FlaskConical size={12} /> Real evidence. Human judgment.
      </span>
    </div>
  );
}
export function pageHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} · LoopMate` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} · LoopMate` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
