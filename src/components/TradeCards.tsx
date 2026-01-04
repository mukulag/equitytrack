import React from 'react';
import { Trade } from '@/types/trade';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
};

export const TradeCards = ({ trades }: { trades: Trade[] }) => {
  if (!trades || trades.length === 0) return null;

  return (
    <div className="space-y-3 p-4">
      {trades.map((t) => (
        <details key={t.id} className="glass-card rounded-lg border p-3">
          <summary className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-mono font-semibold text-primary">{t.symbol}</div>
              <div className="text-xs text-muted-foreground">Entry: {formatCurrency(t.entryPrice)}</div>
            </div>

            <div className="text-right">
              <div className="font-semibold">{t.currentPrice ? formatCurrency(t.currentPrice) : '—'}</div>
              <div className="text-xs text-muted-foreground">{t.remainingQuantity}/{t.quantity}</div>
            </div>
          </summary>

          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="truncate"><strong>Type:</strong> {t.tradeType}</div>
            <div className="truncate"><strong>Booked:</strong> {t.bookedProfit > 0 ? '+' + formatCurrency(t.bookedProfit) : formatCurrency(t.bookedProfit)}</div>
            <div className="truncate"><strong>Setup SL:</strong> {t.setupStopLoss ? formatCurrency(t.setupStopLoss) : '—'}</div>
            <div className="truncate"><strong>Current SL:</strong> {t.currentStopLoss ? formatCurrency(t.currentStopLoss) : '—'}</div>
            <div className="truncate"><strong>Opened:</strong> {format(new Date(t.entryDate), 'dd MMM yyyy')}</div>
            <div className="truncate text-right"><strong>Unrealized:</strong> {t.currentPrice ? formatCurrency((t.currentPrice - t.entryPrice) * t.remainingQuantity) : '—'}</div>
          </div>
        </details>
      ))}
    </div>
  );
};

export default TradeCards;