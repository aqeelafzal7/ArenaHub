import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PwaGatewayProps {
  children: React.ReactNode;
}

export const PwaGateway: React.FC<PwaGatewayProps> = ({ children }) => {
  const { profile } = useAuth();
  const [isStandalone, setIsStandalone] = useState(() => {
    return window.matchMedia('(display-mode: standalone)').matches || 
           (navigator as any).standalone === true || 
           document.referrer.includes('android-app://');
  });
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (navigator as any).standalone === true || 
        document.referrer.includes('android-app://');
      
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const getInstructions = () => {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isSafari = isIOS && /safari/.test(ua) && !/crios/.test(ua);
    
    if (isSafari) {
      return "Tap the 'Share' button in Safari and select 'Add to Home Screen'.";
    }
    if (isAndroid) {
      return "Tap the three-dots menu icon and select 'Install app' or 'Add to Home screen'.";
    }
    return "Click the 'Install' icon in your browser's address bar at the top right.";
  };

  const handleInstallClick = async () => {
    if (!installPrompt) {
      alert("To install on this device, please use your browser's menu (e.g., 'Add to Home Screen' or 'Install App').");
      return;
    }
    
    // Show the native install prompt
    installPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    
    // Optionally, clear the prompt if they accepted
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstallable(false);
    }
  };

  if (isStandalone || (profile?.role !== 'Participant' && profile?.role !== 'participant')) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
      <div className="bg-brand-surface border border-brand-primary/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-brand-primary/10 rounded-full animate-bounce">
            <Download className="w-12 h-12 text-brand-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-brand-text mb-4">Secure Installation Required</h1>
        <p className="text-brand-text/70 mb-6 text-sm">
          To maintain a secure and proctored environment, this quiz platform must be accessed as an installed application. Standard browser tabs are not supported.
        </p>
        
        {!isInstallable && (
          <div className="bg-brand-bg border border-brand-border rounded-xl p-5 mb-8">
            <h3 className="font-extrabold text-brand-text text-sm mb-2 uppercase tracking-wide">Installation Instructions</h3>
            <p className="text-brand-primary font-medium text-sm">
              {getInstructions()}
            </p>
          </div>
        )}

        <button
          onClick={handleInstallClick}
          className="w-full bg-blue-600 text-white rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Download className="w-5 h-5" />
          <span>Install ArenaHub App</span>
        </button>
      </div>
    </div>
  );
};
