import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  headerColor?: 'orange' | 'slate';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'lg',
  headerColor = 'slate',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-[95vw]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px] animate-fadeIn">
      <div
        className={`w-full ${maxWidthStyles[maxWidth]} bg-white border border-slate-400 shadow-2xl rounded-none flex flex-col max-h-[90vh] overflow-hidden`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 select-none ${
            headerColor === 'orange'
              ? 'bg-[#EA580C] text-white border-b border-[#C2410C]'
              : 'bg-slate-900 text-white border-b border-slate-800'
          }`}
        >
          <div>
            <h3 className="font-semibold text-base tracking-wide flex items-center gap-2">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-slate-300 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer rounded-none"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto bg-[#FAFAFA] flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[#FAF8F5] border-t border-slate-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
