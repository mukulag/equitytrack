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
import { Checkbox } from '@/components/ui/checkbox';

interface EditTradeDialogProps {
  trade: Trade;
  onEditTrade: (tradeId: string, updates: {
    symbol: string;
    tradeType: TradeType;
    entryDate: string;
    entryPrice: number;
    quantity: number;
    currentPrice: number | null;
    notes: string | null;
    isMtf?: boolean;
    marginContribution?: number | null;
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
  const [notes, setNotes] = useState(trade.notes || '');
  const [isMtf, setIsMtf] = useState(!!trade.isMtf);
  const [marginContribution, setMarginContribution] = useState(trade.marginContribution?.toString() || '');

  useEffect(() => {
    if (open) {
      setSymbol(trade.symbol);
      setTradeType(trade.tradeType);
      setEntryDate(trade.entryDate);
      setEntryPrice(trade.entryPrice.toString());
      setQuantity(trade.quantity.toString());
      setCurrentPrice(trade.currentPrice?.toString() || '');
      setNotes(trade.notes || '');
      setIsMtf(!!trade.isMtf);
      setMarginContribution(trade.marginContribution?.toString() || '');
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
      notes: notes || null,
      isMtf,
      marginContribution: isMtf && marginContribution ? parseFloat(marginContribution) : null,
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

          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="edit-isMtf" checked={isMtf} onCheckedChange={(v) => setIsMtf(!!v)} />
              <Label htmlFor="edit-isMtf" className="cursor-pointer">MTF (Margin Trade)</Label>
            </div>
            {isMtf && (
              <div className="space-y-2">
                <Label htmlFor="edit-marginContribution">Margin Contribution (₹)</Label>
                <Input
                  id="edit-marginContribution"
                  type="number"
                  step="0.01"
                  placeholder={entryPrice && quantity ? `Default 25% = ${(parseFloat(entryPrice) * parseFloat(quantity) * 0.25).toFixed(0)}` : 'Default 25%'}
                  value={marginContribution}
                  onChange={(e) => setMarginContribution(e.target.value)}
                  className="bg-secondary/50 border-border font-mono"
                />
              </div>
            )}
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
