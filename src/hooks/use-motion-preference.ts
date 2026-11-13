import { useEffect, useState } from "react";

/** System reduced motion always wins; manual pause survives route changes and reloads. */
export function useMotionPreference() {
  const [reduced, setReduced] = useState(true);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    try {
      setPaused(localStorage.getItem("loopmate-motion") === "paused");
    } catch {
      /* Motion can still be paused without storage access. */
    }
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const toggle = () => {
    if (reduced) return;
    const next = !paused;
    setPaused(next);
    try {
      localStorage.setItem("loopmate-motion", next ? "paused" : "enabled");
    } catch {
      /* Keep the current in-memory choice. */
    }
  };
  return { enabled: !reduced && !paused, reduced, toggle };
}
