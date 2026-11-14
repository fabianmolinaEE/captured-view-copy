import type { CSSProperties } from "react";
import { getScout, type Scout, type ScoutId } from "@/lib/research/scouts";

export interface ScoutMascotProps {
  scout: ScoutId | Scout;
  /** Rendered width in px; height keeps the 96:92 artwork ratio. */
  size?: number;
  /**
   * Gentle bob and cape sway. Uses the shared `mascot-hover` / `cape-breeze`
   * keyframes from styles.css behind Tailwind `motion-safe:`, so system reduced
   * motion disables it, and the app motion toggle (`.app-shell[data-motion="off"]`)
   * removes it through the existing global rule.
   */
  animated?: boolean;
  /** Accessible name. Defaults to e.g. "Tracker, the blue scout". */
  title?: string;
  /** Hide from assistive tech when a visible name sits next to the mascot. */
  decorative?: boolean;
  /** Soft tinted disc behind the mascot so it lifts off the navy canvas. */
  halo?: boolean;
  className?: string;
}

const INK = "#19162b";
const SUIT = "#221d3a";
const FACE = "#f6dcb7";
const GOLD = "#f5c84c";
const PAPER = "#ffffff";

const delays: Record<ScoutId, string> = {
  tracker: "0s",
  explorer: "-1.2s",
  fixer: "-2.5s",
  experimenter: "-3.7s",
};

/** Original inline-SVG superhero scouts in the LoopMate hero family style. */
export function ScoutMascot({
  scout,
  size = 64,
  animated = false,
  title,
  decorative = false,
  halo = true,
  className = "",
}: ScoutMascotProps) {
  const info = typeof scout === "string" ? getScout(scout) : scout;
  const { main, deep, tint, ring } = info.colors;
  const label = title ?? `${info.name}, the ${info.colorName} scout`;
  const bob = animated ? "motion-safe:animate-[mascot-hover_5s_ease-in-out_infinite]" : "";
  const sway = animated ? "motion-safe:animate-[cape-breeze_3s_ease-in-out_infinite]" : "";
  const style: CSSProperties | undefined = animated
    ? { animationDelay: delays[info.id] }
    : undefined;
  const capeStyle: CSSProperties = {
    transformBox: "fill-box",
    transformOrigin: "50% 0%",
    animationDelay: delays[info.id],
  };
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": label };
  return (
    <svg
      viewBox="0 0 96 92"
      width={size}
      height={Math.round((size * 92) / 96)}
      className={`scout-mascot shrink-0 overflow-visible ${bob} ${className}`}
      style={style}
      data-scout={info.id}
      data-animated={animated ? "true" : "false"}
      focusable="false"
      {...a11y}
    >
      {decorative ? null : <title>{label}</title>}
      {halo ? <circle cx="48" cy="50" r="41" fill={tint} stroke={ring} strokeWidth="1" /> : null}
      <g transform="translate(13 12)">
        {/* Cape */}
        <path className={sway} style={capeStyle} d="M21 36 9 68q24-3 50 1L49 35Z" fill={main} />
        <path d="M35 37 30 67q-8 0-14 1Z" fill={deep} opacity=".45" />
        {/* Body, chest emblem, legs */}
        <path d="M24 43h22l7 20-18 6-19-6Z" fill={SUIT} stroke={ring} strokeWidth=".8" />
        <path d="m36 46-8 12h8l-3 9 12-15h-9l3-6Z" fill={GOLD} />
        <path d="m22 62-5 12h12l4-11Zm25 0 6 12H41l-4-11Z" fill={INK} />
        {/* Head, face, mask, eyes, smile */}
        <path
          d="M18 18Q18 3 35 3t17 15v16q0 15-17 15T18 34Z"
          fill={SUIT}
          stroke={ring}
          strokeWidth=".8"
        />
        <path d="M23 25h24v9q0 11-12 11T23 34Z" fill={FACE} />
        <path d="M19 20h32v12l-8-5-8 5-8-5-8 5Z" fill={main} />
        <path d="m25 23 7 2-7 2Zm20 0-7 2 7 2Z" fill={PAPER} />
        <path
          d="M31.5 38q3.5 2.6 7 0"
          fill="none"
          stroke={INK}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <Gear id={info.id} main={main} deep={deep} />
      </g>
    </svg>
  );
}

function Arm({ x, y, color }: { x: number; y: number; color: string }) {
  const fromX = x > 35 ? 46 : 24;
  return (
    <>
      <path d={`M${fromX} 47 L${x} ${y}`} stroke={SUIT} strokeWidth="4.2" strokeLinecap="round" />
      <circle cx={x} cy={y} r="2.7" fill={color} />
    </>
  );
}

