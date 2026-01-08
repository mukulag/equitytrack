import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const KITE_API_KEY = Deno.env.get('KITE_API_KEY') || '';
const KITE_API_SECRET = Deno.env.get('KITE_API_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Action: Get login URL
    if (action === 'login-url') {
      const loginUrl = `https://kite.trade/connect/login?api_key=${KITE_API_KEY}&v=3`;
      return new Response(JSON.stringify({ login_url: loginUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Exchange request_token for access_token
    if (action === 'token') {
      const { request_token } = await req.json();
      
      if (!request_token) {
        return new Response(JSON.stringify({ error: 'request_token is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Exchanging request_token for access_token...');
      
      const formData = new URLSearchParams();
      formData.append('api_key', KITE_API_KEY);
      formData.append('request_token', request_token);
      formData.append('checksum', await generateChecksum(KITE_API_KEY, request_token, KITE_API_SECRET));

      const response = await fetch('https://api.kite.trade/session/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Kite-Version': '3',
        },
        body: formData.toString(),
      });

      const data = await response.json();
      console.log('Kite token response status:', response.status);
      
      if (!response.ok) {
        console.error('Kite API error:', data);
        return new Response(JSON.stringify({ error: data.message || 'Failed to get access token' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        access_token: data.data.access_token,
        user_id: data.data.user_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Fetch today's orders
    if (action === 'orders') {
      const accessToken = url.searchParams.get('access_token');
      
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'access_token is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Fetching orders from Kite...');
      
      const response = await fetch('https://api.kite.trade/orders', {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${KITE_API_KEY}:${accessToken}`,
        },
      });

      const data = await response.json();
      console.log('Kite orders response status:', response.status);
      
      if (!response.ok) {
        console.error('Kite orders error:', data);
        return new Response(JSON.stringify({ error: data.message || 'Failed to fetch orders' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ orders: data.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Fetch executed trades (for the day)
    if (action === 'trades') {
      const accessToken = url.searchParams.get('access_token');
      
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'access_token is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Fetching trades from Kite...');
      
      const response = await fetch('https://api.kite.trade/trades', {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${KITE_API_KEY}:${accessToken}`,
        },
      });

      const data = await response.json();
      console.log('Kite trades response status:', response.status);
      
      if (!response.ok) {
        console.error('Kite trades error:', data);
        return new Response(JSON.stringify({ error: data.message || 'Failed to fetch trades' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ trades: data.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Fetch holdings (current portfolio positions) with previous day low
    if (action === 'holdings') {
      const accessToken = url.searchParams.get('access_token');
      
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'access_token is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Fetching holdings from Kite...');
      
      const response = await fetch('https://api.kite.trade/portfolio/holdings', {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${KITE_API_KEY}:${accessToken}`,
        },
      });

      const data = await response.json();
      console.log('Kite holdings response status:', response.status);
      
      if (!response.ok) {
        console.error('Kite holdings error:', data);
        return new Response(JSON.stringify({ error: data.message || 'Failed to fetch holdings' }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch previous day's low for each holding
      const holdingsWithPrevLow = await Promise.all(
        (data.data || []).map(async (holding: any) => {
          try {
            const instrumentToken = holding.instrument_token;
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            // Skip weekends - find last trading day
            while (yesterday.getDay() === 0 || yesterday.getDay() === 6) {
              yesterday.setDate(yesterday.getDate() - 1);
            }
            
            const fromDate = yesterday.toISOString().split('T')[0];
            const toDate = fromDate;
            
            const histUrl = `https://api.kite.trade/instruments/historical/${instrumentToken}/day?from=${fromDate}&to=${toDate}`;
            console.log(`Fetching historical data for ${holding.tradingsymbol}: ${histUrl}`);
            
            const histResponse = await fetch(histUrl, {
              headers: {
                'X-Kite-Version': '3',
                'Authorization': `token ${KITE_API_KEY}:${accessToken}`,
              },
            });
            
            if (histResponse.ok) {
              const histData = await histResponse.json();
              // Historical data format: [timestamp, open, high, low, close, volume]
              if (histData.data?.candles?.length > 0) {
                const candle = histData.data.candles[0];
                return { ...holding, prev_day_low: candle[3] };
              }
            }
          } catch (err) {
            console.error(`Failed to fetch historical for ${holding.tradingsymbol}:`, err);
          }
          return { ...holding, prev_day_low: null };
        })
      );

      return new Response(JSON.stringify({ holdings: holdingsWithPrevLow }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in kite-auth function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Generate SHA256 checksum as required by Kite API
async function generateChecksum(apiKey: string, requestToken: string, apiSecret: string): Promise<string> {
  const data = apiKey + requestToken + apiSecret;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
