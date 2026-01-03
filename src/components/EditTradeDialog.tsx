import { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trade, TradeType } from '@/types/trade';

interface EditTradeDialogProps {
  trade: Trade;
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
}

export const EditTradeDialog = ({ trade, onEditTrade }: EditTradeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState(trade.symbol);
  const [tradeType, setTradeType] = useState<TradeType>(trade.tradeType);
  const [entryDate, setEntryDate] = useState(trade.entryDate);
  const [entryPrice, setEntryPrice] = useState(trade.entryPrice.toString());
  const [quantity, setQuantity] = useState(trade.quantity.toString());
  const [currentPrice, setCurrentPrice] = useState(trade.currentPrice?.toString() || '');
  const [setupStopLoss, setSetupStopLoss] = useState(trade.setupStopLoss?.toString() || '');
  const [currentStopLoss, setCurrentStopLoss] = useState(trade.currentStopLoss?.toString() || '');
  const [target, setTarget] = useState(trade.target?.toString() || '');
  const [targetRPT, setTargetRPT] = useState(trade.targetRPT?.toString() || '2000');
  const [notes, setNotes] = useState(trade.notes || '');

  useEffect(() => {
    if (open) {
      setSymbol(trade.symbol);
      setTradeType(trade.tradeType);
      setEntryDate(trade.entryDate);
      setEntryPrice(trade.entryPrice.toString());
      setQuantity(trade.quantity.toString());
      setCurrentPrice(trade.currentPrice?.toString() || '');
      setSetupStopLoss(trade.setupStopLoss?.toString() || '');
      setCurrentStopLoss(trade.currentStopLoss?.toString() || '');
      setTarget(trade.target?.toString() || '');
      setTargetRPT(trade.targetRPT?.toString() || '2000');
      setNotes(trade.notes || '');
    }
  }, [open, trade]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onEditTrade(trade.id, {
      symbol: symbol.toUpperCase(),
      tradeType,
      entryDate,
      entryPrice: parseFloat(entryPrice),
      quantity: parseInt(quantity),
      currentPrice: currentPrice ? parseFloat(currentPrice) : null,
      setupStopLoss: setupStopLoss ? parseFloat(setupStopLoss) : null,
      currentStopLoss: currentStopLoss ? parseFloat(currentStopLoss) : null,
      target: target ? parseFloat(target) : null,
      targetRPT: targetRPT ? parseFloat(targetRPT) : null,
      notes: notes || null,
    });

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg glass-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Edit Trade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-symbol">Symbol</Label>
              <Input
                id="edit-symbol"
                placeholder="e.g., HINDCOPPER"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
                className="bg-secondary/50 border-border font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tradeType">Type</Label>
              <Select value={tradeType} onValueChange={(v) => setTradeType(v as TradeType)}>
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LONG">Long</SelectItem>
                  <SelectItem value="SHORT">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-entryDate">Entry Date</Label>
              <Input
                id="edit-entryDate"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-entryPrice">Entry Price</Label>
              <Input
                id="edit-entryPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                required
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-currentPrice">Current Price</Label>
              <Input
                id="edit-currentPrice"
                type="number"
                step="0.01"
                placeholder="LTP"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-quantity">Quantity</Label>
              <Input
                id="edit-quantity"
                type="number"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-setupStopLoss">Setup SL</Label>
              <Input
                id="edit-setupStopLoss"
                type="number"
                step="0.01"
                placeholder="Original SL"
                value={setupStopLoss}
                onChange={(e) => setSetupStopLoss(e.target.value)}
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-currentStopLoss">Current SL</Label>
              <Input
                id="edit-currentStopLoss"
                type="number"
                step="0.01"
                placeholder="Trailing SL"
                value={currentStopLoss}
                onChange={(e) => setCurrentStopLoss(e.target.value)}
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-target">Target Price</Label>
              <Input
                id="edit-target"
                type="number"
                step="0.01"
                placeholder="Target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-targetRPT">Target RPT (₹)</Label>
              <Input
                id="edit-targetRPT"
                type="number"
                placeholder="2000"
                value={targetRPT}
                onChange={(e) => setTargetRPT(e.target.value)}
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              placeholder="Trade rationale, strategy, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-secondary/50 border-border resize-none"
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full">
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
