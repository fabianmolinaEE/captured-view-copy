import { useId, useState } from "react";
import { Sparkles, FlaskConical, Rocket, ArrowUpRight, RotateCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Hero } from "./Hero";

const stages = [
  {
    name: "Insights",
    verb: "Discover",
    icon: Sparkles,
    to: "/insights" as const,
    title: "Every hero starts with a little insight.",
    description: "See the friction. Review the evidence. Find your next opportunity.",
    tag: "Start with real evidence",
  },
  {
    name: "A/B Tests",
    verb: "Test",
    icon: FlaskConical,
    to: "/ab-tests" as const,
    title: "Give a promising idea its moment.",
    description: "Planned: turn approved ideas into controlled, human-guided experiments.",
    tag: "Future experiments",
  },
  {
    name: "Rollouts",
    verb: "Grow",
    icon: Rocket,
    to: "/rollouts" as const,
    title: "Bring the learning around again.",
    description: "Planned: connect release outcomes to the next round of insights.",
    tag: "Future rollouts",
  },
];
const loopPath =
  "M320 200C250 110 188 78 132 110C66 148 64 252 132 290C188 322 250 290 320 200C390 110 452 78 508 110C574 148 576 252 508 290C452 322 390 290 320 200";

/** An interactive product-vision illustration, never a live job/progress indicator. */
export function LoopJourney() {
  const id = useId().replaceAll(":", "");
  const [active, setActive] = useState(0);
  const stage = stages[active]!;
  return (
    <div className={`loop-journey journey-stage-${active}`}>
      <div className="journey-caption">
        <span className="journey-caption-dot" />
        The LoopMate workflow<span>Product vision</span>
      </div>
      <div className="journey-scene" aria-hidden="true">
        <div className="journey-ambient ambient-aqua" />
        <div className="journey-ambient ambient-peach" />
        <div className="glass-fin fin-one" />
        <div className="glass-fin fin-two" />
        <div className="glass-fin fin-three" />
        <svg className="infinity-track" viewBox="0 0 640 400" fill="none">
          <defs>
            <linearGradient
              id={`${id}-spectrum`}
              x1="90"
              y1="110"
              x2="550"
              y2="290"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#75e8e1" />
              <stop offset=".38" stopColor="#9a8bff" />
              <stop offset=".68" stopColor="#ed9cfa" />
              <stop offset="1" stopColor="#ffc49b" />
            </linearGradient>
          </defs>
          <path className="loop-track-shadow" d={loopPath} />
          <path className="loop-track-base" d={loopPath} stroke={`url(#${id}-spectrum)`} />
          <path className="loop-track-edge" d={loopPath} />
          <path className="loop-current current-one" d={loopPath} pathLength="100" />
          <path className="loop-current current-two" d={loopPath} pathLength="100" />
          <circle className="loop-node node-aqua" cx="130" cy="112" r="7" />
          <circle className="loop-node node-violet" cx="510" cy="112" r="7" />
          <circle className="loop-node node-peach" cx="510" cy="288" r="7" />
        </svg>
        <div className="journey-mascot">
          <span className="mascot-halo" />
          <span className="mascot-flight">
            <Hero large />
          </span>
          <span className="mascot-trail trail-one" />
          <span className="mascot-trail trail-two" />
        </div>
        <div className="journey-float-tag float-observe">
          <Sparkles size={13} />A little discovery
        </div>
        <div className="journey-float-tag float-improve">
          <Rocket size={13} />A better next move
        </div>
        <span className="journey-star star-a">✦</span>
        <span className="journey-star star-b">✧</span>
      </div>
      <div className="journey-switcher" role="group" aria-label="Explore the improvement loop">
        {stages.map((item, index) => (
          <button
            type="button"
            key={item.name}
            aria-label={item.name}
            aria-pressed={active === index}
            onClick={() => setActive(index)}
          >
            <item.icon size={14} />
            <span>{item.verb}</span>
          </button>
        ))}
        <button
          type="button"
          className="cycle-journey"
          aria-label="Next part of the loop"
          onClick={() => setActive((value) => (value + 1) % stages.length)}
        >
          <RotateCw size={15} />
        </button>
      </div>
      <div className="journey-explainer" aria-live="polite">
        <span>{stage.tag}</span>
        <Link to={stage.to}>
          {stage.title}
          <ArrowUpRight size={15} />
        </Link>
        <p>{stage.description}</p>
      </div>
    </div>
  );
}
