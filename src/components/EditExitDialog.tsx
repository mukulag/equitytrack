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
import { Exit } from '@/types/trade';

interface EditExitDialogProps {
  exit: Exit;
  tradeId: string;
  onEditExit: (tradeId: string, exitId: string, updates: {
    exitDate: string;
    exitPrice: number;
    quantity: number;
  }) => void;
}

export const EditExitDialog = ({ exit, tradeId, onEditExit }: EditExitDialogProps) => {
  const [open, setOpen] = useState(false);
  const [exitDate, setExitDate] = useState(exit.exitDate);
  const [exitPrice, setExitPrice] = useState(exit.exitPrice.toString());
  const [quantity, setQuantity] = useState(exit.quantity.toString());

  useEffect(() => {
    if (open) {
      setExitDate(exit.exitDate);
      setExitPrice(exit.exitPrice.toString());
      setQuantity(exit.quantity.toString());
    }
  }, [open, exit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onEditExit(tradeId, exit.id, {
      exitDate,
      exitPrice: parseFloat(exitPrice),
      quantity: parseInt(quantity),
    });

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary">
          <Edit2 className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm glass-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Edit Exit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-exitDate">Exit Date</Label>
            <Input
              id="edit-exitDate"
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              required
              className="bg-secondary/50 border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-exitPrice">Exit Price</Label>
              <Input
                id="edit-exitPrice"
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
              <Label htmlFor="edit-exitQty">Quantity</Label>
              <Input
                id="edit-exitQty"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
          </div>

          <Button type="submit" className="w-full">
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
