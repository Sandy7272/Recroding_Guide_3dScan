import { useRef, useState, useEffect, useCallback } from "react";
import { formatTime } from "@/utils/formatTime";
import { RotateCw, CheckCircle2, Pause, Play, Square, Volume2, VolumeX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountdownOverlay } from "./capture/CountdownOverlay";
import CameraPermissionError from "./capture/CameraPermissionError";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useSpeech } from "@/hooks/useSpeech";
import { useMuted, usePrefersReducedMotion } from "@/hooks/usePrefs";
import { isIOS } from "@/lib/viewport";

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
// Seconds of warning before an angle switch, so the user isn't caught mid-stride.
const HEADS_UP_SECONDS = 5;

const PHASES = [
  { id: 1, label: "Middle", instruction: "Hold phone at chest height. Walk around object." },
  { id: 2, label: "Top", instruction: "Raise the phone and Tilt it downwards 45°" },
  { id: 3, label: "Bottom", instruction: "Lower phone and Tilt it upwards 45°." },
  { id: 4, label: "Detail", instruction: "Get close. Pan slowly across textures." },
];

const PHASE_CUES = [
  "",
  "Switch to Top Angle. Raise phone high and tilt down.",
  "Switch to Bottom Angle. Lower phone and tilt up.",
  "Switch to Detail Capture. Get close and pan across textures.",
];

interface CameraRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  /** Recording shorter than this is rejected downstream, so we gate the stop button on it. */
  minSeconds: number;
}

