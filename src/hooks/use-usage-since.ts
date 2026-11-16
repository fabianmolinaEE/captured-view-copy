import { useSyncExternalStore } from "react";
import { USAGE_SINCE_EVENT, USAGE_SINCE_KEY, loadUsageSince } from "@/lib/research/agentSettings";

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === USAGE_SINCE_KEY) callback();
  };
  window.addEventListener(USAGE_SINCE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(USAGE_SINCE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** ISO time of the last usage-counter reset, or null (SSR-safe). */
export function useUsageSince(): string | null {
  return useSyncExternalStore(subscribe, loadUsageSince, () => null);
}
