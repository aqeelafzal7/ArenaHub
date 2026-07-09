import { useEffect } from 'react';

interface UseProctoringProps {
  active: boolean;
  onCheatFlag: (flag: string) => void;
  onAutoSubmit: (reason: string) => void;
  onShowWarningModal?: (msg: string) => void;
}

export function useProctoring({ active, onCheatFlag }: UseProctoringProps) {
  useEffect(() => {
    if (!active) return;

    // 1. Visibility Change Listener (Tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const timestamp = new Date().toLocaleTimeString();
        onCheatFlag(`Tab Switched (Visibility Hidden) at ${timestamp}`);
      }
    };

    // 2. Window Blur Listener
    const handleWindowBlur = () => {
      const timestamp = new Date().toLocaleTimeString();
      onCheatFlag(`Window Focus Lost (Alt-Tab/Exited App Window) at ${timestamp}`);
    };

    // 3. Text Selection Prevention (selectstart)
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      const timestamp = new Date().toLocaleTimeString();
      onCheatFlag(`Attempted Text Selection (SelectStart Blocked) at ${timestamp}`);
    };

    // 4. Keyboard Shortcut Restrictions (Copy, Paste, Cut, DevTools)
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

    // 5. Context Menu Prevention (Right Click)
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('selectstart', handleSelectStart);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [active, onCheatFlag]);

  return {
    exitCount: 0
  };
}
