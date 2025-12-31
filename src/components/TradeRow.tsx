import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Trade } from '@/types/trade';
import { AddExitDialog } from './AddExitDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface TradeRowProps {
  trade: Trade;
  onAddExit: (tradeId: string, exit: { quantity: number; exitPrice: number; exitDate: string }) => void;
  onDeleteTrade: (tradeId: string) => void;
  onDeleteExit: (tradeId: string, exitId: string) => void;
}

export const TradeRow = ({ trade, onAddExit, onDeleteTrade, onDeleteExit }: TradeRowProps) => {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    OPEN: 'bg-primary/20 text-primary border-primary/30',
    PARTIAL: 'bg-warning/20 text-warning border-warning/30',
    CLOSED: trade.totalPnl >= 0 ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30',
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <>
      <tr className="table-row-hover border-b border-border/50">
        <td className="p-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left"
          >
            {trade.exits.length > 0 ? (
              expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )
            ) : (
              <span className="w-4" />
            )}
            <span className="font-mono font-semibold text-primary">{trade.symbol}</span>
          </button>
        </td>
        <td className="p-4">
          <Badge variant="outline" className={cn('text-xs', trade.tradeType === 'LONG' ? 'border-success/50 text-success' : 'border-destructive/50 text-destructive')}>
            {trade.tradeType}
          </Badge>
        </td>
        <td className="p-4 font-mono text-sm">{format(new Date(trade.entryDate), 'dd MMM yyyy')}</td>
        <td className="p-4 font-mono text-sm">{formatCurrency(trade.entryPrice)}</td>
        <td className="p-4 font-mono text-sm">{trade.quantity}</td>
        <td className="p-4 font-mono text-sm text-muted-foreground">
          {trade.stopLoss ? formatCurrency(trade.stopLoss) : '—'}
        </td>
        <td className="p-4 font-mono text-sm text-muted-foreground">
          {trade.target ? formatCurrency(trade.target) : '—'}
        </td>
        <td className="p-4">
          <Badge variant="outline" className={cn('text-xs', statusColors[trade.status])}>
            {trade.status}
          </Badge>
        </td>
        <td className="p-4">
          <span
            className={cn(
              'font-mono font-semibold',
              trade.totalPnl > 0 && 'profit-text',
              trade.totalPnl < 0 && 'loss-text',
              trade.totalPnl === 0 && 'text-muted-foreground'
            )}
          >
            {trade.totalPnl > 0 ? '+' : ''}
            {formatCurrency(trade.totalPnl)}
          </span>
        </td>
        <td className="p-4">
          <div className="flex items-center gap-2">
            <AddExitDialog trade={trade} onAddExit={onAddExit} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Trade</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this trade? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDeleteTrade(trade.id)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </td>
      </tr>
      {expanded &&
        trade.exits.map((exit) => (
          <tr key={exit.id} className="bg-accent/20 border-b border-border/30">
            <td className="p-4 pl-12" colSpan={2}>
              <span className="text-sm text-muted-foreground">↳ Exit</span>
            </td>
            <td className="p-4 font-mono text-sm text-muted-foreground">
              {format(new Date(exit.exitDate), 'dd MMM yyyy')}
            </td>
            <td className="p-4 font-mono text-sm">{formatCurrency(exit.exitPrice)}</td>
            <td className="p-4 font-mono text-sm">{exit.quantity}</td>
            <td className="p-4" colSpan={2}></td>
            <td className="p-4">
              <span
                className={cn(
                  'font-mono text-sm font-medium',
                  exit.pnl > 0 && 'profit-text',
                  exit.pnl < 0 && 'loss-text'
                )}
              >
                {exit.pnl > 0 ? '+' : ''}
                {formatCurrency(exit.pnl)}
              </span>
            </td>
            <td className="p-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDeleteExit(trade.id, exit.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </td>
          </tr>
        ))}
    </>
  );
};
