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

    // Action: Fetch orders
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
