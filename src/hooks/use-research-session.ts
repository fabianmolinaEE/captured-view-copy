import { useEffect, useRef, useState } from "react";
import { getSession, saveSession } from "@/lib/research/sessionStorage";
import type { Session } from "@/lib/research/types";
import { useSessionsChanged } from "@/hooks/use-demo-import";
import {
  curatedCopyToSave,
  reconcileWithCuration,
  RemovedDemoSessionError,
} from "@/lib/research/demo/importTrackerRuns";

/** One optimistic document plus an ordered save queue keeps fast edits and decisions together. */
export function useResearchSession(id: string) {
  const [session, setSession] = useState<Session>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const latest = useRef<Session | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  useEffect(() => {
    const version = ++generation.current;
    setLoading(true);
    setSession(undefined);
    latest.current = undefined;
    setError("");
    setUnsaved(false);
    getSession(id)
      .then((value) => {
        if (generation.current === version) {
          latest.current = value;
          setSession(value);
        }
      })
      .catch((e) => {
        if (generation.current === version) setError(e.message);
      })
      .finally(() => {
        if (generation.current === version) setLoading(false);
      });
    return () => {
      generation.current = version + 1;
    };
  }, [id]);
  // A direct link can load before the automatic Tracker import has written this session. A page
  // that loaded a pre-generated session before the curation migration re-reads it once the
  // migration reports it, so a later save cannot bring back what the migration removed.
  useSessionsChanged((event) => {
    const added = event?.detail?.added;
    const version = generation.current;
    if (latest.current) {
      if (!latest.current.pregenerated || !added?.includes(id)) return;
      const pending = queue.current.then(async () => {
        const stored = await getSession(id);
        if (generation.current !== version || !latest.current) return;
        if (!stored) {
          latest.current = undefined;
          setSession(undefined);
          setUnsaved(false);
          setError(new RemovedDemoSessionError().message);
          return;
        }
        const reconciled = reconcileWithCuration(latest.current, stored);
        if (reconciled !== latest.current) {
          latest.current = reconciled;
          setSession(reconciled);
        }
      });
      queue.current = pending.catch(() => {
        /* The next save reports any storage error. */
      });
      return;
    }
    if (added?.length && !added.includes(id)) return;
    getSession(id)
      .then((value) => {
        if (generation.current === version && !latest.current && value) {
          latest.current = value;
          setSession(value);
          setError("");
        }
      })
      .catch(() => {
        /* The initial load already reported any storage error. */
      });
  });
  const update = async (change: (current: Session) => Session) => {
    if (!latest.current) return false;
    const version = generation.current;
    let next: Session;
    try {
      next = change(latest.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the finding.");
      return false;
    }
    if (next.sync) next = { ...next, sync: { ...next.sync, state: "local_changes" } };
    latest.current = next;
    setSession(next);
    setUnsaved(true);
    setError("");
    const pending = queue.current.then(async () => {
      const safe = await curatedCopyToSave(next);
      if (safe !== next && generation.current === version && latest.current === next) {
        latest.current = safe;
        setSession(safe);
        next = safe;
      }
      await saveSession(safe);
    });
    queue.current = pending.then(
      () => {},
      () => {},
    );
    try {
      await pending;
      if (generation.current === version && latest.current === next) setUnsaved(false);
      return true;
    } catch (e) {
      if (generation.current === version && e instanceof RemovedDemoSessionError) {
        latest.current = undefined;
        setSession(undefined);
        setUnsaved(false);
        setError(e.message);
        return false;
      }
      if (generation.current === version)
        setError(
          e instanceof Error ? e.message : "Local save failed. Retry or export before leaving.",
        );
      return false;
    }
  };
  return { session, loading, error, unsaved, update, retry: () => update((current) => current) };
}