function Gear({ id, main, deep }: { id: ScoutId; main: string; deep: string }) {
  switch (id) {
    case "tracker":
      return (
        <g data-gear="magnifier chart">
          {/* Head bolt, like the LoopMate hero */}
          <path d="m36 7-5 9h5l-2 6 9-11h-6l3-4Z" fill={GOLD} />
          {/* Small rising chart, left hand */}
          <rect
            x="-9"
            y="38"
            width="15"
            height="15"
            rx="2.2"
            fill="#ffffff1c"
            stroke={main}
            strokeWidth="1"
          />
          <rect x="-6.5" y="47" width="2.6" height="3.8" rx=".6" fill={main} />
          <rect x="-2.8" y="44.6" width="2.6" height="6.2" rx=".6" fill={main} />
          <rect x=".9" y="41.6" width="2.6" height="9.2" rx=".6" fill={main} />
          <path
            d="M-6 44.2 -2 42.2 2.4 38.9"
            fill="none"
            stroke={GOLD}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <Arm x={7} y={48} color={main} />
          {/* Magnifying glass, right hand */}
          <path d="M55 46.5 59.6 40.6" stroke={deep} strokeWidth="3.6" strokeLinecap="round" />
          <circle cx="64" cy="35" r="7.5" fill="#ffffff29" stroke={main} strokeWidth="2.6" />
          <path
            d="M60.2 32.4q1.6-2.6 4.6-2.8"
            fill="none"
            stroke={PAPER}
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity=".85"
          />
          <Arm x={55} y={47} color={main} />
        </g>
      );
    case "explorer":
      return (
        <g data-gear="explorer-hat flag binoculars">
          {/* Explorer hat */}
          <ellipse cx="35" cy="7.5" rx="21.5" ry="3.8" fill="#c99d5c" />
          <path d="M23 7.5Q23-7 35-7t12 14.5Z" fill="#e3c085" />
          <rect x="23.6" y="2.2" width="22.8" height="3.2" fill={main} />
          {/* Flag, left hand */}
          <path d="M5 28.5V72" stroke="#d9d2e8" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5.6 29h13l-3.2 4.6 3.2 4.6h-13Z" fill={main} />
          <Arm x={5} y={51} color={main} />
          {/* Binoculars, right hand */}
          <rect
            x="54.5"
            y="35"
            width="6.4"
            height="10"
            rx="2.6"
            fill={deep}
            stroke={main}
            strokeWidth="1.1"
          />
          <rect
            x="62.6"
            y="35"
            width="6.4"
            height="10"
            rx="2.6"
            fill={deep}
            stroke={main}
            strokeWidth="1.1"
          />
          <rect x="60.4" y="38" width="2.8" height="3.2" rx=".8" fill={main} />
          <circle cx="57.7" cy="35.6" r="2.3" fill="#c7ecff" />
          <circle cx="65.8" cy="35.6" r="2.3" fill="#c7ecff" />
          <Arm x={56} y={47} color={main} />
        </g>
      );
    case "fixer":
      return (
        <g data-gear="hard-hat wrench">
          {/* Hard hat */}
          <path d="M18 12Q18-5 35-5t17 17Z" fill="#ffc93c" />
          <rect x="33" y="-5" width="4" height="16" rx="1.6" fill="#ffe08a" />
          <rect x="14" y="10" width="42" height="4.2" rx="2.1" fill="#eaa91a" />
          {/* Wrench, right hand */}
          <g transform="rotate(30 60 50)">
            <rect
              x="57.6"
              y="32"
              width="4.8"
              height="20"
              rx="2.4"
              fill="#d5dbe8"
              stroke="#8c95ab"
              strokeWidth=".8"
            />
            <path
              d="M57.5 22.5V28h5v-5.5A6.5 6.5 0 1 1 57.5 22.5Z"
              fill="#d5dbe8"
              stroke="#8c95ab"
              strokeWidth=".8"
            />
          </g>
          <Arm x={58} y={50} color={main} />
          {/* Spare bolt on the left, in the scout's color */}
          <path d="m4 40-4 7h4l-2 5 7-8H4.6l2-4Z" fill={main} />
        </g>
      );
    case "experimenter":
      return (
        <g data-gear="goggles flask">
          {/* Goggles on the forehead */}
          <rect x="18" y="11" width="34" height="3" rx="1.5" fill={deep} />
          <circle cx="28" cy="12.5" r="5" fill="#c9f3ff" stroke={main} strokeWidth="2" />
          <circle cx="42" cy="12.5" r="5" fill="#c9f3ff" stroke={main} strokeWidth="2" />
          <rect x="32.6" y="11.4" width="4.8" height="2.2" fill={main} />
          <path
            d="M25.6 10.6q1.3-1.6 3.2-1.7m10.8 1.7q1.3-1.6 3.2-1.7"
            fill="none"
            stroke={PAPER}
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* Flask, right hand */}
          <path
            d="M60 30h5v7l7 13q1.5 3-1.8 3H54.8q-3.3 0-1.8-3l7-13Z"
            fill="#ffffff22"
            stroke="#e9e2ff"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M55.6 45h13.8l2.4 5q1.5 3-1.8 3H54.8q-3.3 0-1.8-3Z" fill={main} />
          <rect x="59" y="28.6" width="7" height="2.2" rx="1" fill="#e9e2ff" />
          <circle cx="64" cy="41" r="1.3" fill={main} opacity=".85" />
          <circle cx="61.6" cy="37.8" r=".9" fill={main} opacity=".7" />
          <Arm x={55} y={48} color={main} />
          {/* Little sparkle on the left */}
          <path d="M5 40q.7 3 3.5 3.5Q5.7 44 5 47q-.7-3-3.5-3.5Q4.3 43 5 40Z" fill={main} />
        </g>
      );
  }
}
