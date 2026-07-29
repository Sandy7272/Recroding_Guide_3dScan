import { useNavigate } from "react-router-dom";
import { Box, Map, ArrowRight, Lock, RefreshCw } from "lucide-react";
import { enterLandscapeFullscreen } from "@/lib/viewport";
import { useTutorialSeen } from "@/hooks/usePrefs";

import metashopLogo from "@/asset/Metashop_logo.svg";

const Home = () => {
  const navigate = useNavigate();
  const [tutorialSeen, setTutorialSeen] = useTutorialSeen();

  // This tap is the only user gesture we get before the camera flow, and
  // Android needs one to grant fullscreen + the landscape orientation lock.
  const startCapture = async () => {
    await enterLandscapeFullscreen();
    navigate("/object-intro");
  };

  const replayGuide = async () => {
    setTutorialSeen(false);
    await enterLandscapeFullscreen();
    navigate("/object-intro");
  };

  return (
    <div className="relative w-full h-[100dvh] bg-black text-white overflow-hidden font-sans select-none touch-none">
      {/* --- Background Ambience --- */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a1a1a] via-[#050505] to-black pointer-events-none" />

      {/* --- Main Layout: Horizontal Split --- */}
      <div className="relative z-10 w-full h-full flex flex-col sm:flex-row">
        {/* === LEFT SIDE: OBJECT MODE === */}
        <button
          onClick={startCapture}
          className="group relative flex-1 w-full flex flex-col items-center justify-end sm:justify-center border-b sm:border-b-0 sm:border-r border-white/10 active:bg-white/[0.05] transition-all duration-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative z-10 flex flex-col items-center text-center pb-12 sm:pb-0 sm:pr-8">
            <div className="mb-3 p-3 rounded-full bg-neutral-900/50 border border-white/10 group-hover:border-emerald-500/50 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all duration-300 group-hover:scale-110">
              <Box className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
            </div>

            <h2 className="text-lg sm:text-2xl font-bold tracking-widest text-white">Object Mode</h2>
            <span className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-[150px] sm:max-w-none">
              Bikes, furniture, large items
            </span>

            <div className="hidden sm:flex mt-4 items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-500 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
              <span>Start Capture</span> <ArrowRight size={12} />
            </div>
          </div>
        </button>

        {/* === RIGHT SIDE: SCENE MODE (Disabled) === */}
        <div className="relative flex-1 w-full flex flex-col items-center justify-start sm:justify-center sm:border-l border-white/10 bg-black/40">
          <div className="relative z-10 flex flex-col items-center text-center pt-12 sm:pt-0 sm:pl-8 opacity-50">
            <div className="mb-3 p-3 rounded-full bg-neutral-900/50 border border-white/5 grayscale">
              <Map className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-600" />
            </div>

            <h2 className="text-lg sm:text-2xl font-bold tracking-widest text-neutral-400">Scene Mode</h2>
            <span className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-[150px] sm:max-w-none">
              Rooms, outdoors
            </span>

            <div className="mt-3 px-2 py-1 rounded border border-white/10 bg-white/5 flex items-center gap-1.5">
              <Lock size={10} className="text-neutral-400" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* === CENTER LOGO === */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-none">
        <div className="relative bg-black border border-white/20 p-2 sm:p-5 rounded-full shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          <img src={metashopLogo} alt="Metashop" className="w-8 h-8 sm:w-16 sm:h-16 object-contain" />
        </div>
      </div>

      {/* === REPLAY GUIDE === */}
      {tutorialSeen && (
        <button
          onClick={replayGuide}
          className="absolute bottom-4 left-1/2 z-30 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-semibold text-neutral-300 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <RefreshCw size={13} />
          Replay capture guide
        </button>
      )}
    </div>
  );
};

export default Home;
