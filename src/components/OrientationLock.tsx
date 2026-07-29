import { useState, useEffect } from "react";
import { RotateCcw, Smartphone } from "lucide-react";
import { enterLandscapeFullscreen, exitLandscapeFullscreen, isIOS } from "@/lib/viewport";
import { usePrefersReducedMotion } from "@/hooks/usePrefs";

interface OrientationLockProps {
  children: React.ReactNode;
}

/**
 * Gates content behind landscape orientation.
 *
 * We attempt a real lock (fullscreen + screen.orientation.lock), but that only
 * works on Android Chrome and only from a user gesture — so the manual "rotate
 * your phone" gate below is the actual load-bearing mechanism, not a fallback.
 */
const OrientationLock = ({ children }: OrientationLockProps) => {
  const [isPortrait, setIsPortrait] = useState(() => window.innerHeight > window.innerWidth);
  const reducedMotion = usePrefersReducedMotion();
  const ios = isIOS();

  useEffect(() => {
    const handleOrientationChange = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", handleOrientationChange);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      window.removeEventListener("resize", handleOrientationChange);
      window.removeEventListener("orientationchange", handleOrientationChange);
      void exitLandscapeFullscreen();
    };
  }, []);

  if (isPortrait) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background px-8 text-center text-foreground">
        <RotateCcw className={`w-12 h-12 text-primary ${reducedMotion ? "" : "animate-pulse"}`} />
        <h2 className="text-xl font-bold">Rotate your phone to landscape</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {ios
            ? "Swipe down from the top-right corner to open Control Centre, then tap the padlock icon to turn off Portrait Orientation Lock."
            : "If nothing happens when you rotate, enable auto-rotate in your quick settings."}
        </p>

        {/* On Android this gesture is what makes a real orientation lock possible. */}
        <button
          onClick={() => void enterLandscapeFullscreen()}
          className="mt-2 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Smartphone className="h-4 w-4" />
          Go fullscreen
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default OrientationLock;
