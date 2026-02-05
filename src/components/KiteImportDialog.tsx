import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface KiteImportDialogProps {
  kiteToken: string | null;
  onImportTodaysOrders: () => Promise<void>;
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

export function KiteImportDialog({ kiteToken, onImportTodaysOrders, onImportCSV, disabled }: KiteImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState('2025-11-01');
  const [importing, setImporting] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTodaysOrdersImport = async () => {
    if (!kiteToken) {
      toast.error('Please connect to Kite first');
      return;
    }
    setImporting(true);
    try {
      await onImportTodaysOrders();
      toast.success("Today's orders imported successfully");
    } catch (error) {
      toast.error("Failed to import today's orders");
    } finally {
      setImporting(false);
    }
  };

  const parseKiteCSV = (csvText: string): ParsedCSVTrade[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse header
    const headers = lines[0].split(',').map(h => h.toLowerCase().trim().replace(/"/g, ''));
    
    const getCol = (names: string[]): number => {
      for (const name of names) {
        const idx = headers.findIndex(h => h.includes(name));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    // Detect column indices
    const dateIdx = getCol(['trade_date', 'date', 'order_date']);
    const symbolIdx = getCol(['symbol', 'tradingsymbol', 'scrip']);
    const typeIdx = getCol(['trade_type', 'type', 'buy_sell', 'side']);
    const qtyIdx = getCol(['quantity', 'qty', 'traded_qty']);
    const priceIdx = getCol(['price', 'trade_price', 'avg_price', 'average_price']);
    
    // First pass: collect all buy and sell transactions per symbol
    interface Transaction {
      date: string;
      price: number;
      quantity: number;
      isBuy: boolean;
    }
    
    const transactionsBySymbol = new Map<string, Transaction[]>();
    
    // Parse each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Parse CSV line (handle quoted values)
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/"/g, '').trim()) || [];
        
        if (values.length < 5) continue;

        let date, symbol, type, qty, price;

        if (dateIdx === -1 || symbolIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
          // Fallback: assume standard order
          [date, , , symbol, type, qty, price] = values;
        } else {
          date = values[dateIdx];
          symbol = values[symbolIdx];
          type = values[typeIdx];
          qty = values[qtyIdx];
          price = values[priceIdx];
        }

          // Parse date - handle DD-MM-YYYY format
          let parsedDate: Date;
          if (date.includes('-')) {
            const parts = date.split('-');
            if (parts.length === 3 && parts[0].length === 2) {
              // DD-MM-YYYY format
              parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
              // Assume YYYY-MM-DD or other standard format
              parsedDate = new Date(date);
            }
          } else {
            parsedDate = new Date(date);
          }
          
        });
      } catch (e) {
        console.warn('Failed to parse CSV line:', line, e);
      }
    }
    
    // Second pass: analyze each symbol to detect IPO allotments
    const tradeMap = new Map<string, ParsedCSVTrade>();
    
    for (const [symbol, transactions] of transactionsBySymbol) {
      // Sort by date
      transactions.sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate total buy and sell quantities
      const totalBuyQty = transactions.filter(t => t.isBuy).reduce((sum, t) => sum + t.quantity, 0);
      const totalSellQty = transactions.filter(t => !t.isBuy).reduce((sum, t) => sum + t.quantity, 0);
      
      // NOTE: Automatic IPO detection removed as it was unreliable
      // Users should manually create IPO trades if needed
      const ipoAllotmentQty = 0;
      
      console.log(`Symbol ${symbol}: Buy=${totalBuyQty}, Sell=${totalSellQty}`);
      
      // Process transactions
      
      // Group buys into trades
      for (const txn of transactions) {
        if (txn.isBuy) {
          // Regular buy entry
          const key = `${symbol}_${txn.date}_${txn.price}`;
          if (!tradeMap.has(key)) {
            tradeMap.set(key, {
              symbol,
              tradeType: 'LONG',
              entryDate: txn.date,
              entryPrice: txn.price,
              quantity: txn.quantity,
              exits: [],
            });
          } else {
            const existing = tradeMap.get(key)!;
            existing.quantity += txn.quantity;
          }
        }
      }
      
      // Handle sell transactions - match to buys or create separate entries
      const sellTransactions = transactions.filter(t => !t.isBuy);
      let remainingBoughtForExits = totalBuyQty;
      
      for (const txn of sellTransactions) {
        // First, try to match sell to existing buy trades as exits
        let sellQtyMatched = 0;
        if (remainingBoughtForExits > 0) {
          sellQtyMatched = Math.min(remainingBoughtForExits, txn.quantity);
          remainingBoughtForExits -= sellQtyMatched;
          
          // Match sells to existing buy trades (exits)
          const entriesForSymbol = Array.from(tradeMap.entries())
            .filter(([key, trade]) => key.startsWith(`${symbol}_`) && trade.tradeType === 'LONG')
            .sort(([keyA], [keyB]) => keyB.localeCompare(keyA)); // Sort by date desc

          if (entriesForSymbol.length > 0) {
            const [, trade] = entriesForSymbol[0];
            if (!trade.exits) trade.exits = [];
            const existingExitQty = trade.exits.reduce((sum, e) => sum + e.quantity, 0);
            const remainingQty = trade.quantity - existingExitQty;
            if (remainingQty > 0) {
              trade.exits.push({
                exitDate: txn.date,
                exitPrice: txn.price,
                quantity: Math.min(sellQtyMatched, remainingQty),
              });
            }
          }
        }
        
        // Handle unmatched sell quantity (sell-only transactions)
        const unmatchedSellQty = txn.quantity - sellQtyMatched;
        if (unmatchedSellQty > 0) {
          // Create a LONG trade entry for unmatched sells
          // These will need manual entry price adjustment later
          const key = `${symbol}_${txn.date}_${txn.price}_SELL`;
          if (!tradeMap.has(key)) {
            tradeMap.set(key, {
              symbol,
              tradeType: 'LONG',
              entryDate: txn.date,
              entryPrice: txn.price,
              quantity: unmatchedSellQty,
              exits: [{
                exitDate: txn.date,
                exitPrice: txn.price,
                quantity: unmatchedSellQty,
              }],
            });
          } else {
            const existing = tradeMap.get(key)!;
            existing.quantity += unmatchedSellQty;
            if (!existing.exits) existing.exits = [];
            existing.exits.push({
              exitDate: txn.date,
              exitPrice: txn.price,
              quantity: unmatchedSellQty,
            });
          }
        }
      }
    }

    const result = Array.from(tradeMap.values());
    console.log('CSV Parsing complete. Parsed trades:', JSON.stringify(result, null, 2));
    return result;
  };

  const handleCSVImport = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setImporting(true);
    try {
      const text = await csvFile.text();
      const parsedTrades = parseKiteCSV(text);
      
      if (parsedTrades.length === 0) {
        toast.error('No valid trades found in CSV');
        return;
      }

      const result = await onImportCSV(parsedTrades);
      toast.success(`Imported ${result.imported} trades (${result.skipped} skipped)`);
      setOpen(false);
      setCsvFile(null);
    } catch (error) {
      console.error('CSV import error:', error);
      toast.error('Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setCsvFile(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Upload className="h-4 w-4 mr-2" />
          Import Trades
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Trades</DialogTitle>
          <DialogDescription>
            Import trades from Kite or upload a CSV file from Kite Console.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Today's Orders Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Today's Orders (via API)</h3>
            <p className="text-xs text-muted-foreground">
              Import all executed orders from today via Kite API.
            </p>
            <Button 
              onClick={handleTodaysOrdersImport} 
              disabled={!kiteToken || importing}
              className="w-full"
              variant="secondary"
            >
              <Download className="h-4 w-4 mr-2" />
              {importing ? 'Importing...' : "Import Today's Orders"}
            </Button>
            {!kiteToken && (
              <p className="text-xs text-muted-foreground">
                Connect to Kite first to use this feature.
              </p>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* CSV Upload Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Historical Trades (CSV Upload)</h3>
            <p className="text-xs text-muted-foreground">
              Upload a CSV file exported from Kite Console → Reports → Tradebook.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="fromDate">Import trades from</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csvFile">CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              {csvFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {csvFile.name}
                </p>
              )}
            </div>

            <Button 
              onClick={handleCSVImport} 
              disabled={!csvFile || importing}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {importing ? 'Importing...' : 'Import from CSV'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}