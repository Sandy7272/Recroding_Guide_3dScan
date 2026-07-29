import { useState, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import InstagramStoryTutorial from "@/components/capture/InstagramStoryTutorial";
import OrientationLock from "@/components/OrientationLock";
import { useTutorialSeen } from "@/hooks/usePrefs";

const ObjectIntro = () => {
  const navigate = useNavigate();
  const [tutorialSeen] = useTutorialSeen();
  // Returning users skip the tips and land straight on the angle guide.
  const [showTutorial, setShowTutorial] = useState(!tutorialSeen);

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
    navigate("/record");
  }, [navigate]);

  // Nothing to show — go straight through.
  if (!showTutorial) return <Navigate to="/record" replace />;

  return (
    <OrientationLock>
      <InstagramStoryTutorial isOpen={showTutorial} onComplete={handleTutorialComplete} />
    </OrientationLock>
  );
};

export default ObjectIntro;
