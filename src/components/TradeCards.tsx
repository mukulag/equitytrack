import React from 'react';
import { Trade } from '@/types/trade';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';
import { computeTradeMetrics } from '@/lib/charges';
import { computeGroupedMetrics, computeAvgExitPrice, GroupedTrade } from '@/lib/groupTrades';

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
      {trades.map((t) => {
        const isCmpAbove = t.currentPrice != null && t.currentPrice > t.entryPrice;
        const isCmpBelow = t.currentPrice != null && t.currentPrice < t.entryPrice;
        const isGroup = !!(t as GroupedTrade).sourceTrades;
        const m = isGroup ? computeGroupedMetrics(t as GroupedTrade) : computeTradeMetrics(t);
        const unrealized = m.unrealizedPnl;
        const avgExit = isGroup ? computeAvgExitPrice(t.exits) : null;

        return (
        <details key={t.id} className="glass-card rounded-lg border p-3">
          <summary className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-mono font-semibold text-primary text-sm flex items-center gap-2">
                {t.symbol}
                {t.isMtf && <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">MTF</Badge>}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Qty: {t.remainingQuantity}/{t.quantity}</div>
            </div>

            <div className="text-right">
              <div className="text-sm whitespace-nowrap">
                <span className="text-muted-foreground mr-1 text-sm">CMP</span>
                <span className={isCmpAbove ? 'text-success font-semibold text-sm' : isCmpBelow ? 'text-destructive font-semibold text-sm' : 'font-semibold text-sm'}>
                  {t.currentPrice ? formatCurrency(t.currentPrice) : '—'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1 whitespace-nowrap">
                Entry: {formatCurrency(t.entryPrice)}
                {avgExit != null && <span className="ml-1">· Exit: {formatCurrency(avgExit)}</span>}
              </div>
            </div>
          </summary>

          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="truncate"><strong>Booked:</strong> {t.bookedProfit > 0 ? '+' + formatCurrency(t.bookedProfit) : formatCurrency(t.bookedProfit)}</div>
            <div className={unrealized != 0 ? (unrealized > 0 ? 'truncate text-success' : 'truncate text-destructive') : 'truncate text-muted-foreground'}>
              <strong>Unrealized:</strong> {formatCurrency(unrealized)}
            </div>

            <div className="truncate"><strong>Cost:</strong> {formatCurrency(m.costBasis)}</div>
            <div className="truncate text-muted-foreground"><strong>Charges:</strong> {formatCurrency(m.totalCharges)}</div>

            {t.isMtf && (
              <>
                <div className="truncate text-muted-foreground"><strong>Funded:</strong> {formatCurrency(m.fundedAmount)}</div>
                <div className="truncate text-warning"><strong>MTF Int:</strong> {formatCurrency(m.mtfInterest)}</div>
              </>
            )}

            <div className={m.netPnl > 0 ? 'truncate text-success font-semibold' : m.netPnl < 0 ? 'truncate text-destructive font-semibold' : 'truncate text-muted-foreground'}>
              <strong>Net P&L:</strong> {m.netPnl > 0 ? '+' : ''}{formatCurrency(m.netPnl)}
            </div>
            <div className={m.netMarginPercent > 0 ? 'truncate text-success' : m.netMarginPercent < 0 ? 'truncate text-destructive' : 'truncate text-muted-foreground'}>
              <strong>Net %:</strong> {m.netMarginPercent > 0 ? '+' : ''}{m.netMarginPercent.toFixed(2)}%
            </div>

            <div className="truncate"><strong>Opened:</strong> {format(new Date(t.entryDate), 'dd MMM yyyy')}</div>
            <div className="truncate"><strong>Type:</strong> {t.tradeType}</div>
          </div>
        </details>
      )})}
    </div>
  );
};

export default TradeCards;