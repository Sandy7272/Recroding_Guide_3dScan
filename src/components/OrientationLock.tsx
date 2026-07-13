import { useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";

interface OrientationLockProps {
  children: React.ReactNode;
}

const OrientationLock = ({ children }: OrientationLockProps) => {
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const lockOrientation = async () => {
      if (screen.orientation && 'lock' in screen.orientation) {
        try {
          await screen.orientation.lock("landscape-primary");
        } catch (error) {
          console.warn("Failed to lock screen orientation:", error);
        }
      }
    };

    lockOrientation();

    const handleOrientationChange = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    window.addEventListener("resize", handleOrientationChange);

    return () => {
      if (screen.orientation && 'unlock' in screen.orientation) {
        screen.orientation.unlock();
      }
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, []);

  if (isPortrait) {
    return (
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-foreground p-6 text-center">
        <RotateCcw className="w-12 h-12 mb-4 animate-pulse text-primary" />
        <h2 className="text-xl font-bold mb-2">Rotate to start the 3D scanning</h2>
        <p className="text-muted-foreground">Ensure auto-rotate is enabled.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default OrientationLock;