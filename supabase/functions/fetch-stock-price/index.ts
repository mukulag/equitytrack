import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StockQuote {
  symbol: string;
  price: number | null;
  error?: string;
}

async function fetchYahooPrice(symbol: string): Promise<StockQuote> {
  try {
    // Add .NS suffix for NSE stocks if not already present
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;
    
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

    // Get the most recent price
    const regularMarketPrice = quote.meta?.regularMarketPrice;
    const closePrice = quote.indicators?.quote?.[0]?.close?.filter((p: number | null) => p !== null).pop();
    
    const price = regularMarketPrice || closePrice;
    
    if (price === undefined || price === null) {
      return { symbol, price: null, error: 'Price not available' };
    }

    console.log(`Got price for ${symbol}: ${price}`);
    return { symbol, price: Number(price) };
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
