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

export interface ParsedCSVTrade {
  symbol: string;
  tradeType: 'LONG' | 'SHORT';
  entryDate: string;
  entryPrice: number;
  quantity: number;
  exitDate?: string;
  exitPrice?: number;
  exitQuantity?: number;
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

    const header = lines[0].toLowerCase();
    const isKiteFormat = header.includes('trade_date') || header.includes('symbol') || header.includes('trade_type');
    
    const trades: ParsedCSVTrade[] = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted values)
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/"/g, '').trim()) || [];
      
      if (values.length < 5) continue;

      try {
        // Expected Kite Console format columns:
        // trade_date, exchange, segment, symbol, trade_type, quantity, price, order_id, trade_id
        // Or similar variations
        
        // Try to detect columns by header
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

        if (dateIdx === -1 || symbolIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
          // Fallback: assume standard order
          const [date, , , symbol, type, qty, price] = values;
          
          const parsedDate = new Date(date);
          if (isNaN(parsedDate.getTime())) continue;

          const isBuy = type?.toUpperCase() === 'BUY' || type?.toUpperCase() === 'B';
          
          trades.push({
            symbol: symbol,
            tradeType: isBuy ? 'LONG' : 'SHORT',
            entryDate: parsedDate.toISOString().split('T')[0],
            entryPrice: parseFloat(price),
            quantity: Math.abs(parseInt(qty)),
          });
        } else {
          const date = values[dateIdx];
          const symbol = values[symbolIdx];
          const type = values[typeIdx];
          const qty = values[qtyIdx];
          const price = values[priceIdx];

          const parsedDate = new Date(date);
          if (isNaN(parsedDate.getTime())) continue;
          
          // Filter by fromDate
          if (parsedDate < new Date(fromDate)) continue;

          const isBuy = type?.toUpperCase() === 'BUY' || type?.toUpperCase() === 'B';
          
          trades.push({
            symbol: symbol.replace('-EQ', '').replace('-BE', ''),
            tradeType: isBuy ? 'LONG' : 'SHORT',
            entryDate: parsedDate.toISOString().split('T')[0],
            entryPrice: parseFloat(price),
            quantity: Math.abs(parseInt(qty)),
          });
        }
      } catch (e) {
        console.warn('Failed to parse CSV line:', line, e);
      }
    }

    return trades;
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