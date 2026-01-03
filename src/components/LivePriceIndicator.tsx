import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LivePriceIndicatorProps {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  onRefresh: () => void;
}

export const LivePriceIndicator = ({
  isRefreshing,
  lastRefresh,
  onRefresh,
}: LivePriceIndicatorProps) => {
  const [displayTime, setDisplayTime] = useState<string>('Never');

  useEffect(() => {
    const updateDisplayTime = () => {
      if (!lastRefresh) {
        setDisplayTime('Never');
        return;
      }
      const now = new Date();
      const diff = Math.floor((now.getTime() - lastRefresh.getTime()) / 1000);
      
      if (diff < 60) {
        // Show minutes for anything less than a minute to avoid constant updates
        setDisplayTime('Just now');
      } else if (diff < 3600) {
        setDisplayTime(`${Math.floor(diff / 60)}m ago`);
      } else {
        setDisplayTime(lastRefresh.toLocaleTimeString());
      }
    };

    // Update immediately
    updateDisplayTime();

    // Update every 30 seconds instead of every render
    const interval = setInterval(updateDisplayTime, 30000);

    return () => clearInterval(interval);
  }, [lastRefresh]);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "h-2 w-2 rounded-full",
          isRefreshing ? "bg-yellow-500 animate-pulse" : "bg-green-500"
        )} />
        <span className="hidden sm:inline">
          {isRefreshing ? 'Updating...' : `Updated ${displayTime}`}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onRefresh}
        disabled={isRefreshing}
        title="Refresh prices now"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
      </Button>
    </div>
  );
};
