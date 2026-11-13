import { describe, it, expect } from "vitest";
import { fixWebmDuration } from "@fix-webm-duration/fix";
import { WebmFile } from "@fix-webm-duration/parser";
describe("recorded WebM duration metadata", () => {
  it("adds the measured duration to a container missing duration, preserving the video MIME", async () => {
    // Minimal EBML Segment/Info/TimecodeScale container; tests metadata, not playable footage.
    const bytes = new Uint8Array([
      0x18, 0x53, 0x80, 0x67, 0x8c, 0x15, 0x49, 0xa9, 0x66, 0x87, 0x2a, 0xd7, 0xb1, 0x83, 0x0f,
      0x42, 0x40,
    ]);
    const source = new Blob([bytes], { type: "video/webm" });
    const fixed = await fixWebmDuration(source, 4321, { logger: false });
    expect(fixed.type).toBe("video/webm");
    const parsed = await WebmFile.fromBlob(fixed);
    expect(
      parsed
        .getSectionById(0x8538067)
        ?.getSectionById(0x549a966)
        ?.getSectionById(0x489)
        ?.getValue(),
    ).toBe(4321);
  });
});
