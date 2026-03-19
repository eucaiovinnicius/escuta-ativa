import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function InstallPWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    // Check if running in standalone (installed)
    const isReadyStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone === true);
    setIsStandalone(isReadyStandalone);

    // Detect iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    setIsIOS(isIosDevice);

    if (isIosDevice && !isReadyStandalone) {
      // Show iOS specific prompt after delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop PWA installation event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the native install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 flex flex-col gap-3"
      >
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute top-2 right-2 p-1.5 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-4 pr-6">
          <div className="size-12 rounded-xl bg-[#1a3a5b] shrink-0 flex items-center justify-center text-white font-bold text-xl shadow-inner">
            EA
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 leading-tight">Instale o App</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Adicione o Escuta Ativa à sua tela inicial para acesso rápido e uso offline.
            </p>
          </div>
        </div>

        {isIOS ? (
          <div className="mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-600 font-medium">
            No iPhone/iPad: Toque em <strong className="text-slate-900 mx-1">Compartilhar</strong> na barra do Safari e depois em <strong className="text-slate-900">Adicionar à Tela de Início</strong>.
          </div>
        ) : (
          <button
            onClick={handleInstallClick}
            className="w-full mt-2 py-2.5 bg-[#1a3a5b] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#1a3a5b]/90 transition-all shadow-md shadow-[#1a3a5b]/20"
          >
            <Download className="size-4" />
            Instalar Agora
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
