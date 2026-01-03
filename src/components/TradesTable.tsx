import { Trade, TradeType } from '@/types/trade';
import { TradeRow } from './TradeRow';

interface TradesTableProps {
  trades: Trade[];
  onAddExit: (tradeId: string, exit: { quantity: number; exitPrice: number; exitDate: string }) => void;
  onDeleteTrade: (tradeId: string) => void;
  onDeleteExit: (tradeId: string, exitId: string) => void;
  onUpdateCurrentPrice: (tradeId: string, currentPrice: number | null) => void;
  onUpdateCurrentSL: (tradeId: string, currentSL: number | null) => void;
  onEditTrade: (tradeId: string, updates: {
    symbol: string;
    tradeType: TradeType;
    entryDate: string;
    entryPrice: number;
    quantity: number;
    currentPrice: number | null;
    setupStopLoss: number | null;
    currentStopLoss: number | null;
    target: number | null;
    targetRPT: number | null;
    notes: string | null;
  }) => void;
  onEditExit: (tradeId: string, exitId: string, updates: {
    exitDate: string;
    exitPrice: number;
    quantity: number;
  }) => void;
}

export const TradesTable = ({ trades, onAddExit, onDeleteTrade, onDeleteExit, onUpdateCurrentPrice, onUpdateCurrentSL, onEditTrade, onEditExit }: TradesTableProps) => {
  if (trades.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center animate-fade-in">
        <div className="text-muted-foreground">
          <p className="text-lg mb-2">No trades yet</p>
          <p className="text-sm">Click "New Trade" to add your first trade</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground sticky left-0 z-10 bg-secondary/30 min-w-[120px]">Symbol</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground sticky left-[120px] z-10 bg-secondary/30 min-w-[100px]">Date</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground sticky left-[220px] z-10 bg-secondary/30 min-w-[100px]">Entry</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground sticky left-[320px] z-10 bg-secondary/30 min-w-[100px]">CMP</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Qty</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Setup SL</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Current SL</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Status</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Booked</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Unrealized</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Type</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                onAddExit={onAddExit}
                onDeleteTrade={onDeleteTrade}
                onDeleteExit={onDeleteExit}
                onUpdateCurrentPrice={onUpdateCurrentPrice}
                onUpdateCurrentSL={onUpdateCurrentSL}
                onEditTrade={onEditTrade}
                onEditExit={onEditExit}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
