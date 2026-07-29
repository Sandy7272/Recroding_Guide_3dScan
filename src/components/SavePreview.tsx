import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, RotateCcw, CheckCircle, Share2, Home } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SavePreviewProps {
  videoBlob: Blob;
  onBack: () => void;
  onDone: () => void;
}

/** MediaRecorder falls back to WebM when MP4 isn't supported — don't mislabel it. */
const extensionFor = (type: string) => (type.includes("mp4") ? "mp4" : "webm");

export const SavePreview = ({ videoBlob, onBack, onDone }: SavePreviewProps) => {
  const videoUrl = useMemo(() => URL.createObjectURL(videoBlob), [videoBlob]);
  const [isSaved, setIsSaved] = useState(false);

  // A full scan is ~150 MB; leaking this URL pins it for the life of the tab.
  useEffect(() => () => URL.revokeObjectURL(videoUrl), [videoUrl]);

  const fileName = `3d-capture-scan-${Date.now()}.${extensionFor(videoBlob.type)}`;

  const file = useMemo(
    () => new File([videoBlob], fileName, { type: videoBlob.type || "video/mp4" }),
    [videoBlob, fileName]
  );

  // Sharing is the only route to the Photos app on iOS — a blob download there
  // either opens the file or fails silently, it never saves to the gallery.
  const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const handleShare = async () => {
    try {
      await navigator.share({ files: [file], title: "3D Scan" });
      setIsSaved(true);
      toast.success("Scan shared");
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      toast.error("Couldn't open the share sheet. Try Download instead.");
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setIsSaved(true);
    toast.success(`Downloaded ${fileName}`);
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col h-[100dvh] w-full">
      {/* FULL SCREEN VIDEO PREVIEW */}
      <div className="flex-1 relative w-full min-h-0 bg-black">
        <video
          src={videoUrl}
          autoPlay
          loop
          playsInline
          muted
          controls
          className="w-full h-full object-contain"
        />

        {/* TOP OVERLAY: TITLE */}
        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md text-white px-6 py-2 rounded-full text-sm font-semibold border border-white/10 shadow-lg">
            Preview Scan
          </div>
        </div>

        {/* TOP RIGHT: HOME */}
        <button
          onClick={onDone}
          aria-label="Finish and return home"
          className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Home className="w-5 h-5" />
        </button>
      </div>

      {/* BOTTOM BAR — in normal flow so it never covers the native video controls */}
      <div className="shrink-0 bg-black px-6 pb-6 pt-4 border-t border-white/10">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex-1 h-14 bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 hover:text-white rounded-xl text-base font-semibold transition-all active:scale-95"
          >
            <RotateCcw className="mr-2 w-5 h-5" /> Retake
          </Button>

          <Button
            onClick={canShare ? handleShare : handleDownload}
            className={cn(
              "flex-1 h-14 text-base font-bold rounded-xl transition-all active:scale-95 shadow-lg",
              isSaved
                ? "bg-zinc-800 text-green-400 hover:bg-zinc-800 border border-green-500/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isSaved ? (
              <>
                <CheckCircle className="mr-2 w-5 h-5" /> Saved
              </>
            ) : canShare ? (
              <>
                <Share2 className="mr-2 w-5 h-5" /> Save to Photos
              </>
            ) : (
              <>
                <Download className="mr-2 w-5 h-5" /> Download
              </>
            )}
          </Button>
        </div>

        {isSaved && (
          <div className="mx-auto mt-3 flex max-w-lg gap-3">
            <Button
              variant="ghost"
              onClick={onDone}
              className="flex-1 h-11 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              Scan another object
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
