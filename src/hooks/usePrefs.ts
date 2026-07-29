import { useCallback, useEffect, useState } from "react";

/**
 * Tiny localStorage-backed preference store.
 *
 * Values are shared across components in the same tab via a custom event, so
 * muting the voiceover in the tutorial also mutes it in the recorder.
 */

const EVENT = "prefs:change";

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

const write = <T,>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota — fall through, state still updates in memory.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
};

const usePref = <T,>(key: string, fallback: T) => {
  const [value, setValue] = useState<T>(() => read(key, fallback));

  useEffect(() => {
    const sync = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) setValue(read(key, fallback));
    };
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [key, fallback]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      write(key, next);
    },
    [key]
  );

  return [value, update] as const;
};

/** Voiceover mute, shared between the tutorials and the recorder. */
export const useMuted = () => usePref("scan:muted", false);

/** Whether the user has completed the guided tutorials at least once. */
export const useTutorialSeen = () => usePref("scan:tutorialSeen", false);

/** Honours the OS "reduce motion" setting. */
export const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
};
