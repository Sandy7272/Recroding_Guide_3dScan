import { useEffect, useRef } from "react";

/**
 * Holds a screen wake lock while `active` is true.
 *
 * A scan runs ~2 minutes with no touch input, which is well past the default
 * display timeout on most phones — without this the screen sleeps mid-capture.
 * The lock is dropped by the browser whenever the tab is hidden, so we re-acquire
 * on visibilitychange.
 */
export const useWakeLock = (active: boolean) => {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      if (sentinelRef.current) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        sentinel.addEventListener("release", () => {
          sentinelRef.current = null;
        });
        sentinelRef.current = sentinel;
      } catch {
        // Denied (low battery, unsupported surface). Nothing we can do.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinelRef.current?.release();
      sentinelRef.current = null;
    };
  }, [active]);
};
