import { FC, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Volume2, VolumeX, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";
import { useMuted } from "@/hooks/usePrefs";
import { cn } from "@/lib/utils";

// Video Imports
import middleVideo from "../../asset/middle.webm";
import topVideo from "../../asset/top.webm";
import bottomVideo from "../../asset/bottom.webm";
import detailcapture from "../../asset/detailcapture.webm";

const angleOrder = ["middle", "top", "bottom", "detail"] as const;

interface AngleGifTutorialProps {
  angle: (typeof angleOrder)[number];
  onNext: () => void;
  onPrev: () => void;
  onSkipAll: () => void;
}

const angleData = {
  middle: {
    title: "Middle Angle",
    subtitle: "Camera at Chest Level",
    video: middleVideo,
    speak: "This is the middle angle. Hold your phone at chest height and move around the object slowly.",
    lines: ["Hold chest height", "Move in full circle", "Keep object centered"],
  },
  top: {
    title: "Top Angle",
    subtitle: "Camera Above Object",
    video: topVideo,
    speak: "This is the top angle. Hold your phone above the object at a downward angle and move in a full circle.",
    lines: ["Raise phone above object", "Tilt 45° down", "Walk full circle"],
  },
  bottom: {
    title: "Bottom Angle",
    subtitle: "Camera Below Object",
    video: bottomVideo,
    speak: "This is the bottom angle. Hold your phone low and tilt upward while moving around the object.",
    lines: ["Phone lower than object", "Tilt 45° up", "Walk full circle"],
  },
  detail: {
    title: "Detail Capture",
    subtitle: "Close-up Details",
    video: detailcapture,
    speak: "This is the detail capture. Get close to the object and slowly pan across interesting features and textures.",
    lines: ["Get close to the surface", "Focus on textures & details", "Move slowly across surface"],
  },
};

/** Suggested dwell time. Advisory only — Next is always available. */
const SUGGESTED_SECONDS = 8;

const AngleGifTutorial: FC<AngleGifTutorialProps> = ({ angle, onNext, onPrev, onSkipAll }) => {
  const navigate = useNavigate();
  const step = angleOrder.indexOf(angle);
  const data = angleData[angle];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { speak, cancel } = useSpeech();
  const [muted, setMuted] = useMuted();

  const [videoLoaded, setVideoLoaded] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SUGGESTED_SECONDS);

  useEffect(() => {
    setVideoLoaded(false);
    setTimeLeft(SUGGESTED_SECONDS);
    videoRef.current?.load();

    const audioTimer = setTimeout(() => speak(data.speak), 300);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(audioTimer);
      clearInterval(interval);
      cancel();
    };
  }, [step, data.speak, speak, cancel]);

  const isLast = step === angleOrder.length - 1;

  return (
    <div className="w-full h-[100dvh] bg-[#0A0A0A] text-white flex flex-col md:flex-row overflow-hidden font-sans">
      {/* TOP (mobile) / LEFT (desktop): PREVIEW */}
      <div className="w-full md:w-[60%] flex-1 md:flex-none md:h-full flex justify-center items-center p-3 md:px-4 bg-[#050505] min-h-0">
        <div className="relative w-full max-w-2xl aspect-video rounded-2xl bg-gradient-to-br from-[#111] to-[#0A0A0A] border border-[#222] shadow-2xl overflow-hidden">
          {!videoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#2DFFA7]" />
            </div>
          )}
          <video
            ref={videoRef}
            key={data.video}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onLoadedData={() => setVideoLoaded(true)}
            onError={() => setVideoLoaded(true)}
            className={cn(
              "w-full h-full object-contain transition-opacity duration-500",
              videoLoaded ? "opacity-100" : "opacity-0"
            )}
          >
            <source src={data.video} type="video/webm" />
            {/* Safari below 17.4 can't play WebM — the written steps on the
                right remain the fallback if no source decodes. */}
          </video>
        </div>
      </div>

      {/* BOTTOM (mobile) / RIGHT (desktop): UI PANEL */}
      <div className="w-full md:w-[40%] shrink-0 bg-[#0A0A0A] border-t md:border-t-0 md:border-l border-[#222] px-5 py-5 md:py-6 flex flex-col justify-center relative">
        {/* PROGRESS BAR */}
        <div className="flex gap-1.5 mb-6">
          {angleOrder.map((name, i) => (
            <div
              key={name}
              className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-[#2DFFA7]" : "bg-[#2A2A2A]")}
            />
          ))}
        </div>

        {/* HEADER */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => (step > 0 ? onPrev() : navigate(-1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#999] transition-colors hover:bg-[#161616] hover:text-white focus-visible:ring-2 focus-visible:ring-[#2DFFA7]"
              aria-label={step > 0 ? "Previous angle" : "Back"}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md bg-[#2DFFA7]/10 border border-[#2DFFA7]/20 text-[#2DFFA7] text-[11px] font-bold tracking-wide uppercase">
              Step {step + 1} of {angleOrder.length}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onSkipAll}
              className="h-11 rounded-full px-3 text-xs font-semibold text-[#999] transition-colors hover:bg-[#161616] hover:text-white focus-visible:ring-2 focus-visible:ring-[#2DFFA7]"
            >
              Skip all
            </button>
            <button
              onClick={() => setMuted(!muted)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#999] transition-colors hover:bg-[#161616] hover:text-white focus-visible:ring-2 focus-visible:ring-[#2DFFA7]"
              aria-label={muted ? "Unmute voice guidance" : "Mute voice guidance"}
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">{data.title}</h1>
          <p className="text-sm text-[#9A9A9A] mb-5 font-medium">{data.subtitle}</p>

          <div className="space-y-3 pl-1">
            {data.lines.map((line, i) => (
              <div key={i} className="flex items-center gap-3 text-[#CFCFCF]">
                <div className="w-1 h-1 bg-[#666] rounded-full" />
                <p className="text-sm">{line}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ACTIONS — Next is always enabled; the timer is a hint, not a gate. */}
        <div className="mt-auto">
          <button
            onClick={onNext}
            className="w-full h-12 bg-[#2DFFA7] text-black font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-[#28e596] active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(45,255,167,0.1)] text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] focus-visible:ring-[#2DFFA7]"
          >
            {isLast ? "Start Recording" : "Next Angle"}
            <ChevronRight className="w-4 h-4" />
          </button>
          <p className="mt-2 h-4 text-center text-[11px] tabular-nums text-[#777]">
            {timeLeft > 0 ? `Take ${timeLeft}s to watch, or continue now` : ""}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AngleGifTutorial;
