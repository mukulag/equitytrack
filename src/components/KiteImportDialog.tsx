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
    
    // Map trades by (symbol, entryDate, entryPrice) to link entries and exits
    const tradeMap = new Map<string, ParsedCSVTrade>();
    
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

        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) continue;
        
        // Filter by fromDate
        if (parsedDate < new Date(fromDate)) continue;

        const isBuy = type?.toUpperCase() === 'BUY' || type?.toUpperCase() === 'B';
        const cleanSymbol = symbol.replace('-EQ', '').replace('-BE', '');
        const quantity = Math.abs(parseInt(qty));
        const priceNum = parseFloat(price);
        const dateStr = parsedDate.toISOString().split('T')[0];
        
        // Create a key to group entry and exit
        // If isBuy (entry), store it; if !isBuy (exit), find and add to corresponding entry
        if (isBuy) {
          // This is an entry
          const key = `${cleanSymbol}_${dateStr}_${priceNum}`;
          if (!tradeMap.has(key)) {
            tradeMap.set(key, {
              symbol: cleanSymbol,
              tradeType: 'LONG',
              entryDate: dateStr,
              entryPrice: priceNum,
              quantity: quantity,
              exits: [],
            });
          } else {
            // Merge quantities if same entry
            const existing = tradeMap.get(key)!;
            existing.quantity += quantity;
          }
        } else {
          // This is an exit - try to find the most recent entry for this symbol
          const entriesForSymbol = Array.from(tradeMap.entries())
            .filter(([key]) => key.startsWith(cleanSymbol + '_'))
            .sort(([keyA], [keyB]) => keyB[0].localeCompare(keyA[0])); // Sort by date desc

          if (entriesForSymbol.length > 0) {
            const [, trade] = entriesForSymbol[0];
            if (!trade.exits) trade.exits = [];
            // Check if this quantity is already accounted for
            const existingExitQty = (trade.exits || []).reduce((sum, e) => sum + e.quantity, 0);
            const remainingQty = trade.quantity - existingExitQty;
            if (remainingQty > 0) {
              const exitQty = Math.min(quantity, remainingQty);
              (trade.exits || []).push({
                exitDate: dateStr,
                exitPrice: priceNum,
                quantity: exitQty,
              });
            }
          } else {
            // No entry found: treat as IPO/Sell-only entry
            // Store the sell as an exit - entry date/price will be fetched from IPO data
            const key = `IPO_${cleanSymbol}`;
            if (!tradeMap.has(key)) {
              tradeMap.set(key, {
                symbol: cleanSymbol,
                tradeType: 'IPO',
                entryDate: dateStr, // Placeholder - will be replaced with listing date
                entryPrice: 0, // Placeholder - will be replaced with allotment price (upper band)
                quantity: quantity,
                exits: [{
                  exitDate: dateStr,
                  exitPrice: priceNum,
                  quantity: quantity,
                }],
                notes: 'IPO trade - fetching allotment price from chittorgarh.com',
              });
            } else {
              // Add to existing IPO entry
              const existing = tradeMap.get(key)!;
              existing.quantity += quantity;
              if (!existing.exits) existing.exits = [];
              existing.exits.push({
                exitDate: dateStr,
                exitPrice: priceNum,
                quantity: quantity,
              });
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse CSV line:', line, e);
      }
    }

    return Array.from(tradeMap.values());
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