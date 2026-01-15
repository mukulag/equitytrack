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
}

async function fetchYahooPrice(symbol: string): Promise<StockQuote> {
  try {
    // Add .NS suffix for NSE stocks if not already present
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`;
    
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

    // Get the most recent candle data
    const timestamps = quote.timestamp || [];
    const opens = quote.indicators?.quote?.[0]?.open || [];
    const highs = quote.indicators?.quote?.[0]?.high || [];
    const lows = quote.indicators?.quote?.[0]?.low || [];
    const closes = quote.indicators?.quote?.[0]?.close || [];
    
    // Get the most recent valid data point
    let lastIdx = timestamps.length - 1;
    while (lastIdx >= 0 && (closes[lastIdx] === null || closes[lastIdx] === undefined)) {
      lastIdx--;
    }

    if (lastIdx < 0) {
      return { symbol, price: null, error: 'No valid price data' };
    }

    const price = closes[lastIdx];
    const open = opens[lastIdx];
    const high = highs[lastIdx];
    const low = lows[lastIdx];
    
    console.log(`Got price for ${symbol}: ${price}, Open: ${open}, High: ${high}, Low: ${low}`);
    return { 
      symbol, 
      price: Number(price),
      open: open !== null && open !== undefined ? Number(open) : null,
      high: high !== null && high !== undefined ? Number(high) : null,
      low: low !== null && low !== undefined ? Number(low) : null,
      close: Number(price)
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
    const { symbols } = await req.json();
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Please provide an array of symbols' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching prices for ${symbols.length} symbols:`, symbols);

    // Fetch all prices in parallel
    const quotes = await Promise.all(symbols.map(fetchYahooPrice));
    
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
