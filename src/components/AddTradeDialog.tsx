import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { TradeType } from '@/types/trade';

interface AddTradeDialogProps {
  onAddTrade: (trade: {
    symbol: string;
    tradeType: TradeType;
    entryDate: string;
    entryPrice: number;
    quantity: number;
    currentPrice: number | null;
    setupStopLoss: number | null;
    currentStopLoss: number | null;
    target: number | null;
    targetRPT: number;
    notes: string;
  }) => void;
}

export const AddTradeDialog = ({ onAddTrade }: AddTradeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [tradeType, setTradeType] = useState<TradeType>('LONG');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryPrice, setEntryPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [setupStopLoss, setSetupStopLoss] = useState('');
  const [currentStopLoss, setCurrentStopLoss] = useState('');
  const [target, setTarget] = useState('');
  const [targetRPT, setTargetRPT] = useState('2000');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onAddTrade({
      symbol: symbol.toUpperCase(),
      tradeType,
      entryDate,
      entryPrice: parseFloat(entryPrice),
      quantity: parseInt(quantity),
      currentPrice: currentPrice ? parseFloat(currentPrice) : null,
      setupStopLoss: setupStopLoss ? parseFloat(setupStopLoss) : null,
      currentStopLoss: currentStopLoss ? parseFloat(currentStopLoss) : null,
      target: target ? parseFloat(target) : null,
      targetRPT: parseFloat(targetRPT) || 2000,
      notes,
    });

    setSymbol('');
    setTradeType('LONG');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setEntryPrice('');
    setQuantity('');
    setCurrentPrice('');
    setSetupStopLoss('');
    setCurrentStopLoss('');
    setTarget('');
    setTargetRPT('2000');
    setNotes('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 glow-primary">
          <Plus className="h-4 w-4" />
          New Trade
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg glass-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New Trade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="e.g., HINDCOPPER"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
                className="bg-secondary/50 border-border font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tradeType">Type</Label>
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
              <Label htmlFor="entryDate">Entry Date</Label>
              <Input
                id="entryDate"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entryPrice">Entry Price</Label>
              <Input
                id="entryPrice"
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
              <Label htmlFor="currentPrice">Current Price</Label>
              <Input
                id="currentPrice"
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
              <Label htmlFor="setupStopLoss">Setup SL</Label>
              <Input
                id="setupStopLoss"
                type="number"
                step="0.01"
                placeholder="Original SL"
                value={setupStopLoss}
                onChange={(e) => setSetupStopLoss(e.target.value)}
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentStopLoss">Current SL</Label>
              <Input
                id="currentStopLoss"
                type="number"
                step="0.01"
                placeholder="Trailing SL"
                value={currentStopLoss}
                onChange={(e) => setCurrentStopLoss(e.target.value)}
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setupQuantity">Setup Qty</Label>
              <Input
                id="setupQuantity"
                type="number"
                value={entryPrice && setupStopLoss && parseFloat(entryPrice) !== parseFloat(setupStopLoss)
                  ? Math.floor(parseFloat(targetRPT) / Math.abs(parseFloat(entryPrice) - parseFloat(setupStopLoss)))
                  : ''}
                readOnly
                className="bg-secondary/30 border-border font-mono text-muted-foreground"
                placeholder="Auto"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target">Target Price</Label>
              <Input
                id="target"
                type="number"
                step="0.01"
                placeholder="Target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetRPT">Target RPT (₹)</Label>
              <Input
                id="targetRPT"
                type="number"
                placeholder="2000"
                value={targetRPT}
                onChange={(e) => setTargetRPT(e.target.value)}
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Trade rationale, strategy, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-secondary/50 border-border resize-none"
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full">
            Add Trade
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
