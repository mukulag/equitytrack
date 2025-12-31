import { Trade } from '@/types/trade';
import { TradeRow } from './TradeRow';

interface TradesTableProps {
  trades: Trade[];
  onAddExit: (tradeId: string, exit: { quantity: number; exitPrice: number; exitDate: string }) => void;
  onDeleteTrade: (tradeId: string) => void;
  onDeleteExit: (tradeId: string, exitId: string) => void;
}

export const TradesTable = ({ trades, onAddExit, onDeleteTrade, onDeleteExit }: TradesTableProps) => {
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
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Symbol</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Type</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Entry Date</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Entry Price</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Qty</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">SL</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Target</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">Status</th>
              <th className="text-left p-4 text-sm font-semibold text-muted-foreground">P&L</th>
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
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
