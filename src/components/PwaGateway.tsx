import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

interface PwaGatewayProps {
  children: React.ReactNode;
}

export const PwaGateway: React.FC<PwaGatewayProps> = ({ children }) => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Check if already in the installed App (Standalone mode)
    const checkStandalone = () => {
      const isApp = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      setIsStandalone(isApp);
    };
    
    checkStandalone();
    
    // Listen for display mode changes (e.g., if they install and switch over)
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

    // 2. Capture the native install prompt event in the browser
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // Stop the mini-infobar
      setDeferredPrompt(e); // Save it for the button click
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("To install, tap your browser's menu (three dots) and select 'Install app' or 'Add to Home screen'.");
      return;
    }

    // Trigger the native OS popup
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // If they are inside the installed App, bypass the gateway entirely
  if (isStandalone) {
    return <>{children}</>;
  }

  // If they are in a normal browser tab, trap them on the install screen
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Download className="w-10 h-10"/>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Secure Installation Required</h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          To maintain a secure and proctored environment, this quiz platform must be accessed as an installed application. Standard browser tabs are not supported.
        </p>
        
        {/* THIS BUTTON MUST HAVE THE onClick HANDLER */}
        <button
          onClick={handleInstallClick}
          className="w-full bg-blue-600 text-white font-semibold rounded-xl py-4 flex items-center justify-center gap-3 hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md shadow-blue-200"
        >
          <Download className="w-5 h-5"/>
          <span>Install ArenaHub App</span>
        </button>
      </div>
    </div>
  );
};
