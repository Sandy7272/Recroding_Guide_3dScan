import { useRef, useState, useEffect, useCallback } from "react";
import { formatTime } from "@/utils/formatTime";
import { RotateCw, CheckCircle2, Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountdownOverlay } from "./capture/CountdownOverlay";
import CameraPermissionError from "./capture/CameraPermissionError";

type CameraErrorType = "denied" | "blocked" | "in-use" | "not-found" | "unknown";

// Non-standard camera capabilities/constraints not yet in the TS DOM lib.
interface ExtendedCapabilities extends MediaTrackCapabilities {
  focusMode?: string[];
  imageStabilization?: boolean;
  zoom?: { min: number; max: number; step?: number };
}
interface ExtendedConstraintSet extends MediaTrackConstraintSet {
  focusMode?: string;
  exposureMode?: string;
  whiteBalanceMode?: string;
  imageStabilization?: boolean;
  zoom?: number;
}

// --- Configuration ---
const ANGLE_DURATION = 30;
const TOTAL_DURATION = ANGLE_DURATION * 4;

const PHASES = [
  { id: 1, label: "Middle", instruction: "Hold phone at chest height. Walk around object." },
  { id: 2, label: "Top", instruction: "Raise the phone and Tilt it downwards 45°" },
  { id: 3, label: "Bottom", instruction: "Lower phone and Tilt it upwards 45°." },
  { id: 4, label: "Detail", instruction: "Get close. Pan slowly across textures." },
];

const useScreenOrientation = () => {
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isLandscape;
};

interface CameraRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

