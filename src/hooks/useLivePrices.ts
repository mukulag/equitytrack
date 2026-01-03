import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trade } from '@/types/trade';

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
  const isFetchingRef = useRef(false);

  const fetchPrices = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    // Get unique symbols from open trades only
    const openTrades = trades.filter((t) => t.status !== 'CLOSED');
    const symbols = [...new Set(openTrades.map((t) => t.symbol))];

    if (symbols.length === 0) {
      return;
    }

    isFetchingRef.current = true;
    setIsRefreshing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-stock-price', {
        body: { symbols },
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.prices) {
        for (const trade of openTrades) {
          const price = data.prices[trade.symbol];
          if (price !== null && price !== undefined && price !== trade.currentPrice) {
            onPriceUpdate(trade.id, price);
          }
        }
        setLastRefresh(new Date());
      }
    } catch (err: any) {
      console.error('Error fetching live prices:', err);
      setError(err.message || 'Failed to fetch prices');
    } finally {
      setIsRefreshing(false);
      isFetchingRef.current = false;
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

    // Initial fetch after a short delay
    const initialTimeout = setTimeout(fetchPrices, 1000);

    // Set up interval
    intervalRef.current = setInterval(fetchPrices, intervalMs);

    return () => {
      clearTimeout(initialTimeout);
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
