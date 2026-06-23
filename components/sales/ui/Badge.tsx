import { cn } from '@/lib/utils'

type Color = 'green' | 'yellow' | 'red' | 'gray' | 'orange' | 'blue'

const colorMap: Record<Color, string> = {
  green:  'bg-green-100 text-green-800 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  red:    'bg-red-100 text-red-700 border-red-200',
  gray:   'bg-gray-100 text-gray-600 border-gray-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  blue:   'bg-blue-100 text-blue-700 border-blue-200',
}

export function Badge({ color = 'gray', children, className }: {
  color?: Color
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      colorMap[color],
      className
    )}>
      {children}
    </span>
  )
}