export const CameraRecorder = ({ onRecordingComplete, minSeconds }: CameraRecorderProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const completedRef = useRef(false);

  // Flow State
  const [status, setStatus] = useState<"initializing" | "countdown" | "recording" | "paused" | "finished">(
    "initializing"
  );
  const [elapsed, setElapsed] = useState(0);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [flash, setFlash] = useState(false);
  const [phaseHighlight, setPhaseHighlight] = useState(false);
  // Counts down 5..1 just before an angle switch; null the rest of the time.
  const [headsUp, setHeadsUp] = useState<number | null>(null);
  const [autoPausedReason, setAutoPausedReason] = useState<string | null>(null);

  // Zoom State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hasZoom, setHasZoom] = useState(false);
  const [minZoom, setMinZoom] = useState(1);

  // Camera permission / hardware error
  const [cameraError, setCameraError] = useState<CameraErrorType | null>(null);

  const [isPortrait, setIsPortrait] = useState(() => window.innerHeight > window.innerWidth);

  const { speak, cancel: cancelSpeech } = useSpeech();
  const [muted, setMuted] = useMuted();
  const reducedMotion = usePrefersReducedMotion();

  const isRecording = status === "recording";
  const isActive = isRecording || status === "paused";

  // Keep the screen awake for the whole capture, including while paused.
  useWakeLock(isActive);

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
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

      if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
        advancedConstraints.focusMode = "continuous";
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
      if (track && "zoom" in capabilities) {
        setHasZoom(true);
        const zoomCaps = capabilities.zoom as { min: number; max: number };
        const min = zoomCaps.min;
        setMinZoom(min);
        const initialZoom = min < 1 ? min : 1;
        setZoomLevel(initialZoom);
        try {
          await track.applyConstraints({ advanced: [{ zoom: initialZoom }] as ExtendedConstraintSet[] });
        } catch (e) {
          console.warn("Zoom constraint failed", e);
        }
      }

      // Only now is it safe to start the countdown — starting it while the
      // permission prompt is still up used to strand the user on a dead screen.
      setStatus("countdown");
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
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      window.speechSynthesis?.cancel();
    };
  }, [initCamera]);

  // --- Controls ---
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
      ? "video/mp4;codecs=avc1"
      : "video/webm";

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      // 15 Mbps produced ~225 MB in memory for a full scan, which OOMs
      // mid-range Android. 10 Mbps is visually equivalent for photogrammetry.
      videoBitsPerSecond: 10_000_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      const blob = new Blob(chunksRef.current, { type: mimeType.split(";")[0] });
      onRecordingComplete(blob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setStatus("recording");

    speak("Recording started. Hold at chest level and circle the object.");
  }, [onRecordingComplete, speak]);

  const pause = useCallback(
    (reason: string | null) => {
      if (mediaRecorderRef.current?.state !== "recording") return;
      mediaRecorderRef.current.pause();
      setStatus("paused");
      setAutoPausedReason(reason);
      if (!reason) speak("Paused");
    },
    [speak]
  );

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "paused") return;
    mediaRecorderRef.current.resume();
    setStatus("recording");
    setAutoPausedReason(null);
    speak("Resuming");
  }, [speak]);

  const togglePause = () => {
    if (status === "recording") pause(null);
    else if (status === "paused") resume();
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
    } catch (e) {
      console.error("Zoom failed", e);
    }
  };

  const finishRecording = useCallback(() => {
    cancelSpeech();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setStatus("finished");
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    speak("Recording complete.");
  }, [cancelSpeech, speak]);

  // Auto-pause when the tab is backgrounded (call, app switch) or the phone is
  // rotated to portrait — otherwise we bank footage the user can't see.
  useEffect(() => {
    if (!isRecording) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") pause("Recording paused — you left the app");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [isRecording, pause]);

  useEffect(() => {
    if (isRecording && isPortrait) pause("Recording paused — rotate back to landscape");
  }, [isRecording, isPortrait, pause]);

  // --- Timer Loop: tick only, no side effects in the updater ---
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(
      () => setElapsed((prev) => Math.min(TOTAL_DURATION, prev + 1)),
      1000
    );
    return () => clearInterval(interval);
  }, [isRecording]);

  // --- React to the clock: phase switches, heads-up cues, completion ---
  useEffect(() => {
    if (!isRecording || elapsed === 0) return;

    if (elapsed >= TOTAL_DURATION) {
      finishRecording();
      return;
    }

    const boundary = elapsed / ANGLE_DURATION;
    if (Number.isInteger(boundary) && boundary < PHASES.length) {
      setHeadsUp(null);
      setCurrentPhaseIdx(boundary);
      if (!reducedMotion) setFlash(true);
      setPhaseHighlight(true);
      if (navigator.vibrate) navigator.vibrate(200);
      speak(PHASE_CUES[boundary]);
      return;
    }

    const untilSwitch = ANGLE_DURATION - (elapsed % ANGLE_DURATION);
    const nextPhase = Math.floor(elapsed / ANGLE_DURATION) + 1;
    if (untilSwitch <= HEADS_UP_SECONDS && nextPhase < PHASES.length) {
      setHeadsUp(untilSwitch);
      if (untilSwitch === HEADS_UP_SECONDS) {
        speak(`${PHASES[nextPhase].label} angle in ${HEADS_UP_SECONDS} seconds`);
      }
    } else {
      setHeadsUp(null);
    }
  }, [elapsed, isRecording, speak, finishRecording, reducedMotion]);

  // Self-clearing transient effects for the phase switch.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 300);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!phaseHighlight) return;
    const t = setTimeout(() => setPhaseHighlight(false), 2000);
    return () => clearTimeout(t);
  }, [phaseHighlight]);

  const currentPhase = PHASES[currentPhaseIdx];
  const canFinish = elapsed >= minSeconds;
  const secondsShort = Math.max(0, Math.ceil(minSeconds - elapsed));

  // --- Camera blocked / unavailable ---
  if (cameraError) {
    return <CameraPermissionError errorType={cameraError} onRetry={initCamera} />;
  }

  return (
    <div
      className="fixed inset-0 w-full h-[100dvh] bg-black overflow-hidden select-none"
      style={{ touchAction: "none" }}
    >
      {/* 1. Waiting for camera permission / hardware */}
      {status === "initializing" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black text-white">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-white/70">Starting camera…</p>
          <p className="text-xs text-white/40">Allow camera access to continue</p>
        </div>
      )}

      {/* 2. Countdown Overlay — only once the stream is live */}
      {status === "countdown" && <CountdownOverlay onComplete={startRecording} />}

      {/* 3. Flash Overlay */}
      {flash && (
        <div className="absolute inset-0 bg-white/50 z-50 pointer-events-none animate-out fade-out duration-300" />
      )}

      {/* 4. Orientation Warning */}
      {isPortrait && (
        <div className="absolute inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center text-white gap-4 px-8 text-center">
          <RotateCw className={cn("w-12 h-12", !reducedMotion && "animate-spin")} />
          <p className="text-base font-semibold">Rotate your phone to landscape</p>
          <p className="text-sm text-white/60">
            {isIOS()
              ? "Swipe down from the top-right corner and turn off Portrait Orientation Lock."
              : "Make sure auto-rotate is enabled in your quick settings."}
          </p>
          {status === "paused" && <p className="text-xs text-primary">Your recording is paused and safe.</p>}
        </div>
      )}

      {/* 5. Video Viewfinder */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover scale-[1.01]"
      />

      {/* 6. Active UI */}
      {isActive && (
        <>
          {/* --- TOP LEFT: REC INDICATOR --- */}
          <div
            className={cn(
              "absolute top-6 left-6 z-20 flex items-center gap-2 backdrop-blur-sm px-3 py-1 rounded-full border",
              isRecording ? "bg-black/30 border-white/10" : "bg-amber-500/20 border-amber-400/50"
            )}
          >
            <div
              className={cn(
                "w-3 h-3 rounded-full",
                isRecording ? "bg-red-500" : "bg-amber-400",
                isRecording && !reducedMotion && "animate-pulse"
              )}
            />
            <span className="text-white text-xs font-mono font-medium">{isRecording ? "REC" : "PAUSED"}</span>
          </div>

          {/* --- TOP CENTER: INSTRUCTIONS --- */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[80%] max-w-md pointer-events-none">
            <div
              className={cn(
                "backdrop-blur-md border rounded-xl p-3 text-center shadow-lg transition-all duration-300",
                phaseHighlight
                  ? cn("bg-yellow-500/40 border-yellow-400 scale-105", !reducedMotion && "animate-pulse")
                  : "bg-black/40 border-white/10"
              )}
              aria-live="assertive"
            >
              <h2
                className={cn(
                  "text-lg font-bold mb-0.5 uppercase tracking-wider transition-colors",
                  phaseHighlight ? "text-yellow-300" : "text-primary"
                )}
              >
                {currentPhase.label}
              </h2>
              <p className="text-white/90 text-sm font-medium leading-tight">{currentPhase.instruction}</p>
            </div>

            {/* Heads-up before the angle switches */}
            {headsUp !== null && isRecording && (
              <div className="mt-2 mx-auto w-fit rounded-full bg-yellow-400 px-4 py-1 text-xs font-bold uppercase tracking-wider text-black shadow-lg">
                {PHASES[currentPhaseIdx + 1]?.label} angle in {headsUp}…
              </div>
            )}
          </div>

          {/* --- AUTO-PAUSE NOTICE --- */}
          {status === "paused" && autoPausedReason && !isPortrait && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 rounded-xl bg-black/80 backdrop-blur-md border border-amber-400/40 px-5 py-4 text-center">
              <p className="text-sm font-semibold text-amber-300">{autoPausedReason}</p>
              <button
                onClick={resume}
                className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                Resume
              </button>
            </div>
          )}

          {/* --- RIGHT SIDE: CONTROLS STACK --- */}
          <div className="fixed right-8 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-5">
            {/* MUTE */}
            <button
              onClick={() => setMuted(!muted)}
              aria-label={muted ? "Unmute voice guidance" : "Mute voice guidance"}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/20 text-white shadow-lg active:scale-95 transition-all hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-primary"
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* ZOOM */}
            {hasZoom && (
              <button
                onClick={toggleZoom}
                aria-label={`Zoom, currently ${zoomLevel}x`}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/20 text-white font-bold text-xs shadow-lg active:scale-95 transition-all hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-primary"
              >
                {Number(zoomLevel.toFixed(1))}x
              </button>
            )}

            {/* PLAY/PAUSE */}
            <button
              onClick={togglePause}
              aria-label={isRecording ? "Pause recording" : "Resume recording"}
              className={cn(
                "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-4 shadow-xl transition-all active:scale-95 backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-primary",
                isRecording
                  ? "bg-white/90 border-white hover:bg-white text-black"
                  : "bg-red-500/90 border-red-500 hover:bg-red-500 text-white"
              )}
            >
              {isRecording ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </button>

            {/* FINISH — locked until the recording is long enough to pass the check */}
            <button
              onClick={finishRecording}
              disabled={!canFinish}
              aria-label={canFinish ? "Finish recording" : `Finish available in ${secondsShort} seconds`}
              title={canFinish ? "Finish recording" : `${secondsShort}s more needed`}
              className={cn(
                "w-12 h-12 rounded-full flex flex-col items-center justify-center backdrop-blur-md border shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-primary",
                canFinish
                  ? "bg-black/50 border-white/20 text-white active:scale-95 hover:bg-black/70"
                  : "bg-black/30 border-white/10 text-white/35 cursor-not-allowed"
              )}
            >
              {canFinish ? (
                <Square className="w-5 h-5 fill-current" />
              ) : (
                <span className="text-[10px] font-bold tabular-nums">{secondsShort}s</span>
              )}
            </button>
          </div>

          {/* --- BOTTOM AREA CONTAINER --- */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none">
            <div className="relative flex items-end justify-center w-full">
              <div className="flex flex-col items-center w-full max-w-md gap-4 pointer-events-auto">
                {/* Timer */}
                <div className="text-white font-mono text-4xl font-bold tracking-tight drop-shadow-lg">
                  {formatTime(elapsed)}
                  <span className="text-lg text-white/50"> / {formatTime(TOTAL_DURATION)}</span>
                </div>

                {/* Segmented progress — one bar per angle, so the user can see
                    how much is left in the *current* angle, not just overall. */}
                <div className="flex w-full gap-1.5">
                  {PHASES.map((phase, i) => {
                    const segStart = i * ANGLE_DURATION;
                    const pct = Math.min(100, Math.max(0, ((elapsed - segStart) / ANGLE_DURATION) * 100));
                    return (
                      <div
                        key={phase.id}
                        className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm"
                      >
                        <div
                          className={cn(
                            "h-full transition-all ease-linear",
                            status === "paused" ? "bg-amber-400" : "bg-primary"
                          )}
                          style={{ width: `${pct}%`, transitionDuration: "1s" }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Angle Indicators */}
                <div className="flex items-center gap-6 mt-1">
                  {PHASES.map((phase, index) => {
                    const isActivePhase = index === currentPhaseIdx;
                    const isCompleted = index < currentPhaseIdx;

                    return (
                      <div key={phase.id} className="flex flex-col items-center gap-1.5">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                            isCompleted
                              ? "bg-green-500 border-green-500"
                              : isActivePhase
                                ? "bg-white text-black border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                : "bg-black/40 border-white/30 text-white/60"
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          ) : (
                            <span className="text-xs font-bold">{index + 1}</span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[11px] uppercase font-bold tracking-wider transition-colors",
                            isActivePhase ? "text-white" : "text-white/70"
                          )}
                        >
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
