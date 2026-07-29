import { useState, useEffect, useCallback, useRef } from "react";
import { Check, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/usePrefs";

import naturalLightingGood from "../../asset/naturalLightingGood.webp";
import naturalLightingBad from "../../asset/naturalLightingBad.webp";
import frameObjectGood from "../../asset/frame-object-good.webp";
import frameObjectBad from "../../asset/frame-object-bad.webp";
import cleanBackgroundGood from "../../asset/cleanBackgroundGood.webp";
import cleanBackgroundBad from "../../asset/cleanBackgroundBad.webp";

interface Topic {
  id: number;
  instruction: string;
  subtext: string;
  goodImg: string;
  badImg: string;
  goodAlt: string;
  badAlt: string;
}

// ------------------------------------------------------------------
// DATA
// ------------------------------------------------------------------
const topics: Topic[] = [
  {
    id: 1,
    instruction: "Use Natural Lighting",
    subtext: "Avoid harsh shadows or dark rooms",
    goodImg: naturalLightingGood,
    badImg: naturalLightingBad,
    goodAlt: "Object lit evenly by soft daylight, details clearly visible",
    badAlt: "Same object at night under a street lamp, most of it lost in shadow",
  },
  {
    id: 2,
    instruction: "Keep the object in frame",
    subtext: "Fit the entire object on screen.",
    goodImg: frameObjectGood,
    badImg: frameObjectBad,
    goodAlt: "Whole object visible with margin on every side",
    badAlt: "Camera too close, edges of the object cropped out of frame",
  },
  {
    id: 3,
    instruction: "Clean Background",
    subtext: "Avoid cluttered backgrounds",
    goodImg: cleanBackgroundGood,
    badImg: cleanBackgroundBad,
    goodAlt: "Object standing alone against a plain background",
    badAlt: "Object surrounded by other bikes and clutter, hard to separate",
  },
];

const SLIDE_MS = 6000;
const TICK_MS = 50;
// Below this, a press is a tap; above it, the user was holding to read.
const TAP_MAX_MS = 200;

interface InstagramStoryTutorialProps {
  onComplete: () => void;
  isOpen: boolean;
}

const InstagramStoryTutorial = ({ onComplete, isOpen }: InstagramStoryTutorialProps) => {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const pressStartRef = useRef(0);
  const touchStartXRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Warm every image up front — 6 small files, and it stops slides 2 and 3
  // from showing empty cards for the first second on a mobile connection.
  useEffect(() => {
    topics.forEach((t) => {
      [t.goodImg, t.badImg].forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    });
  }, []);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    completedRef.current = false;
    setIndex(0);
    setProgress(0);
    setPaused(false);
  }, [isOpen]);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  const goNext = useCallback(() => {
    if (index < topics.length - 1) {
      setProgress(0);
      setIndex(index + 1);
    } else {
      finish();
    }
  }, [index, finish]);

  const goPrev = useCallback(() => {
    setProgress(0);
    setIndex((idx) => (idx > 0 ? idx - 1 : 0));
  }, []);

  // Auto-advance, frozen while pressed-and-held or while the tab is hidden.
  useEffect(() => {
    if (!isOpen || paused) return;
    const step = 100 / (SLIDE_MS / TICK_MS);
    const timer = setInterval(() => setProgress((prev) => Math.min(100, prev + step)), TICK_MS);
    return () => clearInterval(timer);
  }, [isOpen, paused, index]);

  // Advancing is a side effect — keep it out of the progress updater.
  useEffect(() => {
    if (!isOpen || progress < 100) return;
    goNext();
  }, [isOpen, progress, goNext]);

  // Don't burn through slides while the phone is locked or the user tabbed away.
  useEffect(() => {
    const onVisibility = () => setPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") finish();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, goNext, goPrev, finish]);

  const onPointerDown = () => {
    pressStartRef.current = Date.now();
    setPaused(true);
  };

  // A long press means "let me read this" — releasing must not also advance.
  const onPointerUp = (action: () => void) => () => {
    setPaused(false);
    if (Date.now() - pressStartRef.current <= TAP_MAX_MS) action();
  };

  const onPointerAbort = () => {
    pressStartRef.current = 0;
    setPaused(false);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartXRef.current;
    touchStartXRef.current = null;
    if (start === null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  const current = topics[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scanning tips"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={cn(
        "fixed inset-0 z-50 bg-black flex flex-col h-[100dvh] w-screen overflow-hidden overscroll-none touch-none select-none",
        !isOpen && "hidden"
      )}
    >
      {/* Tap zones: left third = previous, right third = next, hold = pause */}
      <button
        type="button"
        aria-label="Previous tip"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp(goPrev)}
        onPointerLeave={onPointerAbort}
        onPointerCancel={onPointerAbort}
        className="absolute inset-y-0 left-0 w-1/3 z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      />
      <button
        type="button"
        aria-label="Next tip"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp(goNext)}
        onPointerLeave={onPointerAbort}
        onPointerCancel={onPointerAbort}
        className="absolute inset-y-0 right-0 w-1/3 z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      />

      {/* Progress bars */}
      <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-20 pointer-events-none">
        {topics.map((t, i) => (
          <div key={t.id} className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-75 ease-linear"
              style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Skip button */}
      <button
        type="button"
        onClick={finish}
        className="absolute top-7 right-3 z-30 flex h-9 items-center gap-1 rounded-full bg-black/50 backdrop-blur-md px-4 text-xs font-semibold text-white hover:bg-black/70 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
      >
        Skip <X className="w-3.5 h-3.5" />
      </button>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 pt-8 pb-4 min-h-0 pointer-events-none">
        {/* Re-keying on the slide id restarts the entrance animation — without
            it React reuses the nodes and only slide 1 ever animates. */}
        <div
          key={`text-${current.id}`}
          className={cn("text-center w-full mb-4 md:mb-6 shrink-0", !reducedMotion && "animate-fade-in")}
        >
          <h2 className="text-xl md:text-2xl font-bold text-white leading-tight drop-shadow-md">
            {current.instruction}
          </h2>
          <p className="text-white/85 mt-1.5 text-sm font-medium drop-shadow-sm">{current.subtext}</p>
        </div>

        <div
          key={`imgs-${current.id}`}
          className="w-full flex-1 min-h-0 flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8"
        >
          {/* GOOD */}
          <div
            className={cn(
              "relative w-full max-w-sm flex-1 basis-0 aspect-video bg-white rounded-lg overflow-hidden border-2 border-green-500 shadow-lg min-h-0",
              !reducedMotion && "animate-slide-up"
            )}
          >
            <img
              src={current.goodImg}
              width={900}
              height={502}
              className="w-full h-full object-cover"
              alt={current.goodAlt}
            />
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1">
              <Check className="text-green-400 w-3 h-3 md:w-4 md:h-4" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-[11px] font-bold py-1 text-center uppercase tracking-widest">
              Do This
            </div>
          </div>

          {/* BAD */}
          <div
            className={cn(
              "relative w-full max-w-sm flex-1 basis-0 aspect-video bg-white rounded-lg overflow-hidden border-2 border-red-500 shadow-lg min-h-0",
              !reducedMotion && "animate-slide-up animation-delay-100"
            )}
          >
            <img
              src={current.badImg}
              width={900}
              height={502}
              className="w-full h-full object-cover grayscale-[0.3]"
              alt={current.badAlt}
            />
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1">
              <XCircle className="text-red-400 w-3 h-3 md:w-4 md:h-4" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[11px] font-bold py-1 text-center uppercase tracking-widest">
              Don&apos;t Do This
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstagramStoryTutorial;
