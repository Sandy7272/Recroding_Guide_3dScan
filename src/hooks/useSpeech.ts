import { useCallback, useEffect, useRef } from "react";
import { useMuted } from "./usePrefs";

/**
 * Speech synthesis that respects the shared mute preference.
 *
 * getVoices() is populated asynchronously on most browsers and returns an empty
 * array on first call, so we retry briefly before giving up and letting the
 * engine pick a default.
 */
export const useSpeech = () => {
  const [muted] = useMuted();
  const mutedRef = useRef(muted);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
    if (muted) window.speechSynthesis?.cancel();
  }, [muted]);

  const cancel = useCallback(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    retryRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  const speak = useCallback(
    (text: string, rate = 1) => {
      if (!("speechSynthesis" in window)) return;
      cancel();
      if (mutedRef.current) return;

      const attempt = (tries = 0) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0 && tries < 10) {
          retryRef.current = setTimeout(() => attempt(tries + 1), 100);
          return;
        }
        if (mutedRef.current) return;

        const msg = new SpeechSynthesisUtterance(text);
        msg.rate = rate;
        const preferred = voices.find((v) => v.lang.startsWith("en"));
        if (preferred) msg.voice = preferred;
        window.speechSynthesis.speak(msg);
      };

      attempt();
    },
    [cancel]
  );

  useEffect(() => cancel, [cancel]);

  return { speak, cancel, muted };
};
