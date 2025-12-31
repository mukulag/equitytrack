import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { Trade } from '@/types/trade';
import { AddExitDialog } from './AddExitDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  onUpdateCurrentPrice: (tradeId: string, currentPrice: number | null) => void;
  onUpdateCurrentSL: (tradeId: string, currentSL: number | null) => void;
}

export const TradeRow = ({ trade, onAddExit, onDeleteTrade, onDeleteExit, onUpdateCurrentPrice, onUpdateCurrentSL }: TradeRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingSL, setEditingSL] = useState(false);
  const [tempPrice, setTempPrice] = useState(trade.currentPrice?.toString() || '');
  const [tempSL, setTempSL] = useState(trade.currentStopLoss?.toString() || '');

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

  // Calculate derived values
  const activeStopLoss = trade.currentStopLoss ?? trade.setupStopLoss;
  const slDistance = activeStopLoss ? (trade.entryPrice - activeStopLoss) : null;
  const slPercent = activeStopLoss ? ((activeStopLoss - trade.entryPrice) / trade.entryPrice * 100) : null;
  const currentRPT = slDistance && trade.remainingQuantity ? slDistance * trade.remainingQuantity : null;
  const unrealizedPnl = trade.currentPrice && trade.remainingQuantity > 0
    ? (trade.currentPrice - trade.entryPrice) * trade.remainingQuantity
    : 0;
  const positionSize = trade.entryPrice * trade.quantity;

  const handlePriceSave = () => {
    onUpdateCurrentPrice(trade.id, tempPrice ? parseFloat(tempPrice) : null);
    setEditingPrice(false);
  };

  const handleSLSave = () => {
    onUpdateCurrentSL(trade.id, tempSL ? parseFloat(tempSL) : null);
    setEditingSL(false);
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
        <td className="p-4 font-mono text-sm">{format(new Date(trade.entryDate), 'dd MMM')}</td>
        <td className="p-4 font-mono text-sm">{formatCurrency(trade.entryPrice)}</td>
        <td className="p-4">
          {editingPrice ? (
            <Input
              type="number"
              step="0.01"
              value={tempPrice}
              onChange={(e) => setTempPrice(e.target.value)}
              onBlur={handlePriceSave}
              onKeyDown={(e) => e.key === 'Enter' && handlePriceSave()}
              className="w-24 h-7 font-mono text-sm bg-secondary/50"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setTempPrice(trade.currentPrice?.toString() || ''); setEditingPrice(true); }}
              className={cn(
                'font-mono text-sm flex items-center gap-1 hover:text-primary transition-colors',
                trade.currentPrice ? (
                  trade.currentPrice > trade.entryPrice ? 'text-success' : 'text-destructive'
                ) : 'text-muted-foreground'
              )}
            >
              {trade.currentPrice ? formatCurrency(trade.currentPrice) : '—'}
              <Edit2 className="h-3 w-3 opacity-50" />
            </button>
          )}
        </td>
        <td className="p-4 font-mono text-sm">{trade.remainingQuantity}/{trade.quantity}</td>
        <td className="p-4 font-mono text-sm text-muted-foreground">
          {trade.setupStopLoss ? formatCurrency(trade.setupStopLoss) : '—'}
        </td>
        <td className="p-4">
          {editingSL ? (
            <Input
              type="number"
              step="0.01"
              value={tempSL}
              onChange={(e) => setTempSL(e.target.value)}
              onBlur={handleSLSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSLSave()}
              className="w-24 h-7 font-mono text-sm bg-secondary/50"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setTempSL(trade.currentStopLoss?.toString() || ''); setEditingSL(true); }}
              className="font-mono text-sm text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
            >
              {trade.currentStopLoss ? formatCurrency(trade.currentStopLoss) : '—'}
              <Edit2 className="h-3 w-3 opacity-50" />
            </button>
          )}
        </td>
        <td className="p-4 font-mono text-sm">
          {slPercent ? (
            <span className={slPercent < 0 ? 'text-destructive' : 'text-success'}>
              {slPercent.toFixed(1)}%
            </span>
          ) : '—'}
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
              trade.bookedProfit > 0 && 'profit-text',
              trade.bookedProfit < 0 && 'loss-text',
              trade.bookedProfit === 0 && 'text-muted-foreground'
            )}
          >
            {trade.bookedProfit > 0 ? '+' : ''}
            {formatCurrency(trade.bookedProfit)}
          </span>
        </td>
        <td className="p-4">
          <span
            className={cn(
              'font-mono text-sm',
              unrealizedPnl > 0 && 'profit-text',
              unrealizedPnl < 0 && 'loss-text',
              unrealizedPnl === 0 && 'text-muted-foreground'
            )}
          >
            {unrealizedPnl > 0 ? '+' : ''}
            {formatCurrency(unrealizedPnl)}
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
              {format(new Date(exit.exitDate), 'dd MMM')}
            </td>
            <td className="p-4 font-mono text-sm" colSpan={2}>{formatCurrency(exit.exitPrice)}</td>
            <td className="p-4 font-mono text-sm">{exit.quantity}</td>
            <td className="p-4" colSpan={5}></td>
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
            <td></td>
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
