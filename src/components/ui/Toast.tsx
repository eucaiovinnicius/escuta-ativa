import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const success = (msg: string) => toast(msg, 'success');
  const error = (msg: string) => toast(msg, 'error');
  const warning = (msg: string) => toast(msg, 'warning');
  const info = (msg: string) => toast(msg, 'info');

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className={cn(
                "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border min-w-[300px] max-w-md",
                t.type === 'success' && "bg-emerald-50 border-emerald-200 text-emerald-800",
                t.type === 'error' && "bg-rose-50 border-rose-200 text-rose-800",
                t.type === 'warning' && "bg-amber-50 border-amber-200 text-amber-800",
                t.type === 'info' && "bg-blue-50 border-blue-200 text-blue-800"
              )}
            >
              <div className="shrink-0">
                {t.type === 'success' && <CheckCircle2 className="size-5 text-emerald-600" />}
                {t.type === 'error' && <AlertCircle className="size-5 text-rose-600" />}
                {t.type === 'warning' && <AlertTriangle className="size-5 text-amber-600" />}
                {t.type === 'info' && <Info className="size-5 text-blue-600" />}
              </div>
              <p className="text-sm font-medium flex-1">{t.message}</p>
              <button 
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-1 hover:bg-black/5 rounded-lg transition-all"
              >
                <X className="size-4 opacity-50" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