export const CameraRecorder = ({ onRecordingComplete }: CameraRecorderProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Flow State
  const [status, setStatus] = useState<"countdown" | "recording" | "paused" | "finished">("countdown");
  const [elapsed, setElapsed] = useState(0);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [flash, setFlash] = useState(false);
  const [phaseHighlight, setPhaseHighlight] = useState(false); // NEW: Controls the blink effect
  
  // Zoom State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hasZoom, setHasZoom] = useState(false);
  const [minZoom, setMinZoom] = useState(1);

  // Camera permission / hardware error
  const [cameraError, setCameraError] = useState<CameraErrorType | null>(null);

  const isLandscape = useScreenOrientation();

  // --- Voice Assistant ---
  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.rate = 1.1; 
    window.speechSynthesis.speak(msg);
  }, []);

  // --- 1. Init Camera ---
  const initCamera = useCallback(async () => {
      try {
        setCameraError(null);
        const advanced: ExtendedConstraintSet[] = [
          { focusMode: "continuous" },
          { exposureMode: "continuous" },
          { whiteBalanceMode: "continuous" },
          { imageStabilization: true },
        ];
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
            advanced,
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Apply constraints logic (Zoom, Focus, etc.)
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as ExtendedCapabilities;
        const advancedConstraints: ExtendedConstraintSet = {};

        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          advancedConstraints.focusMode = 'continuous';
        }
        if (capabilities.imageStabilization) {
          advancedConstraints.imageStabilization = true;
        }
        
        try {
          if (Object.keys(advancedConstraints).length > 0) {
            await track.applyConstraints({ advanced: [advancedConstraints] });
          }
        } catch (e) {
          console.warn("Could not apply advanced camera constraints", e);
        }

        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // Zoom Logic
        if (track && 'zoom' in capabilities) {
          setHasZoom(true);
          const zoomCaps = capabilities.zoom as { min: number; max: number };
          const min = zoomCaps.min;
          setMinZoom(min);
          const initialZoom = min < 1 ? min : 1;
          setZoomLevel(initialZoom);
          try {
            await track.applyConstraints({ advanced: [{ zoom: initialZoom }] as ExtendedConstraintSet[] });
          } catch (e) { console.warn("Zoom constraint failed", e); }
        }
      } catch (err) {
        console.error(err);
        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          setCameraError("denied");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setCameraError("not-found");
        } else if (name === "NotReadableError" || name === "AbortError") {
          setCameraError("in-use");
        } else {
          setCameraError("unknown");
        }
      }
  }, []);

  useEffect(() => {
    initCamera();

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      window.speechSynthesis.cancel();
    };
  }, [initCamera]);

  // --- Controls ---
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    
    const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1") 
      ? "video/mp4;codecs=avc1" 
      : "video/webm";
    
    const recorder = new MediaRecorder(streamRef.current, { 
      mimeType, 
      videoBitsPerSecond: 15000000 
    });

    recorder.ondataavailable = (e) => { 
      if (e.data.size > 0) chunksRef.current.push(e.data); 
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType.split(';')[0] });
      onRecordingComplete(blob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000); 
    setStatus("recording");
    
    speak("Recording started. Hold at chest level and circle the object.");
  };

  const togglePause = () => {
    if (status === "recording") {
      mediaRecorderRef.current?.pause();
      setStatus("paused");
      speak("Paused");
    } else if (status === "paused") {
      mediaRecorderRef.current?.resume();
      setStatus("recording");
      speak("Resuming");
    }
  };

  const toggleZoom = async () => {
    if (!streamRef.current || !hasZoom) return;
    const track = streamRef.current.getVideoTracks()[0];
    
    let targetZoom = 1;
    if (minZoom < 1) {
       targetZoom = zoomLevel === 1 ? minZoom : 1; 
    } else {
       targetZoom = zoomLevel === 1 ? 2 : 1;
    }

    try {
      await track.applyConstraints({ advanced: [{ zoom: targetZoom }] as ExtendedConstraintSet[] });
      setZoomLevel(targetZoom);
    } catch (e) { console.error("Zoom failed", e); }
  };

  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
  };

  const finishRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    setStatus("finished");
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    speak("Recording complete.");
  }, [speak]);

  // --- Timer Loop (UPDATED) ---
  useEffect(() => {
    if (status !== "recording") return;

    const interval = setInterval(() => {
      setElapsed((prev) => {
        const nextTime = prev + 1;

        // HELPER: Change phase and trigger blink/voice
        const changePhase = (idx: number, message: string) => {
          setCurrentPhaseIdx(idx); 
          
          // Trigger Flash (screen)
          triggerFlash();
          
          // Trigger Title Blink (2 seconds)
          setPhaseHighlight(true);
          setTimeout(() => setPhaseHighlight(false), 2000);

          if (navigator.vibrate) navigator.vibrate(200);
          speak(message);
        };

        if (nextTime === ANGLE_DURATION) {
          changePhase(1, "Switch to Top Angle. Raise phone high and tilt down.");
        } 
        else if (nextTime === ANGLE_DURATION * 2) {
          changePhase(2, "Switch to Bottom Angle. Lower phone and tilt up.");
        }
        else if (nextTime === ANGLE_DURATION * 3) {
          changePhase(3, "Switch to Detail Capture. Get close and pan across textures.");
        }
        else if (nextTime >= TOTAL_DURATION) {
          clearInterval(interval);
          finishRecording();
          return nextTime;
        }

        return nextTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, speak, finishRecording]);

  const currentPhase = PHASES[currentPhaseIdx];

  // --- Camera blocked / unavailable ---
  if (cameraError) {
    return <CameraPermissionError errorType={cameraError} onRetry={initCamera} />;
  }

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-black overflow-hidden select-none" style={{ touchAction: 'none' }}>
      
      {/* 1. Countdown Overlay */}
      {status === "countdown" && (
        <CountdownOverlay onComplete={startRecording} />
      )}

      {/* 2. Flash Overlay */}
      {flash && <div className="absolute inset-0 bg-white/50 z-50 pointer-events-none animate-out fade-out duration-300" />}

      {/* 3. Orientation Warning */}
      {!isLandscape && (
        <div className="absolute inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center text-white gap-4">
          <RotateCw className="w-12 h-12 animate-spin" />
          <p className="text-sm uppercase tracking-wider">Rotate to start the 3D scanning.</p>
        </div>
      )}

      {/* 4. Video Viewfinder */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="absolute inset-0 w-full h-full object-cover scale-[1.01]" 
      />

      {/* 5. Active UI */}
      {(status === "recording" || status === "paused") && (
        <>
          {/* --- TOP LEFT: REC INDICATOR --- */}
          <div className="absolute top-6 left-6 z-20 flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
            <div className={cn("w-3 h-3 rounded-full bg-red-500", status === "recording" && "animate-pulse")} />
            <span className="text-white text-xs font-mono font-medium">REC</span>
          </div>

          {/* --- TOP CENTER: INSTRUCTIONS (UPDATED WITH BLINK) --- */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[80%] max-w-md pointer-events-none">
            <div className={cn(
              "backdrop-blur-md border rounded-xl p-3 text-center shadow-lg transition-all duration-300",
              // BLINK LOGIC: Changes background, border, and adds pulsing animation
              phaseHighlight 
                ? "bg-yellow-500/40 border-yellow-400 scale-105 animate-pulse" 
                : "bg-black/40 border-white/10"
            )}>
              <h2 className={cn(
                "text-lg font-bold mb-0.5 uppercase tracking-wider transition-colors",
                // Text Color change on highlight
                phaseHighlight ? "text-yellow-300" : "text-primary"
              )}>
                {currentPhase.label}
              </h2>
              <p className="text-white/90 text-sm font-medium leading-tight">
                {currentPhase.instruction}
              </p>
            </div>
          </div>

          {/* --- RIGHT SIDE: CONTROLS STACK --- */}
          <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-6">
            
            {/* ZOOM BUTTON */}
            {hasZoom && (
              <button
                onClick={toggleZoom}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/20 text-white font-bold text-xs shadow-lg active:scale-95 transition-all hover:bg-black/70"
              >
                {zoomLevel}x
              </button>
            )}

            {/* PLAY/PAUSE BUTTON */}
            <button
              onClick={togglePause}
              className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-4 shadow-xl transition-all active:scale-95 backdrop-blur-sm",
                status === "recording" 
                  ? "bg-white/90 border-white hover:bg-white text-black" 
                  : "bg-red-500/90 border-red-500 hover:bg-red-500 text-white"
              )}
            >
              {status === "recording" ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </button>

            {/* FINISH (STOP) BUTTON — lets the user end early */}
            <button
              onClick={finishRecording}
              aria-label="Finish recording"
              className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/20 text-white shadow-lg active:scale-95 transition-all hover:bg-black/70"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          </div>

          {/* --- BOTTOM AREA CONTAINER --- */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none">
            <div className="relative flex items-end justify-center w-full">

              {/* CENTER: TIMER & PROGRESS & ANGLES */}
              <div className="flex flex-col items-center w-full max-w-md gap-4 pointer-events-auto">
                
                {/* Timer */}
                <div className="text-white font-mono text-4xl font-bold tracking-tight drop-shadow-lg">
                  {formatTime(elapsed)}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div 
                    className={cn(
                      "h-full transition-all ease-linear",
                      status === "paused" ? "bg-yellow-500" : "bg-primary"
                    )}
                    style={{ 
                      width: `${(elapsed / TOTAL_DURATION) * 100}%`,
                      transitionDuration: '1s'
                    }}
                  />
                </div>

                {/* Angle Indicators */}
                <div className="flex items-center gap-6 mt-1">
                  {PHASES.map((phase, index) => {
                    const isActive = index === currentPhaseIdx;
                    const isCompleted = index < currentPhaseIdx;

                    return (
                      <div key={phase.id} className="flex flex-col items-center gap-1.5">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                          isCompleted ? "bg-green-500 border-green-500" :
                          isActive ? "bg-white text-black border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]" :
                          "bg-black/40 border-white/30 text-white/50"
                        )}>
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          ) : (
                            <span className="text-xs font-bold">{index + 1}</span>
                          )}
                        </div>
                        <span className={cn(
                          "text-[10px] uppercase font-bold tracking-wider transition-colors",
                          isActive ? "text-white" : "text-white/40"
                        )}>
                          {phase.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
};