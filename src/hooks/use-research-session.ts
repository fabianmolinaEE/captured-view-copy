import { useEffect, useRef, useState } from "react";
import { getSession, saveSession } from "@/lib/research/sessionStorage";
import type { Session } from "@/lib/research/types";
import { useSessionsChanged } from "@/hooks/use-demo-import";

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
  // A direct link can load before the automatic Tracker import has written this session.
  useSessionsChanged((event) => {
    if (latest.current) return;
    const added = event?.detail?.added;
    if (added?.length && !added.includes(id)) return;
    const version = generation.current;
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
    const pending = queue.current.then(() => saveSession(next));
    queue.current = pending.then(
      () => {},
      () => {},
    );
    try {
      await pending;
      if (generation.current === version && latest.current === next) setUnsaved(false);
      return true;
    } catch (e) {
      if (generation.current === version)
        setError(
          e instanceof Error ? e.message : "Local save failed. Retry or export before leaving.",
        );
      return false;
    }
  };
  return { session, loading, error, unsaved, update, retry: () => update((current) => current) };
}
