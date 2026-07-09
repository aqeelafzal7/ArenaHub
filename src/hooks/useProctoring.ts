import { useEffect, useRef } from 'react';

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

interface UseProctoringProps {
  active: boolean;
  onCheatFlag: (flag: string) => void;
  onAutoSubmit: (reason: string) => void;
  onShowWarningModal?: (msg: string) => void;
}

export function useProctoring({ active, onCheatFlag, onAutoSubmit, onShowWarningModal }: UseProctoringProps) {
  const exitFullscreenCount = useRef(0);
  const isSubmitting = useRef(false);

  useEffect(() => {
    if (!active) return;

    let timeoutId: NodeJS.Timeout | null = null;

    // Fullscreen Change Listener
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isSubmitting.current) {
        exitFullscreenCount.current += 1;
        
        if (exitFullscreenCount.current === 1) {
          const timestamp = new Date().toLocaleTimeString();
          onCheatFlag(`Exited Fullscreen (Infraction 1/2) at ${timestamp}`);
          if (onShowWarningModal) {
            onShowWarningModal('CRITICAL SECURITY ALERT: Fullscreen Mode Deactivated. You must remain in fullscreen mode. A secondary exit will result in instant auto-submission.');
          } else {
            alert('WARNING: You have exited Fullscreen mode! Exiting again will auto-submit your quiz.');
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } else if (exitFullscreenCount.current >= 2) {
          isSubmitting.current = true;
          const timestamp = new Date().toLocaleTimeString();
          onCheatFlag(`Exited Fullscreen Second Time (Infraction 2/2) - Auto Submitted at ${timestamp}`);
          onAutoSubmit('Fullscreen Exit Violation');
        }
      }
    };

    // If not mobile, initialize fullscreen logic after a grace period of 2500ms
    if (!isMobile) {
      timeoutId = setTimeout(() => {
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
        document.addEventListener('fullscreenchange', handleFullscreenChange);
      }, 2500);
    }

    // 3. Visibility Change Listener (Tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const timestamp = new Date().toLocaleTimeString();
        onCheatFlag(`Tab Switched (Visibility Hidden) at ${timestamp}`);
      }
    };

    // 4. Window Blur Listener
    const handleWindowBlur = () => {
      const timestamp = new Date().toLocaleTimeString();
      onCheatFlag(`Window Focus Lost (Alt-Tab/Exited App Window) at ${timestamp}`);
    };

    // 5. Text Selection Prevention (selectstart)
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      const timestamp = new Date().toLocaleTimeString();
      onCheatFlag(`Attempted Text Selection (SelectStart Blocked) at ${timestamp}`);
    };

    // 6. Keyboard Shortcut Restrictions (Copy, Paste, Cut, DevTools)
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
        
        const timestamp = new Date().toLocaleTimeString();
        onCheatFlag(`${action} at ${timestamp}`);
      }
    };

    // 7. Context Menu Prevention (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const timestamp = new Date().toLocaleTimeString();
      onCheatFlag(`Attempted Right Click (Context Menu Disabled) at ${timestamp}`);
    };

    // Register other listeners immediately
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('selectstart', handleSelectStart);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (!isMobile) {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('selectstart', handleSelectStart);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);

      // Exit Fullscreen when unmounting (only if not mobile)
      if (!isMobile && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [active, onCheatFlag, onAutoSubmit, onShowWarningModal]);

  return {
    exitCount: exitFullscreenCount.current
  };
}
