import type { Session } from "./types";
/** Attach the full, original video for local playback; source provenance and analysis stay intact. */
export async function attachOriginalVideo(session: Session, file: File): Promise<Session> {
  if (!/^video\/(mp4|webm)$/.test(file.type) || !file.size || file.size > 250 * 1024 * 1024)
    throw new Error("Choose a nonempty MP4 or WebM video smaller than 250 MB.");
  const source = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  try {
    const milliseconds = await new Promise<number>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        video.onloadedmetadata = null;
        video.onerror = null;
      };
      const fail = () => {
        cleanup();
        reject(
          new Error("The video could not be read. Try an MP4 version of the original recording."),
        );
      };
      const timer = setTimeout(fail, 15000);
      video.onerror = fail;
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          fail();
          return;
        }
        cleanup();
        resolve(Math.round(video.duration * 1000));
      };
      video.src = source;
    });
    if (Math.abs(milliseconds - session.duration_ms) > 2000)
      throw new Error(
        "The duration does not match this recording. Choose the full original video so saved timestamps stay aligned.",
      );
    return {
      ...session,
      video_blob: file,
      mime_type: file.type,
      extension: file.type === "video/mp4" ? "mp4" : "webm",
    };
  } finally {
    video.removeAttribute("src");
    URL.revokeObjectURL(source);
  }
}
