import { FlaskConical } from "lucide-react";

export const SIMULATED_LABEL = "Simulated demo";

export interface SimulatedBadgeProps {
  /** Visible text. Defaults to "Simulated demo"; never hide it behind the tooltip. */
  label?: string;
  /** Extra explanation, exposed as a native tooltip and to screen readers. */
  detail?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Visible pill for any simulated record (AUTOMATED-LOOP §3). The label is always
 * rendered as text; `detail` only adds context.
 */
export function SimulatedBadge({
  label = SIMULATED_LABEL,
  detail,
  size = "sm",
  className = "",
}: SimulatedBadgeProps) {
  const sizing = size === "md" ? "gap-1.5 px-2.5 py-1 text-xs" : "gap-1 px-2 py-0.5 text-[11px]";
  return (
    <span
      data-simulated="true"
      title={detail}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-dashed border-[#efc68f8c] bg-[#efc68f17] font-medium leading-tight text-[#f3d3a4] ${sizing} ${className}`}
    >
      <FlaskConical aria-hidden="true" size={size === "md" ? 13 : 11} />
      <span>{label}</span>
      {detail ? <span className="sr-only">: {detail}</span> : null}
    </span>
  );
}
