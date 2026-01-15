import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StockQuote {
  symbol: string;
  price: number | null;
  low?: number | null;
  high?: number | null;
  open?: number | null;
  close?: number | null;
  error?: string;
  lows?: (number | null)[];
  highs?: (number | null)[];
  opens?: (number | null)[];
  closes?: (number | null)[];
}

async function fetchYahooPrice(symbol: string, targetDate?: string): Promise<StockQuote> {
  try {
    // Add .NS suffix for NSE stocks if not already present
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    
    // If targetDate is provided, fetch historical data; otherwise fetch recent 5 days
    let url: string;
    if (targetDate) {
      // Convert date to Unix timestamps for Yahoo Finance
      const targetDateObj = new Date(targetDate);
      const startOfDay = new Date(targetDateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDateObj);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Add buffer days before and after to ensure we get the data
      const period1 = Math.floor(startOfDay.getTime() / 1000) - 86400; // 1 day before
      const period2 = Math.floor(endOfDay.getTime() / 1000) + 86400; // 1 day after
      
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&period1=${period1}&period2=${period2}`;
    } else {
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`;
    }
    
    console.log(`Fetching price for ${yahooSymbol} from Yahoo Finance`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Yahoo API error for ${symbol}: ${response.status}`);
      return { symbol, price: null, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    
    const quote = data?.chart?.result?.[0];
    if (!quote) {
      console.error(`No data found for ${symbol}`);
      return { symbol, price: null, error: 'Symbol not found' };
    }

    // Get the candle data
    const timestamps = quote.timestamp || [];
    const opens = quote.indicators?.quote?.[0]?.open || [];
    const highs = quote.indicators?.quote?.[0]?.high || [];
    const lows = quote.indicators?.quote?.[0]?.low || [];
    const closes = quote.indicators?.quote?.[0]?.close || [];
    
    // If targetDate is provided, find the candle for that specific date
    let idx = timestamps.length - 1;
    if (targetDate) {
      const targetDateStr = targetDate.split('T')[0];
      idx = timestamps.findIndex((ts: number) => {
        const date = new Date(ts * 1000).toISOString().split('T')[0];
        return date === targetDateStr;
      });
      if (idx === -1) {
        // If exact date not found, use the closest available
        idx = timestamps.length - 1;
      }
    } else {
      // Get the most recent valid data point
      while (idx >= 0 && (closes[idx] === null || closes[idx] === undefined)) {
        idx--;
      }
    }

    if (idx < 0) {
      return { symbol, price: null, error: 'No valid price data' };
    }

    const price = closes[idx];
    const open = opens[idx];
    const high = highs[idx];
    const low = lows[idx];
    
    console.log(`Got price for ${symbol}${targetDate ? ` on ${targetDate}` : ''}: ${price}, Open: ${open}, High: ${high}, Low: ${low}`);
    return {
      symbol,
      price: Number(price),
      open: open !== null && open !== undefined ? Number(open) : null,
      high: high !== null && high !== undefined ? Number(high) : null,
      low: low !== null && low !== undefined ? Number(low) : null,
      close: Number(price),
      lows: lows,
      highs: highs,
      opens: opens,
      closes: closes
    };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return { symbol, price: null, error: String(error) };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols, date } = await req.json();
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Please provide an array of symbols' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching prices for ${symbols.length} symbols${date ? ` for date ${date}` : ''}:`, symbols);

    // Fetch all prices in parallel, optionally for a specific date
    const quotes = await Promise.all(symbols.map((s: string) => fetchYahooPrice(s, date)));
    
    // Convert to a map for easy lookup
    const priceMap: Record<string, number | null> = {};
    quotes.forEach(q => {
      priceMap[q.symbol] = q.price;
    });

    console.log('Price results:', priceMap);

    return new Response(
      JSON.stringify({ prices: priceMap, quotes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-stock-price:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
