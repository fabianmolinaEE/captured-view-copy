import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Pause,
  Play,
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
  Radar,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ProductPicker } from "./ProductPicker";
import { useProduct } from "@/hooks/use-product";
import { isArchivedSession, sessionsForProduct } from "@/lib/research/products";
import { Hero } from "./Hero";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import type { Session } from "@/lib/research/types";
import { listSessions } from "@/lib/research/sessionStorage";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import { getScout } from "@/lib/research/scouts";
import { isCompetitorSession } from "@/lib/research/competitors";
import { sourceFilterFromTab } from "@/lib/research/unifiedInsights";

type PrimaryLink = {
  id: string;
  to: "/hq" | "/insights" | "/ab-tests" | "/rollouts";
  text: string;
  icon: typeof Sparkles;
  /** Short tooltip. Hero names (Tracker, Explorer, Experimenter) are internal labels only. */
  title: string;
  color: string;
};
/** Sections rendered workspace-wide: no product picker, unscoped breadcrumb. */
const workspaceSections = new Set(["Home", "HQ"]);
/**
 * One consistent set of functional labels (team decision, Nov 13): HQ, Insights, A/B Tests,
 * Rollouts. There is no standalone Competitors tab: Explorer insights live in the unified
 * Insights view (`/insights?tab=competitors` still loads it, filtered to Explorer). Rollouts
 * belong to the Experimenter; the Fixer (bugs only) is an internal label, not a nav item.
 */
const primaryNav: readonly PrimaryLink[] = [
  {
    id: "hq",
    to: "/hq",
    text: "HQ",
    icon: Radar,
    title: "Agent activity and what needs you",
    color: "#f7cf7c",
  },
  {
    id: "insights",
    to: "/insights",
    text: "Insights",
    icon: Sparkles,
    title: "Insights from your product (Tracker) and competitors (Explorer)",
    color: getScout("tracker").colors.main,
  },
  {
    id: "ab-tests",
    to: "/ab-tests",
    text: "A/B Tests",
    icon: FlaskConical,
    title: "Tests the Experimenter runs for you",
    color: getScout("experimenter").colors.main,
  },
  {
    id: "rollouts",
    to: "/rollouts",
    text: "Rollouts",
    icon: Rocket,
    title: "PRs to review and merge",
    color: getScout("experimenter").colors.main,
  },
];
export function Shell({
  children,
  section,
  productSwitchDisabled = false,
}: {
  children: ReactNode;
  section: string;
  productSwitchDisabled?: boolean;
}) {
  const { productId, product, selectProduct } = useProduct();
  const navigate = useNavigate();
  const path = useLocation({ select: (l) => l.pathname });
  // Insights source filter (`?source=`, or legacy `?tab=competitors` → Explorer), kept when
  // switching product from an insight detail page.
  const sourceFilter = useLocation({
    select: (l) =>
      sourceFilterFromTab(
        (l.search as Record<string, unknown> | undefined)?.["source"] ??
          (l.search as Record<string, unknown> | undefined)?.["tab"],
      ),
  });
  const motion = useMotionPreference();
  const [sessions, setSessions] = useState<Session[]>([]);
  const isWorkspace = workspaceSections.has(section);
  // Real own-product recordings only: competitor footage and archived (e.g. Miso) sessions excluded.
  const own = sessions.filter(
    (session) => !isCompetitorSession(session) && !isArchivedSession(session),
  );
  const count = isWorkspace ? own.length : sessionsForProduct(own, productId).length;
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {});
  }, [path]);
  useSessionsChanged(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {});
  });
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
        <Link to="/" className="wordmark" aria-label="LoopMate home">
          <Hero />
          LoopMate
        </Link>
        <div className="workspace-label primary-nav-label">Your loop</div>
        <nav className="primary-nav" aria-label="Improvement loop">
          {primaryNav.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link
                to={n.to}
                key={n.id}
                data-nav={n.id}
                className={`nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={n.title}
              >
                <n.icon style={{ color: n.color }} />
                <span>{n.text}</span>
              </Link>
            );
          })}
        </nav>
        <div className="workspace-label tools-nav-label">
          Research tools <span className="opacity-70">(leaving soon)</span>
        </div>
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
              <div className="text-[10px] text-muted-foreground mt-1">Your workspace</div>
            </div>
            <ChevronDown size={13} className="text-muted-foreground" />
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="desktop-crumb">
            {isWorkspace ? "Workspace" : (product?.name ?? "Products")}{" "}
            <span className="mx-3 text-border">/</span>
            <span className="text-foreground">{section}</span>
          </div>
          <Link to="/" className="wordmark mobile-brand">
            <Hero />
            LoopMate
          </Link>
          <div className="topbar-right">
            <details className="mobile-tool-menu">
              <summary>
                Research tools <span className="opacity-70">(leaving soon)</span>
              </summary>
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
            <span className="beta">LOOPMATE</span>
          </div>
        </header>
        <main className="content">
          {!isWorkspace && (
            <ProductPicker
              selected={productId}
              disabled={productSwitchDisabled}
              onSelect={(id) => {
                selectProduct(id);
                if (path.startsWith("/sessions/")) void navigate({ to: "/sessions" });
                else if (path.startsWith("/insights/"))
                  void navigate({
                    to: "/insights",
                    search: sourceFilter === "all" ? {} : { source: sourceFilter },
                  });
              }}
            />
          )}
          {isWorkspace || productId || section === "Settings" ? (
            <div
              key={isWorkspace ? "workspace" : (productId ?? "workspace")}
              className="product-content"
            >
              {children}
            </div>
          ) : null}
        </main>
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
        <HardDrive size={12} /> Saved locally
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
