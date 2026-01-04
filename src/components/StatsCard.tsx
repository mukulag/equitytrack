import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}

export const StatsCard = ({ title, value, icon: Icon, trend, subtitle }: StatsCardProps) => {
  // Normalize value for layout: split leading sign if present so sign can be styled separately
  const valueStr = String(value);
  const isNegative = /^[-−]/.test(valueStr);
  const sign = isNegative ? valueStr[0] : '';
  const absValue = isNegative ? valueStr.slice(1) : valueStr;

  return (
    <div className="stat-card animate-fade-in h-full flex items-center">
      <div className="flex items-center justify-between w-full">
        <div className="flex-1 flex flex-col justify-between">
          <p className="text-sm font-medium text-muted-foreground whitespace-nowrap overflow-hidden truncate h-6">{title}</p>

          <div className={cn('flex items-baseline gap-1', trend === 'up' && 'profit-text', trend === 'down' && 'loss-text')}>
            {isNegative && <span className="text-lg font-medium leading-none">{sign}</span>}
            <span className="text-xl sm:text-2xl font-bold leading-tight">{absValue}</span>
          </div>

          <p className="text-xs text-muted-foreground h-4">{subtitle ?? ''}</p>
        </div>
        <div
          className={cn(
            'p-3 rounded-xl',
            trend === 'up' && 'bg-success/10 text-success',
            trend === 'down' && 'bg-destructive/10 text-destructive',
            !trend && 'bg-primary/10 text-primary'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};
