import { FC, useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Volume2,
  VolumeX,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

// Video Imports
import middleVideo from "../../asset/middle.webm";
import topVideo from "../../asset/top.webm";
import bottomVideo from "../../asset/bottom.webm";
import detailcapture from "../../asset/detailcapture.webm";

interface AngleGifTutorialProps {
  angle: (typeof angleOrder)[number];
  onNext: () => void;
  onPrev: () => void;
}

const angleOrder = ["middle", "top", "bottom", "detail"] as const;

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
    video: detailcapture, // Placeholder - reusing middle video
    speak: "This is the detail capture. Get close to the object and slowly pan across interesting features and textures.",
    lines: ["Capture the instrument cluster and the entire seat.", "Focus on textures & details", "Move slowly across surface"],
  },
};

const AngleGifTutorial: FC<AngleGifTutorialProps> = ({ angle, onNext, onPrev }) => {
  const navigate = useNavigate();
  const step = angleOrder.indexOf(angle);
  const data = angleData[angle];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // Refs for audio management
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voiceRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);

  const [state, setState] = useState<"idle" | "speaking" | "finished">("idle");
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  // FIX 1: Timer changed to 10 seconds
  const [timeLeft, setTimeLeft] = useState(10);

  // Sync mute state ref
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // --- Robust Voice Logic ---
  const speakInstructions = useCallback(() => {
    if (!("speechSynthesis" in window)) return; 

    // 1. Clear any existing speech or retries
    window.speechSynthesis.cancel();
    if (voiceRetryRef.current) clearTimeout(voiceRetryRef.current);

    if (isMutedRef.current) return;

    // 2. Define the speak function
    const trySpeaking = (attempt = 0) => {
      const voices = window.speechSynthesis.getVoices();

      // FIX 2: If voices aren't loaded yet (common on first load), retry every 100ms
      if (voices.length === 0 && attempt < 20) {
        voiceRetryRef.current = setTimeout(() => trySpeaking(attempt + 1), 100);
        return;
      }

      // 3. Create Utterance (only after voices might be ready)
      const msg = new SpeechSynthesisUtterance(data.speak);
      msg.rate = 1.0;
      msg.volume = 1.0;
      
      // Optional: Try to pick a decent English voice if available
      const preferredVoice = voices.find(v => v.lang.includes('en') && !v.name.includes('Google')) || voices[0];
      if (preferredVoice) msg.voice = preferredVoice;

      utteranceRef.current = msg;
      
      msg.onstart = () => setState("speaking");
      // Note: We don't unlock on end, we wait for the 10s timer
      msg.onend = () => {}; 
      msg.onerror = (e) => console.warn("Speech error:", e);

      window.speechSynthesis.speak(msg);
    };

    trySpeaking();

  }, [data.speak]);

  // --- Effect: Step Change Lifecycle ---
  useEffect(() => {
    setVideoLoaded(false);
    setState("speaking");
    setTimeLeft(10); // Reset countdown to 10s
    
    // Reload video
    if (videoRef.current) {
      videoRef.current.load();
    }

    // Force browser to acknowledge audio context
    if ("speechSynthesis" in window) {
        window.speechSynthesis.resume(); 
    }

    // Small delay to ensure component render before speaking
    const audioTimer = setTimeout(() => {
        speakInstructions();
    }, 300);

    // --- 10 SECOND TIMER LOGIC ---
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setState("finished"); // Unlock button at 0
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(audioTimer);
      if (voiceRetryRef.current) clearTimeout(voiceRetryRef.current);
      clearInterval(interval);
      window.speechSynthesis.cancel();
    };
  }, [step, speakInstructions]);

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    
    if (newMuteState) {
      window.speechSynthesis.cancel();
      if (voiceRetryRef.current) clearTimeout(voiceRetryRef.current);
    } else {
        // If unmuting, try to speak immediately
        speakInstructions();
    }
  };

  return (
    <div className="w-full h-[100dvh] bg-[#0A0A0A] text-white flex flex-col md:flex-row overflow-hidden font-sans">

      {/* TOP (mobile) / LEFT (desktop): PREVIEW */}
      <div className="w-full md:w-[60%] flex-1 md:flex-none md:h-full flex justify-center items-center p-3 md:px-4 bg-[#050505] min-h-0">
        <div className="relative w-full max-w-2xl rounded-2xl bg-gradient-to-br from-[#111] to-[#0A0A0A] border border-[#222] shadow-2xl overflow-hidden">
          <video
            ref={videoRef}
            key={data.video} 
            autoPlay
            muted
            loop
            playsInline
            preload="auto" 
            onLoadedData={() => setVideoLoaded(true)}
            className={`
              w-full h-auto
              object-contain transition-opacity duration-500
              ${videoLoaded ? 'opacity-100' : 'opacity-0'} 
            `}
          >
            <source src={data.video} type="video/webm" />
          </video>
        </div>
      </div>

      {/* BOTTOM (mobile) / RIGHT (desktop): UI PANEL */}
      <div className="w-full md:w-[40%] shrink-0 bg-[#0A0A0A] border-t md:border-t-0 md:border-l border-[#222] px-5 py-5 md:py-6 flex flex-col justify-center relative">

        {/* PROGRESS BAR */}
        <div className="flex gap-1.5 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i} 
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-[#2DFFA7]" : "bg-[#222]"
              }`} 
            />
          ))}
        </div>

        {/* HEADER */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (step > 0) {
                  onPrev();
                } else {
                  navigate(-1);
                }
              }} 
              className="text-[#777] hover:text-white transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md bg-[#2DFFA7]/10 border border-[#2DFFA7]/20 text-[#2DFFA7] text-[10px] font-bold tracking-wide uppercase">
              Step {step + 1} of 4
            </div>
          </div>

          <button 
            onClick={toggleMute} 
            className="p-1.5 -mr-1.5 text-[#777] hover:text-white transition-colors rounded-full hover:bg-[#111]"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>

        {/* CONTENT */}
        <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">{data.title}</h1>
            <p className="text-sm text-[#888] mb-5 font-medium">{data.subtitle}</p>

            <div className="space-y-3 pl-1">
            {data.lines.map((line, i) => (
                <div key={i} className="flex items-center gap-3 text-[#BBB]">
                <div className="w-1 h-1 bg-[#444] rounded-full"></div>
                <p className="text-xs sm:text-sm">{line}</p>
                </div>
            ))}
            </div>
        </div>

        {/* ACTIONS */}
        <div className="mt-auto space-y-3">
            
            {state !== "finished" ? (
                // LOADING/WAITING STATE
                <div className="w-full h-12 bg-[#161616] border border-[#222] rounded-lg flex items-center justify-center gap-2 text-[#888]">
                    <div className="animate-pulse flex items-center gap-2">
                      <Volume2 size={16} className="text-[#2DFFA7]" />
                      <span className="text-xs font-medium tabular-nums">
                        Wait {timeLeft}s...
                      </span>
                    </div>
                </div>
            ) : (
                // FINISHED STATE - NEXT BUTTON
                <button
                    onClick={onNext}
                    className="w-full h-12 bg-[#2DFFA7] text-black font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-[#28e596] active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(45,255,167,0.1)] text-sm"
                >
                    {step === 3 ? "Start Recording" : "Next Angle"}
                    <ChevronRight className="w-4 h-4" />
                </button>
            )}
        </div>

      </div>
    </div>
  );
};

export default AngleGifTutorial;