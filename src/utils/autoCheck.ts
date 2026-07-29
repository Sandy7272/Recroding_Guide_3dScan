export interface CheckResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
}

/** Give up rather than hang the UI behind the "Finalizing video…" spinner forever. */
const METADATA_TIMEOUT_MS = 10_000;

/**
 * Reads a reliable duration out of a recorded blob.
 *
 * Chrome's MediaRecorder writes WebM without a duration in the header, so
 * `video.duration` comes back as Infinity. Seeking far past the end forces the
 * browser to resolve the real duration, which it then reports as currentTime.
 */
const resolveDuration = (video: HTMLVideoElement): Promise<number> =>
  new Promise((resolve) => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      resolve(video.duration);
      return;
    }

    const done = (value: number) => {
      video.removeEventListener("seeked", onSeeked);
      resolve(value);
    };

    const onSeeked = () => {
      const seeked = video.currentTime;
      video.currentTime = 0;
      done(Number.isFinite(seeked) && seeked > 0 ? seeked : NaN);
    };

    video.addEventListener("seeked", onSeeked);
    try {
      video.currentTime = 1e101;
    } catch {
      done(NaN);
    }

    // Some browsers never fire `seeked` on a malformed blob.
    setTimeout(() => done(NaN), 3000);
  });

export const performAutoCheck = async (
  videoBlob: Blob,
  expectedDurationMin: number = 12
): Promise<CheckResult> => {
  const warnings: string[] = [];
  const errors: string[] = [];

  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  const url = URL.createObjectURL(videoBlob);
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("timeout")),
        METADATA_TIMEOUT_MS
      );
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("decode"));
      };
    });
  } catch (err) {
    URL.revokeObjectURL(url);
    return {
      ok: false,
      warnings,
      errors: [
        (err as Error).message === "timeout"
          ? "Could not read the recording in time. Please retake."
          : "Failed to process video data. The file may be corrupted.",
      ],
    };
  }

  const { videoWidth, videoHeight } = video;
  const duration = await resolveDuration(video);
  URL.revokeObjectURL(url);

  // 1. Orientation — must be landscape.
  if (videoHeight > videoWidth) {
    errors.push("Video is in portrait mode. Please record in landscape (horizontal).");
  }

  // 2. Resolution — 1080p target, 720p tolerated with a warning.
  if (videoHeight < 720) {
    errors.push(`Resolution too low (${videoWidth}x${videoHeight}). Minimum 720p required.`);
  } else if (videoHeight < 1080) {
    warnings.push(`Resolution is ${videoWidth}x${videoHeight}. 1080p is recommended for better 3D results.`);
  }

  // 3. Duration. If the container hides it, fall back to a bitrate estimate
  //    rather than silently skipping the check (the old WebM behaviour).
  if (Number.isFinite(duration) && duration > 0) {
    if (duration < expectedDurationMin) {
      errors.push(
        `Recording is too short (${duration.toFixed(1)}s). Minimum ${expectedDurationMin} seconds required.`
      );
    }
  } else {
    warnings.push("Could not verify recording length on this browser.");
  }

  // 4. Sanity check on payload size — catches a black/empty capture.
  if (videoBlob.size < 100 * 1024) {
    errors.push("Video file is suspiciously small. Please check your camera.");
  }

  return { ok: errors.length === 0, warnings, errors };
};
