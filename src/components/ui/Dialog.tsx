import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function Dialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = 'info'
}: DialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  variant === 'danger' && "bg-rose-50 text-rose-600",
                  variant === 'warning' && "bg-amber-50 text-amber-600",
                  variant === 'info' && "bg-blue-50 text-blue-600"
                )}>
                  <AlertTriangle className="size-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{description}</p>
                </div>
                <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-50 rounded-lg">
                  <X className="size-5" />
                </button>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={cn(
                    "px-6 py-2 text-sm font-bold text-white rounded-xl transition-all shadow-lg",
                    variant === 'danger' && "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20",
                    variant === 'warning' && "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20",
                    variant === 'info' && "bg-[#1a3a5b] hover:bg-[#1a3a5b]/90 shadow-[#1a3a5b]/20"
                  )}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
