import { useEffect, useRef } from 'react';

interface UseProctoringProps {
  active: boolean;
  onCheatFlag: (flag: string) => void;
  onAutoSubmit: (reason: string) => void;
}

export function useProctoring({ active, onCheatFlag, onAutoSubmit }: UseProctoringProps) {
  const exitFullscreenCount = useRef(0);
  const isSubmitting = useRef(false);

  useEffect(() => {
    if (!active) return;

    // 1. Enter Fullscreen on Start
    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn('Failed to enter fullscreen mode automatically:', err);
        onCheatFlag('Failed to auto-enter Fullscreen (Permission Blocked)');
      }
    };

    enterFullscreen();

    // 2. Fullscreen Change Listener
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isSubmitting.current) {
        exitFullscreenCount.current += 1;
        
        if (exitFullscreenCount.current === 1) {
          onCheatFlag(`Exited Fullscreen (Warning 1/2) at ${new Date().toLocaleTimeString()}`);
          alert('WARNING: You have exited Fullscreen mode! Exiting again will auto-submit your quiz.');
          
          // Try to re-enter fullscreen
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (exitFullscreenCount.current >= 2) {
          isSubmitting.current = true;
          onCheatFlag(`Exited Fullscreen Second Time - Auto Submitted at ${new Date().toLocaleTimeString()}`);
          onAutoSubmit('Fullscreen Exit Violation');
        }
      }
    };

    // 3. Visibility Change Listener (Tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        onCheatFlag(`Tab Switched (Visibility Hidden) at ${new Date().toLocaleTimeString()}`);
      }
    };

    // 4. Window Blur Listener
    const handleWindowBlur = () => {
      onCheatFlag(`Window Focus Lost (Alt-Tab/Exited App Window) at ${new Date().toLocaleTimeString()}`);
    };

    // 5. Keyboard Shortcut Restrictions (Copy, Paste, Cut, DevTools)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCopy = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c';
      const isPaste = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v';
      const isCut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x';
      
      // DevTools keys: F12, Ctrl+Shift+I, Cmd+Opt+I
      const isF12 = e.key === 'F12';
      const isInspect = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i';
      const isInspectMac = (e.metaKey && e.altKey && e.key.toLowerCase() === 'i');

      if (isCopy || isPaste || isCut || isF12 || isInspect || isInspectMac) {
        e.preventDefault();
        let action = 'Keyboard Shortcut Restricted';
        if (isCopy) action = 'Attempted Copy (Ctrl+C)';
        if (isPaste) action = 'Attempted Paste (Ctrl+V)';
        if (isCut) action = 'Attempted Cut (Ctrl+X)';
        if (isF12 || isInspect || isInspectMac) action = 'Attempted Inspect Element (DevTools)';
        
        onCheatFlag(`${action} at ${new Date().toLocaleTimeString()}`);
      }
    };

    // 6. Context Menu Prevention (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onCheatFlag(`Attempted Right Click (Context Menu Disabled) at ${new Date().toLocaleTimeString()}`);
    };

    // Register all listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      // Cleanup
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);

      // Exit Fullscreen when unmounting
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [active, onCheatFlag, onAutoSubmit]);

  return {
    exitCount: exitFullscreenCount.current
  };
}
