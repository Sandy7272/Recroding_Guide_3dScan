/**
 * Fullscreen + orientation helpers.
 *
 * Chrome on Android rejects screen.orientation.lock() unless the document is
 * fullscreen, and iOS Safari does not implement it at all. So the only way to
 * get a reliable landscape lock is: enter fullscreen from a user gesture, then
 * lock. On iOS both calls no-op and we fall back to asking the user to rotate.
 */

/** `lock` isn't in the TS DOM lib yet, though it ships in Chrome. */
interface LockableOrientation extends ScreenOrientation {
  lock?: (orientation: "landscape" | "portrait" | "any" | "natural") => Promise<void>;
}

const orientation = () =>
  typeof screen !== "undefined" ? (screen.orientation as LockableOrientation | undefined) : undefined;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS 13+ reports as Mac but is the only "Mac" with touch.
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** True when the browser can actually hold a landscape lock for us. */
export const canLockOrientation = () => typeof orientation()?.lock === "function" && !isIOS();

/**
 * Enters fullscreen and locks to landscape. Must be called from a user gesture
 * to have any chance of succeeding. Resolves to whether the lock took hold.
 */
export const enterLandscapeFullscreen = async (): Promise<boolean> => {
  const el = document.documentElement;

  if (!document.fullscreenElement && el.requestFullscreen) {
    try {
      await el.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // Fullscreen refused — the lock below will almost certainly fail too,
      // and we fall back to the "rotate your phone" gate.
    }
  }

  if (!canLockOrientation()) return false;

  try {
    await orientation()!.lock!("landscape");
    return true;
  } catch {
    return false;
  }
};

export const exitLandscapeFullscreen = async () => {
  if (canLockOrientation()) {
    try {
      orientation()?.unlock();
    } catch {
      // Ignore — nothing was locked.
    }
  }
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore.
    }
  }
};
