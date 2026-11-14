// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useResearchSession } from "@/hooks/use-research-session";
import {
  importTrackerRuns,
  resetAutoImportForTests,
  trackerRunsFile,
} from "@/lib/research/demo/importTrackerRuns";
import { clearAll } from "@/lib/research/sessionStorage";

beforeEach(async () => {
  await clearAll();
  window.localStorage.clear();
  resetAutoImportForTests();
});

describe("direct links opened before the Tracker import finishes", () => {
  it("loads the session once the import adds it, without a manual reload", async () => {
    const id = trackerRunsFile().videos[0]!.session_id;
    const { result } = renderHook(() => useResearchSession(id));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeUndefined();
    await act(async () => {
      await importTrackerRuns();
    });
    await waitFor(() => expect(result.current.session?.id).toBe(id));
  });
});
