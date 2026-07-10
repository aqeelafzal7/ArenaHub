import { useEffect, useRef } from 'react';

interface ProctoringProps {
  active: boolean;
  onCheatFlag: (flag: string) => void;
  onAutoSubmit: (reason: string) => void;
  onShowWarningModal: (msg: string) => void;
}

export const useProctoring = ({ active, onCheatFlag, onAutoSubmit, onShowWarningModal }: ProctoringProps) => {
  const strikes = useRef(0);

  useEffect(() => {
    if (!active) return;

    const handleInfraction = (type: string) => {
      // 1. Send log to Firestore Admin War Room
      onCheatFlag(type);
      
      // 2. Increment local strike counter
      strikes.current += 1;

      // 3. Trigger appropriate UI response
      if (strikes.current === 1) {
        onShowWarningModal(`Proctoring Alert: ${type}. Please remain on this tab. Further infractions will result in automatic submission.`);
      } else if (strikes.current >= 2) {
        onAutoSubmit(`Multiple Infractions: ${type}`);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleInfraction('Tab Focus Lost');
      }
    };

    const handleBlur = () => {
      handleInfraction('Window Focus Lost');
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    // Attach strict listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      // Cleanup on unmount
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [active, onCheatFlag, onAutoSubmit, onShowWarningModal]);
};
