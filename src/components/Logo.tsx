import React from 'react'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  collapsed?: boolean
  className?: string
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  collapsed = false,
  className,
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
  }

  const textClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  }

  return (
    <div className={cn('flex items-center gap-3 select-none', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white font-bold shadow-md shadow-indigo-500/20 shrink-0 transition-transform hover:scale-105',
          sizeClasses[size],
        )}
      >
        <span className="tracking-tight font-black">DP</span>
      </div>
      {showText && !collapsed && (
        <div className="flex flex-col leading-tight">
          <span
            className={cn(
              'font-bold text-slate-900 dark:text-white tracking-tight',
              textClasses[size],
            )}
          >
            Diretoria de Promoções
          </span>
          <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest">
            Auditoria & PDV
          </span>
        </div>
      )}
    </div>
  )
}
