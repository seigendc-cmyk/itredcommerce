import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'subtle' | 'warning';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  shortcutBadge?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  shortcutBadge,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold tracking-wider uppercase transition-colors select-none rounded-none border focus:outline-none focus-pos cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] touch-manipulation whitespace-nowrap shadow-2xs';

  const variantStyles = {
    primary: 'bg-[#FF6B00] text-white border-transparent hover:bg-orange-500 active:bg-orange-700 shadow-xs',
    secondary: 'bg-gray-800 text-white border-gray-900 hover:bg-black active:bg-gray-950 shadow-xs',
    outline: 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-[#FF6B00] active:bg-gray-100',
    subtle: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 active:bg-gray-300',
    danger: 'bg-rose-700 text-white border-rose-800 hover:bg-rose-800 active:bg-rose-900 shadow-xs',
    warning: 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700 active:bg-amber-800 shadow-xs',
    ghost: 'bg-transparent text-gray-700 border-transparent hover:bg-orange-50 hover:text-[#FF6B00] active:bg-orange-100',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-[11px] gap-1.5 min-h-[30px]',
    md: 'px-3.5 py-1.5 text-xs gap-2 min-h-[36px]',
    lg: 'px-5 py-2.5 text-sm gap-2.5 min-h-[44px]',
    icon: 'p-2 min-h-[36px] min-w-[36px]',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent animate-spin mr-1.5" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {rightIcon && !isLoading && <span className="shrink-0">{rightIcon}</span>}
      {shortcutBadge && (
        <span className="ml-1.5 px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-black/20 text-current rounded-none">
          {shortcutBadge}
        </span>
      )}
    </button>
  );
};
