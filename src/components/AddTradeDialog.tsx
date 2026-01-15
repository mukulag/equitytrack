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
  const [setupStopLoss, setSetupStopLoss] = useState('');
  const [setupSLWasSet, setSetupSLWasSet] = useState(false);
  const [currentStopLoss, setCurrentStopLoss] = useState('');
  const [targetRPT, setTargetRPT] = useState('2000');
  const [notes, setNotes] = useState('');
  const [cmp, setCmp] = useState<number | null>(null);
  const [dailyLow, setDailyLow] = useState<number | null>(null);
  const [isFetchingCmp, setIsFetchingCmp] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch CMP and daily low as user types in symbol field
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!symbol.trim()) {
      setCmp(null);
      setDailyLow(null);
      setSetupSLWasSet(false);
      return;
    }
    debounceTimerRef.current = setTimeout(async () => {
      const symbolToFetch = symbol.trim().toUpperCase();
      if (!symbolToFetch) {
        setCmp(null);
        setDailyLow(null);
        setSetupSLWasSet(false);
        return;
      }
      setIsFetchingCmp(true);
      try {
        const { data, error } = await supabase.functions.invoke('fetch-stock-price', {
          body: { symbols: [symbolToFetch] },
        });
        if (error) {
          setCmp(null);
          setDailyLow(null);
          setSetupSLWasSet(false);
        } else if (data?.quotes && Array.isArray(data.quotes) && data.quotes.length > 0) {
          const quote = data.quotes[0];
          setCmp(quote.price);
          let low = quote.low;
          // Fallback: try to get lowest value from intraday prices if low is null/undefined
          if (low === null || low === undefined) {
            // Try to get from intraday array if present
            if (quote.lows && Array.isArray(quote.lows) && quote.lows.length > 0) {
              const filteredLows = quote.lows.filter(v => v !== null && v !== undefined);
              if (filteredLows.length > 0) {
                low = Math.min(...filteredLows);
              }
            }
          }
          setDailyLow(low);
          if (!setupSLWasSet && low !== undefined && low !== null) {
            setSetupStopLoss(Number(low).toFixed(2));
            setSetupSLWasSet(true);
          }
        } else {
          setCmp(null);
          setDailyLow(null);
          setSetupSLWasSet(false);
        }
      } catch (err) {
        setCmp(null);
        setDailyLow(null);
        setSetupSLWasSet(false);
      } finally {
        setIsFetchingCmp(false);
      }
    }, 500);
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
      setDailyLow(null);
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
      setupStopLoss: setupStopLoss ? parseFloat(setupStopLoss) : null,
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
    setSetupStopLoss('');
    setCurrentStopLoss('');
    setTargetRPT('2000');
    setNotes('');
    setCmp(null);
    setDailyLow(null);
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
                    ₹{cmp.toFixed(2)}
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
              <Label htmlFor="setupStopLoss">Setup SL</Label>
              <Input
                id="setupStopLoss"
                type="number"
                step="0.01"
                placeholder="Daily Low"
                value={setupStopLoss}
                onChange={e => {
                  setSetupStopLoss(e.target.value);
                  setSetupSLWasSet(true);
                }}
                className="bg-secondary/50 border-border font-mono"
              />
              {isFetchingCmp && (
                <p className="text-xs text-muted-foreground">Fetching daily low...</p>
              )}
              {dailyLow !== undefined && dailyLow !== null && (
                <p className="text-xs text-primary font-semibold">
                  Daily Low: ₹{Number(dailyLow).toFixed(2)}
                </p>
              )}
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
              <Label htmlFor="currentStopLoss">Current SL (Trailing)</Label>
              <Input
                id="currentStopLoss"
                type="number"
                step="0.01"
                placeholder="Optional"
                value={currentStopLoss}
                onChange={(e) => setCurrentStopLoss(e.target.value)}
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="setupQuantity">Setup Qty</Label>
              <Input
                id="setupQuantity"
                type="number"
                value={cmp && setupStopLoss && targetRPT && cmp !== parseFloat(setupStopLoss)
                  ? Math.floor(parseFloat(targetRPT) / Math.abs(cmp - parseFloat(setupStopLoss)))
                  : ''}
                readOnly
                className="bg-secondary/30 border-border font-mono text-muted-foreground"
                placeholder="Auto"
              />
            </div>
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
