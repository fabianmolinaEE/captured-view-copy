import { Link } from "@tanstack/react-router";
import { FlaskConical, Rocket, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Shell, PageHeading } from "./Shell";
import { Button } from "@/components/ui/button";

/** These pages describe future workflow; they expose no execution controls or fabricated results. */
export function ComingSoon({ area }: { area: "experiments" | "rollouts" }) {
  const experiments = area === "experiments";
  const title = experiments ? "A/B Tests" : "Rollouts";
  const Icon = experiments ? FlaskConical : Rocket;
  const steps = experiments
    ? [
        "Start with an accepted insight and an editable next-step draft.",
        "Review the hypothesis, variants, participants, and measures of success.",
        "Approve a supported experiment before any participants are exposed.",
      ]
    : [
        "Link a reviewed improvement to an approved change and release.",
        "Review the rollout scope and who owns pause or rollback decisions.",
        "Compare actual outcomes, with uncertainty and evidence in view.",
      ];
  return (
    <Shell section={title}>
      <PageHeading
        title={title}
        description={
          experiments
            ? "A considered way to test your next move."
            : "Keep learning after an improvement ships."
        }
      />
      <div className="future-page">
        <span className="future-icon">
          <Icon size={34} />
        </span>
        <span className="status-badge coming-soon">Coming soon</span>
        <h2>
          {experiments
            ? "Good experiments start with good evidence."
            : "Close the loop, with care."}
        </h2>
        <p>
          {experiments
            ? "LoopMate will help turn reviewed insights into human-approved experiments. For now, you can review a finding and save the improvement you want to explore."
            : "LoopMate will connect reviewed improvements with releases and measured outcomes. Release integrations and performance comparisons are planned."}
        </p>
        <div className="future-steps">
          {steps.map((step, i) => (
            <div key={step}>
              <span>{i + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
        <div className="info-note">
          <CheckCircle2 />
          <span>
            {experiments
              ? "No experiments are running from this page. Approving a next-step draft only saves your research decision."
              : "No releases or performance deltas are shown here. This page does not deploy changes."}
          </span>
        </div>
        <Button asChild>
          <Link to="/insights">
            <ArrowLeft size={15} />
            Back to real insights
          </Link>
        </Button>
      </div>
    </Shell>
  );
}
