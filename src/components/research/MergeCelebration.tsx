import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";
import { ScoutMascot } from "./ScoutMascot";
import { SimulatedBadge } from "./SimulatedBadge";

/*
 * Merge celebration for a simulated PR: the Experimenter flies across the screen with a cape
 * trail. With system reduced motion or the app's motion toggle paused, a static confirmation is
 * shown instead. Purely decorative; the merge itself only updates the simulated record.
 */

const FLIGHT_MS = 2400;

/** True unless the system asks for reduced motion or the app's motion toggle is paused. */
function celebrationMotionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {
    /* No media query support: fall through. */
  }
  try {
    if (window.localStorage.getItem("loopmate-motion") === "paused") return false;
  } catch {
    /* Storage blocked: rely on the shell flag below. */
  }
  return !document.querySelector('.app-shell[data-motion="off"]');
}

const flightCss = `
@keyframes lm-merge-fly {
  0% { transform: translate(-30vw, 34vh) rotate(-14deg); }
  45% { transform: translate(38vw, 6vh) rotate(-6deg); }
  100% { transform: translate(130vw, -26vh) rotate(-16deg); }
}
@keyframes lm-merge-pop {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.85); }
  18%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(.96); }
}
@keyframes lm-merge-spark {
  0%, 100% { opacity: .2; }
  50% { opacity: 1; }
}
.lm-merge-flyer { animation: lm-merge-fly ${FLIGHT_MS}ms cubic-bezier(.45,.05,.4,1) forwards; }
.lm-merge-pop { animation: lm-merge-pop ${FLIGHT_MS}ms ease-out forwards; }
.lm-merge-spark { animation: lm-merge-spark .5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .lm-merge-flyer, .lm-merge-pop { animation: none; display: none; }
}
`;

function Flight({ title, onDone }: { title: string; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    // Timer rather than animationend alone, so the overlay always clears.
    const timer = window.setTimeout(() => done.current(), FLIGHT_MS + 100);
    return () => window.clearTimeout(timer);
  }, []);
  return createPortal(
    <div
      data-testid="merge-flight"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[200] overflow-hidden"
    >
      <style>{flightCss}</style>
      <div className="lm-merge-flyer absolute left-0 top-[40%] flex items-center">
        {/* Cape trail */}
        <div className="relative mr-[-18px] h-14 w-[38vw] max-w-[420px]">
          <div className="absolute inset-y-3 right-0 w-full rounded-full bg-[linear-gradient(90deg,transparent,#6a3fc455_35%,#b48cffcc_80%,#f7cf7c)] blur-[2px]" />
          <div className="absolute right-6 top-1 h-[3px] w-1/2 rounded-full bg-[linear-gradient(90deg,transparent,#ffffffaa)]" />
          <div className="absolute bottom-1 right-10 h-[3px] w-1/3 rounded-full bg-[linear-gradient(90deg,transparent,#f7cf7caa)]" />
          {[18, 42, 66].map((left, i) => (
            <span
              key={left}
              className="lm-merge-spark absolute h-1.5 w-1.5 rounded-full bg-[#f7cf7c]"
              style={{
                left: `${left}%`,
                top: i % 2 ? "8px" : "40px",
                animationDelay: `${i * -0.15}s`,
              }}
            />
          ))}
        </div>
        <div className="rotate-[18deg]">
          <ScoutMascot scout="experimenter" size={128} decorative halo={false} animated />
        </div>
      </div>
      <div className="lm-merge-pop absolute left-1/2 top-1/2 flex flex-col items-center gap-1.5 rounded-2xl border border-[#b48cff59] bg-[#1b1533e6] px-6 py-4 text-center text-[#f5effb] shadow-[0_20px_60px_#0008]">
        <span className="inline-flex items-center gap-2 text-xl font-semibold">
          <CheckCircle2 size={20} className="text-[#b48cff]" />
          Merged!
        </span>
        <span className="max-w-[320px] truncate text-xs text-[#cfc3e6]">{title}</span>
      </div>
    </div>,
    document.body,
  );
}

export interface MergeCelebrationProps {
  /** PR title shown in the confirmation. */
  title: string;
  /** Called when the confirmation is dismissed (the flight ending keeps the card). */
  onDone: () => void;
}

/** Confirmation (always) plus the flying Experimenter (motion allowed only). */
export function MergeCelebration({ title, onDone }: MergeCelebrationProps) {
  // Decided once, when the merge happens: flight only if motion is allowed right now.
  const [mode] = useState<"fly" | "static">(() => (celebrationMotionAllowed() ? "fly" : "static"));
  const [flying, setFlying] = useState(mode === "fly");
  return (
    <>
      {flying && <Flight title={title} onDone={() => setFlying(false)} />}
      <div
        role="status"
        data-celebration={mode}
        className="flex min-w-0 items-center gap-3 rounded-xl border border-[#b48cff59] bg-[linear-gradient(135deg,#b48cff1f,#ffffff05)] p-3"
      >
        <ScoutMascot scout="experimenter" size={44} decorative halo={false} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            PR merged
            <SimulatedBadge detail="Only the simulated record changed. No repository is connected." />
          </span>
          <span className="truncate text-xs text-[color:var(--muted-foreground)]">{title}</span>
        </div>
        {!flying && (
          <button
            type="button"
            onClick={onDone}
            aria-label="Dismiss"
            className="rounded-md p-1 text-[color:var(--muted-foreground)] hover:bg-[#ffffff10]"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </>
  );
}
