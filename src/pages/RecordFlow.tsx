import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import AngleGifTutorial from "../components/capture/AngleGifTutorial";
import { CameraRecorder } from "../components/CameraRecorder";
import { SavePreview } from "../components/SavePreview";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { performAutoCheck } from "../utils/autoCheck";
import { useTutorialSeen } from "../hooks/usePrefs";

// Recording is 4 angles x 30s. Require most of it before accepting the scan.
const MIN_RECORDING_SECONDS = 100;

const angleNames = ["middle", "top", "bottom", "detail"] as const;

const RecordFlow = () => {
  const navigate = useNavigate();
  const [tutorialSeen, setTutorialSeen] = useTutorialSeen();

  // --- TUTORIAL STATE ---
  const [tutorialIndex, setTutorialIndex] = useState(0);
  // Repeat users go straight to the camera; the guide stays reachable from Home.
  const [showTutorial, setShowTutorial] = useState(!tutorialSeen);

  // --- RECORDING STATE ---
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkError, setCheckError] = useState<string[] | null>(null);
  // Bump to force a fresh CameraRecorder (restarts countdown → recording).
  const [attempt, setAttempt] = useState(0);

  // --- TUTORIAL HANDLERS ---
  const finishTutorial = useCallback(() => {
    setTutorialSeen(true);
    setShowTutorial(false);
  }, [setTutorialSeen]);

  const handleTutorialNext = () => {
    if (tutorialIndex < angleNames.length - 1) setTutorialIndex(tutorialIndex + 1);
    else finishTutorial();
  };

  const handleTutorialPrev = () => {
    if (tutorialIndex > 0) setTutorialIndex(tutorialIndex - 1);
  };

  // --- RECORDING HANDLERS ---
  const handleRecordingComplete = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const result = await performAutoCheck(blob, MIN_RECORDING_SECONDS);
      if (!result.ok) {
        setCheckError(result.errors);
        return;
      }
      result.warnings.forEach((w) => toast.warning(w));
      setFinalBlob(blob);
      toast.success("Capture Complete!");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setFinalBlob(null);
    setAttempt((n) => n + 1);
  };

  // Dismiss the error modal and remount the camera for a fresh take.
  const retryAfterError = () => {
    setCheckError(null);
    setFinalBlob(null);
    setAttempt((n) => n + 1);
  };

  // --- RENDER: PREVIEW ---
  if (finalBlob) {
    return <SavePreview videoBlob={finalBlob} onBack={handleRetake} onDone={() => navigate("/")} />;
  }

  // --- RENDER: MAIN FLOW ---
  return (
    <div className="flex flex-col h-[100dvh] bg-black">
      {/* ERROR MODAL */}
      <Dialog open={!!checkError} onOpenChange={(open) => !open && setCheckError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive gap-2">
              <AlertTriangle /> Recording Issue
            </DialogTitle>
            <DialogDescription>We couldn&apos;t accept this scan:</DialogDescription>
          </DialogHeader>

          {/* Outside DialogDescription — that renders a <p>, and a <ul> can't nest in one. */}
          <ul className="list-disc pl-5 text-sm text-foreground space-y-1">
            {checkError?.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Back home
            </Button>
            <Button onClick={retryAfterError}>Retake</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1. TUTORIAL PHASE */}
      {showTutorial && (
        <AngleGifTutorial
          angle={angleNames[tutorialIndex]}
          onNext={handleTutorialNext}
          onPrev={handleTutorialPrev}
          onSkipAll={finishTutorial}
        />
      )}

      {/* 2. PROCESSING OVERLAY */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="text-white flex flex-col items-center p-6 bg-black/50 rounded-2xl border border-white/20">
            <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
            <p className="text-base font-medium">Finalizing video...</p>
          </div>
        </div>
      )}

      {/* 3. CAMERA PHASE */}
      {!showTutorial && !checkError && (
        <CameraRecorder
          key={attempt}
          onRecordingComplete={handleRecordingComplete}
          minSeconds={MIN_RECORDING_SECONDS}
        />
      )}
    </div>
  );
};

export default RecordFlow;
