import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Info } from 'lucide-react';
import { toast } from 'sonner';

interface KiteImportDialogProps {
  onImportCSV: (data: ParsedCSVTrade[]) => Promise<{ imported: number; skipped: number }>;
  disabled?: boolean;
}

export interface ParsedCSVExit {
  exitDate: string;
  exitPrice: number;
  quantity: number;
}

export interface ParsedCSVTrade {
  symbol: string;
  tradeType: 'LONG' | 'SHORT' | 'IPO';
  entryDate: string;
  entryPrice: number;
  quantity: number;
  exits?: ParsedCSVExit[];
  notes?: string;
}

export function KiteImportDialog({ onImportCSV, disabled }: KiteImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseKiteCSV = (csvText: string): ParsedCSVTrade[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.toLowerCase().trim().replace(/"/g, ''));

    const getCol = (names: string[]): number => {
      for (const name of names) {
        const idx = headers.findIndex(h => h.includes(name));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const dateIdx = getCol(['trade_date', 'date', 'order_date']);
    const symbolIdx = getCol(['symbol', 'tradingsymbol', 'scrip']);
    const typeIdx = getCol(['trade_type', 'type', 'buy_sell', 'side']);
    const qtyIdx = getCol(['quantity', 'qty', 'traded_qty']);
    const priceIdx = getCol(['price', 'trade_price', 'avg_price', 'average_price']);

    interface Transaction {
      date: string;
      price: number;
      quantity: number;
      isBuy: boolean;
    }

    const transactionsBySymbol = new Map<string, Transaction[]>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/"/g, '').trim()) || [];
        if (values.length < 5) continue;

        let date, symbol, type, qty, price;

        if (dateIdx === -1 || symbolIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
          [date, , , symbol, type, qty, price] = values;
        } else {
          date = values[dateIdx];
          symbol = values[symbolIdx];
          type = values[typeIdx];
          qty = values[qtyIdx];
          price = values[priceIdx];
        }

        let parsedDate: Date;
        if (date.includes('-')) {
          const parts = date.split('-');
          if (parts.length === 3 && parts[0].length === 2) {
            parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          } else {
            parsedDate = new Date(date);
          }
        } else {
          parsedDate = new Date(date);
        }

        const isBuy = type?.toUpperCase().includes('BUY') || type?.toUpperCase() === 'B';
        const transaction: Transaction = {
          date: parsedDate.toISOString().split('T')[0],
          price: parseFloat(price) || 0,
          quantity: parseInt(qty) || 0,
          isBuy,
        };

        if (!transactionsBySymbol.has(symbol)) transactionsBySymbol.set(symbol, []);
        transactionsBySymbol.get(symbol)!.push(transaction);
      } catch (e) {
        console.warn('Failed to parse CSV line:', lines[i], e);
      }
    }

    const tradeMap = new Map<string, ParsedCSVTrade>();

    for (const [symbol, transactions] of transactionsBySymbol) {
      transactions.sort((a, b) => a.date.localeCompare(b.date));

      const totalBuyQty = transactions.filter(t => t.isBuy).reduce((sum, t) => sum + t.quantity, 0);

      for (const txn of transactions) {
        if (txn.isBuy) {
          const key = `${symbol}_${txn.date}`;
          if (!tradeMap.has(key)) {
            tradeMap.set(key, { symbol, tradeType: 'LONG', entryDate: txn.date, entryPrice: txn.price, quantity: txn.quantity, exits: [] });
          } else {
            const existing = tradeMap.get(key)!;
            const newQty = existing.quantity + txn.quantity;
            existing.entryPrice = newQty > 0 ? (existing.entryPrice * existing.quantity + txn.price * txn.quantity) / newQty : txn.price;
            existing.quantity = newQty;
          }
        }
      }

      const sellTransactions = transactions.filter(t => !t.isBuy);
      let remainingBought = totalBuyQty;

      for (const txn of sellTransactions) {
        let matched = 0;
        if (remainingBought > 0) {
          matched = Math.min(remainingBought, txn.quantity);
          remainingBought -= matched;

          const entries = Array.from(tradeMap.entries())
            .filter(([key, t]) => key.startsWith(`${symbol}_`) && t.tradeType === 'LONG')
            .sort(([a], [b]) => b.localeCompare(a));

          if (entries.length > 0) {
            const [, trade] = entries[0];
            if (!trade.exits) trade.exits = [];
            const exitedQty = trade.exits.reduce((s, e) => s + e.quantity, 0);
            const available = trade.quantity - exitedQty;
            if (available > 0) {
              trade.exits.push({ exitDate: txn.date, exitPrice: txn.price, quantity: Math.min(matched, available) });
            }
          }
        }

        const unmatched = txn.quantity - matched;
        if (unmatched > 0) {
          const key = `${symbol}_${txn.date}_${txn.price}_SELL`;
          if (!tradeMap.has(key)) {
            tradeMap.set(key, { symbol, tradeType: 'LONG', entryDate: txn.date, entryPrice: txn.price, quantity: unmatched, exits: [{ exitDate: txn.date, exitPrice: txn.price, quantity: unmatched }] });
          } else {
            const existing = tradeMap.get(key)!;
            existing.quantity += unmatched;
            existing.exits?.push({ exitDate: txn.date, exitPrice: txn.price, quantity: unmatched });
          }
        }
      }
    }

    return Array.from(tradeMap.values());
  };

  const handleCSVImport = async () => {
    if (!csvFile) { toast.error('Please select a CSV file'); return; }

    setImporting(true);
    try {
      const text = await csvFile.text();
      const parsedTrades = parseKiteCSV(text);

      if (parsedTrades.length === 0) { toast.error('No valid trades found in CSV'); return; }

      const result = await onImportCSV(parsedTrades);
      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} new trades — ${result.skipped} already synced, skipped`);
      } else {
        toast.info(`All ${result.skipped} trades are already in your journal`);
      }
      setOpen(false);
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('CSV import error:', error);
      toast.error('Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { toast.error('Please select a CSV file'); return; }
    setCsvFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import from CSV</DialogTitle>
          <DialogDescription>
            Upload a Kite tradebook CSV to catch up on trades from days you missed syncing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Trades already in your journal are detected and skipped automatically — no duplicates.
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csvFile">Tradebook CSV</Label>
            <p className="text-xs text-muted-foreground">
              Export from Kite Console → Reports → Tradebook
            </p>
            <Input
              id="csvFile"
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            {csvFile && (
              <p className="text-xs text-muted-foreground">Selected: {csvFile.name}</p>
            )}
          </div>

          <Button onClick={handleCSVImport} disabled={!csvFile || importing} className="w-full">
            <Upload className="h-4 w-4 mr-2" />
            {importing ? 'Importing...' : 'Import Trades'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
