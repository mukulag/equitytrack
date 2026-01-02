import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trade } from '@/types/trade';
import { toast } from 'sonner';

interface UseLivePricesOptions {
  trades: Trade[];
  onPriceUpdate: (tradeId: string, price: number) => void;
  intervalMs?: number;
  enabled?: boolean;
}

export const useLivePrices = ({
  trades,
  onPriceUpdate,
  intervalMs = 60000, // Default 1 minute
  enabled = true,
}: UseLivePricesOptions) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPrices = useCallback(async () => {
    // Get unique symbols from open trades only
    const openTrades = trades.filter((t) => t.status !== 'CLOSED');
    const symbols = [...new Set(openTrades.map((t) => t.symbol))];

    if (symbols.length === 0) {
      console.log('No open trades to fetch prices for');
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      console.log('Fetching live prices for:', symbols);

      const { data, error: fnError } = await supabase.functions.invoke('fetch-stock-price', {
        body: { symbols },
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.prices) {
        let updatedCount = 0;
        
        for (const trade of openTrades) {
          const price = data.prices[trade.symbol];
          if (price !== null && price !== undefined && price !== trade.currentPrice) {
            await onPriceUpdate(trade.id, price);
            updatedCount++;
          }
        }

        setLastRefresh(new Date());
        
        if (updatedCount > 0) {
          toast.success(`Updated prices for ${updatedCount} trade(s)`);
        }
      }
    } catch (err: any) {
      console.error('Error fetching live prices:', err);
      setError(err.message || 'Failed to fetch prices');
      toast.error('Failed to fetch live prices');
    } finally {
      setIsRefreshing(false);
    }
  }, [trades, onPriceUpdate]);

  // Set up periodic refresh
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchPrices();

    // Set up interval
    intervalRef.current = setInterval(fetchPrices, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMs, fetchPrices]);

  return {
    isRefreshing,
    lastRefresh,
    error,
    refreshNow: fetchPrices,
  };
};
