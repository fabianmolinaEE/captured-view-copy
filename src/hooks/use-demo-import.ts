import { useEffect, useRef } from "react";
import {
  SESSIONS_CHANGED_EVENT,
  autoImportTrackerRuns,
} from "@/lib/research/demo/importTrackerRuns";
import { autoImportExplorerRuns } from "@/lib/research/demo/importExplorerRuns";

/**
 * Mount once in the root: imports the real pre-generated Uber Eats Tracker runs and DoorDash
 * Explorer runs the first time this browser opens the app (each with its own version key). Runs
 * only on the client (effects never run during SSR); the module guards make StrictMode's double
 * effect and remounts share one import.
 */
export function useDemoImport() {
  useEffect(() => {
    const ignore = () => {
      /* Local storage unavailable; Settings → Re-import reports the actual error. */
    };
    void autoImportTrackerRuns().catch(ignore);
    void autoImportExplorerRuns().catch(ignore);
  }, []);
}

/**
 * Calls `reload` whenever sessions are added outside the page's own load (for example the
 * automatic Tracker or Explorer import finishing after a list already rendered).
 */
export function useSessionsChanged(reload: (event?: CustomEvent<{ added?: string[] }>) => void) {
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => {
    const listener = (event: Event) => latest.current(event as CustomEvent<{ added?: string[] }>);
    window.addEventListener(SESSIONS_CHANGED_EVENT, listener);
    return () => window.removeEventListener(SESSIONS_CHANGED_EVENT, listener);
  }, []);
}
