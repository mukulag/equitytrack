import { useState } from 'react';
import { LogOut } from 'lucide-react';
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
import { Trade } from '@/types/trade';

interface AddExitDialogProps {
  trade: Trade;
  onAddExit: (tradeId: string, exit: { quantity: number; exitPrice: number; exitDate: string }) => void;
}

export const AddExitDialog = ({ trade, onAddExit }: AddExitDialogProps) => {
  const [open, setOpen] = useState(false);
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
  const [exitPrice, setExitPrice] = useState('');
  const [quantity, setQuantity] = useState(trade.remainingQuantity.toString());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const qty = parseInt(quantity);
    if (qty > trade.remainingQuantity) {
      return;
    }

    onAddExit(trade.id, {
      quantity: qty,
      exitPrice: parseFloat(exitPrice),
      exitDate,
    });

    setExitDate(new Date().toISOString().split('T')[0]);
    setExitPrice('');
    setQuantity(trade.remainingQuantity.toString());
    setOpen(false);
  };

  if (trade.remainingQuantity === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <LogOut className="h-3 w-3" />
          Exit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm glass-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Exit <span className="text-primary font-mono">{trade.symbol}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-4">
          Remaining: <span className="font-mono text-foreground">{trade.remainingQuantity}</span> shares
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exitDate">Exit Date</Label>
            <Input
              id="exitDate"
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              required
              className="bg-secondary/50 border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exitPrice">Exit Price</Label>
              <Input
                id="exitPrice"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                required
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exitQty">Quantity</Label>
              <Input
                id="exitQty"
                type="number"
                max={trade.remainingQuantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
          </div>

          <Button type="submit" className="w-full">
            Record Exit
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
