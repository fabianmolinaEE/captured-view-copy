import type { CSSProperties, ReactNode } from "react";
import { getScout, scoutStatusLabels, type Scout, type ScoutId } from "@/lib/research/scouts";
import { ScoutMascot } from "./ScoutMascot";
import { SimulatedBadge } from "./SimulatedBadge";

export interface ScoutCardProps {
  scout: ScoutId | Scout;
  /** Optional example line shown in a speech bubble, e.g. a sample insight. */
  speech?: ReactNode;
  /** Bob the mascot (still respects reduced motion and the app motion toggle). */
  animated?: boolean;
  /** Show the honest status note under the tagline. */
  showStatusNote?: boolean;
  /** Mascot width in px. */
  mascotSize?: number;
  /** Heading level for the scout name inside the card. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
  children?: ReactNode;
}

export function ScoutStatusPill({ scout }: { scout: ScoutId | Scout }) {
  const info = typeof scout === "string" ? getScout(scout) : scout;
  if (info.status === "simulated") return <SimulatedBadge detail={info.statusNote} />;
  const real = info.status === "real";
  return (
    <span
      data-status={info.status}
      title={info.statusNote}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight ${
        real
          ? "border-[#a4ddc866] bg-[#91d5b719] text-[#bfe9d8]"
          : "border-[#ffffff2e] bg-[#ffffff0d] text-[#c1b5d1]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${real ? "bg-[#a4ddc8]" : "bg-[#c1b5d1]"}`}
      />
      {scoutStatusLabels[info.status]}
    </span>
  );
}

/** Compact scout card: mascot, name, tagline, bucket and status pill. */
export function ScoutCard({
  scout,
  speech,
  animated = false,
  showStatusNote = false,
  mascotSize = 64,
  headingLevel = 3,
  className = "",
  children,
}: ScoutCardProps) {
  const info = typeof scout === "string" ? getScout(scout) : scout;
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const style = {
    "--scout-main": info.colors.main,
    "--scout-tint": info.colors.tint,
    "--scout-ring": info.colors.ring,
  } as CSSProperties;
  return (
    <article
      data-scout={info.id}
      aria-label={`${info.name} scout`}
      style={style}
      className={`relative flex min-w-0 flex-col gap-3 rounded-lg border border-[color:var(--scout-ring)] bg-[color:var(--scout-tint)] p-4 text-[color:var(--foreground)] ${className}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <ScoutMascot scout={info} size={mascotSize} animated={animated} decorative />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Heading className="text-base font-semibold leading-tight text-[color:var(--scout-main)]">
              {info.name}
            </Heading>
            <ScoutStatusPill scout={info} />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
            {info.bucketNumber} · {info.bucketLabel}
          </p>
          <p className="text-sm leading-snug text-[color:var(--foreground)]">{info.tagline}</p>
          {showStatusNote ? (
            <p className="text-xs leading-snug text-[color:var(--muted-foreground)]">
              {info.statusNote}
            </p>
          ) : null}
        </div>
      </div>
      {speech ? (
        <div className="relative ml-2 rounded-lg border border-[color:var(--scout-ring)] bg-[color:var(--card)] px-3 py-2 text-sm leading-snug">
          <span
            aria-hidden="true"
            className="absolute -top-[7px] left-5 h-3 w-3 rotate-45 border-l border-t border-[color:var(--scout-ring)] bg-[color:var(--card)]"
          />
          <span className="sr-only">{info.name} says: </span>
          <span className="relative">{speech}</span>
        </div>
      ) : null}
      {children}
    </article>
  );
}
