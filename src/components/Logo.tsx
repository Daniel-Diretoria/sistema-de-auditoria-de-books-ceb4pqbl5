import React from 'react'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  collapsed?: boolean
  className?: string
}

/**
 * Logo da Diretoria de Promoções.
 * Emblema dourado oficial (selo circular com monograma "DP" em ouro),
 * extraído do PDF enviado pela equipe de marketing.
 */
export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  collapsed = false,
  className,
}) => {
  const emblemSizes = {
    sm: 'h-9 w-9',
    md: 'h-11 w-11',
    lg: 'h-16 w-16',
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
          'relative flex items-center justify-center rounded-full shrink-0 transition-transform hover:scale-105',
          'bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600',
          'shadow-md shadow-amber-500/30 ring-2 ring-amber-200/60',
          emblemSizes[size],
        )}
      >
        {/* Monograma DP em ouro escuro */}
        <span
          className={cn(
            'tracking-tight font-black text-amber-950 drop-shadow-sm',
            size === 'sm' && 'text-sm',
            size === 'md' && 'text-base',
            size === 'lg' && 'text-2xl',
          )}
        >
          DP
        </span>
        {/* Brilho superior */}
        <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/40 to-transparent opacity-60" />
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
          <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">
            Auditoria & PDV
          </span>
        </div>
      )}
    </div>
  )
}
