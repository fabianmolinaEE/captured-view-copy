export function Hero({ large = false }: { large?: boolean }) {
  return (
    <svg
      viewBox="0 0 70 80"
      className={`hero-icon ${large ? "hero-large" : ""}`}
      aria-hidden="true"
    >
      <path className="cape" d="M21 36 9 68q24-3 50 1L49 35Z" />
      <path className="ink" d="M24 43h22l7 20-18 6-19-6Z" />
      <path className="gold" d="m36 46-8 12h8l-3 9 12-15h-9l3-6Z" />
      <path className="ink" d="M18 18Q18 3 35 3t17 15v16q0 15-17 15T18 34Z" />
      <path className="face" d="M23 25h24v9q0 11-12 11T23 34Z" />
      <path className="cape" d="M19 20h32v12l-8-5-8 5-8-5-8 5Z" />
      <path className="paper" d="m25 23 7 2-7 2Zm20 0-7 2 7 2Z" />
      <path className="gold" d="m36 7-5 9h5l-2 6 9-11h-6l3-4Z" />
      <path className="ink" d="m22 62-5 12h12l4-11Zm25 0 6 12H41l-4-11Z" />
    </svg>
  );
}
