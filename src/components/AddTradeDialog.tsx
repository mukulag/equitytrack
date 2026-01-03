import { useState, useEffect, useRef } from 'react';
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
import { supabase } from '@/integrations/supabase/client';

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
  const [currentStopLoss, setCurrentStopLoss] = useState('');
  const [targetRPT, setTargetRPT] = useState('2000');
  const [notes, setNotes] = useState('');
  const [cmp, setCmp] = useState<number | null>(null);
  const [isFetchingCmp, setIsFetchingCmp] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch CMP as user types in symbol field
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Reset CMP if symbol is empty
    if (!symbol.trim()) {
      setCmp(null);
      return;
    }

    // Debounce the API call
    debounceTimerRef.current = setTimeout(async () => {
      const symbolToFetch = symbol.trim().toUpperCase();
      if (!symbolToFetch) {
        setCmp(null);
        return;
      }

      setIsFetchingCmp(true);
      try {
        const { data, error } = await supabase.functions.invoke('fetch-stock-price', {
          body: { symbols: [symbolToFetch] },
        });

        if (error) {
          console.error('Error fetching CMP:', error);
          setCmp(null);
        } else if (data?.prices && data.prices[symbolToFetch] !== null && data.prices[symbolToFetch] !== undefined) {
          setCmp(data.prices[symbolToFetch]);
        } else {
          setCmp(null);
        }
      } catch (err) {
        console.error('Error fetching CMP:', err);
        setCmp(null);
      } finally {
        setIsFetchingCmp(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [symbol]);

  // Reset CMP when dialog closes
  useEffect(() => {
    if (!open) {
      setCmp(null);
      setSymbol('');
    }
  }, [open]);

  // Auto-calculate Setup Quantity when Setup SL or CMP changes
  // Note: This is calculated in the Setup Qty field directly, no need for separate state

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onAddTrade({
      symbol: symbol.toUpperCase(),
      tradeType,
      entryDate,
      entryPrice: parseFloat(entryPrice),
      quantity: parseInt(quantity),
      currentPrice: cmp !== null ? cmp : null,
      setupStopLoss: null,
      currentStopLoss: currentStopLoss ? parseFloat(currentStopLoss) : null,
      target: null,
      targetRPT: parseFloat(targetRPT) || 2000,
      notes,
    });

    setSymbol('');
    setTradeType('LONG');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setEntryPrice('');
    setQuantity('');
    setCurrentStopLoss('');
    setTargetRPT('2000');
    setNotes('');
    setCmp(null);
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
              <div className="relative">
                <Input
                  id="symbol"
                  placeholder="e.g., HINDCOPPER"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  required
                  className="bg-secondary/50 border-border font-mono uppercase pr-20"
                />
                {isFetchingCmp && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Loading...
                  </span>
                )}
                {!isFetchingCmp && cmp !== null && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary">
                    CMP: ₹{cmp.toFixed(2)}
                  </span>
                )}
              </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entryDate">Date</Label>
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
              <Label htmlFor="entryPrice">Entry</Label>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentStopLoss">SL</Label>
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
              <Label htmlFor="quantity">Qty</Label>
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
              <Label htmlFor="positionSize">Position Size</Label>
              <Input
                id="positionSize"
                type="number"
                value={entryPrice && quantity
                  ? (parseFloat(entryPrice) * parseFloat(quantity)).toFixed(2)
                  : ''}
                readOnly
                className="bg-secondary/30 border-border font-mono text-muted-foreground"
                placeholder="Auto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setupQuantity">Setup Qty</Label>
              <Input
                id="setupQuantity"
                type="number"
                value={cmp && currentStopLoss && targetRPT && cmp !== parseFloat(currentStopLoss)
                  ? Math.floor(parseFloat(targetRPT) / Math.abs(cmp - parseFloat(currentStopLoss)))
                  : ''}
                readOnly
                className="bg-secondary/30 border-border font-mono text-muted-foreground"
                placeholder="Auto"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetRPT">RPT</Label>
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
