import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IPOData {
  symbol: string;
  company: string;
  allotmentPrice: number | null;
  listingDate: string | null;
  listingPrice: number | null;
  error?: string;
}

async function fetchIPODataWithAI(symbols: string[], year: number): Promise<IPOData[]> {
  try {
    const url = `https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/mainboard/?year=${year}`;
    
    console.log(`Fetching IPO page from ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch IPO page: ${response.status}`);
      return [];
    }

    const html = await response.text();
    console.log(`Fetched HTML (${html.length} chars)`);
    
    // Extract the main table content - look for IPO data patterns
    // The site uses client-side rendering, but we can try to find pre-rendered content
    // or use a simpler regex approach for the table structure
    
    const symbolList = symbols.map(s => s.toUpperCase()).join(', ');
    
    // Use AI to extract IPO data from the HTML
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return [];
    }
    
    // Truncate HTML to avoid token limits - focus on table data
    let relevantHtml = html;
    
    // Try to find table sections
    const tableMatch = html.match(/<table[^>]*class[^>]*data[^>]*>[\s\S]*?<\/table>/gi);
    if (tableMatch && tableMatch.length > 0) {
      relevantHtml = tableMatch.join('\n');
      console.log(`Found ${tableMatch.length} data tables`);
    } else {
      // Fallback: limit HTML size
      relevantHtml = html.substring(0, 50000);
    }
    
    const prompt = `Extract ALL IPO data from this HTML page from chittorgarh.com for year ${year}. 

This page shows a table with columns: Company, Opening Date, Closing Date, Listing Date, Issue Price, Total Issue Amount, Listing at, Lead Manager.

Extract ALL IPOs from the table with their data:
- company: Full company name (e.g., "LG Electronics India Ltd.", "Emmvee Photovoltaic Power Ltd.")
- nseSymbol: NSE trading symbol if visible, or try to derive from company name (e.g., LG Electronics India → LGEINDIA, Emmvee → EMMVEE)
- allotmentPrice: The Issue Price column value. If it shows a range like "₹1080-₹1140", use the HIGHER number (1140). Must be a realistic share price.
- listingDate: The Listing Date column (format: YYYY-MM-DD)

IMPORTANT RULES:
1. Extract every IPO row from the table that has data
2. The NSE symbol is usually the company name abbreviated (LG Electronics = LGEINDIA, ICICI Prudential AMC = ICICIAMC)
3. Issue Price for mainboard IPOs is typically between 100 and 5000 rupees
4. If a row has no Issue Price yet, skip it
5. Return ALL IPOs you find, I will filter to the ones I need

I'm looking for these symbols specifically: ${symbolList}

Return ONLY a valid JSON array with objects containing: company, nseSymbol, allotmentPrice, listingDate.
No markdown formatting, no explanation text, just the JSON array.

HTML:
${relevantHtml}`;

    console.log(`Calling AI to extract IPO data for: ${symbolList}`);
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a data extraction assistant. Extract structured IPO data from HTML tables. Return only valid JSON arrays with no markdown formatting or extra text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`AI request failed: ${aiResponse.status}`, errorText);
      return [];
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content);
    
    // Parse the JSON response
    try {
      // Clean up the response - remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const rawIpos = JSON.parse(jsonStr) as Array<{
        company?: string;
        symbol?: string;
        nseSymbol?: string;
        allotmentPrice?: number;
        listingDate?: string;
        listingPrice?: number;
      }>;
      
      // Normalize the response - handle both 'symbol' and 'nseSymbol' fields
      const ipos: IPOData[] = rawIpos.map(ipo => ({
        symbol: (ipo.symbol || ipo.nseSymbol || '').toUpperCase(),
        company: ipo.company || '',
        allotmentPrice: ipo.allotmentPrice || null,
        listingDate: ipo.listingDate || null,
        listingPrice: ipo.listingPrice || null,
      }));
      
      console.log(`Extracted ${ipos.length} IPOs from AI response`);
      console.log('IPO symbols found:', ipos.map(i => `${i.symbol} (${i.company}) @ ${i.allotmentPrice}`));
      return ipos;
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error fetching IPO data:', error);
    return [];
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols, year } = await req.json();
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Please provide an array of symbols' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentYear = year || new Date().getFullYear();
    console.log(`Fetching IPO data for symbols: ${symbols.join(', ')} for year ${currentYear}`);

    // Try current year first
    let matchedIpos = await fetchIPODataWithAI(symbols, currentYear);
    
    // Filter to only the requested symbols
    const symbolSet = new Set(symbols.map((s: string) => s.toUpperCase()));
    matchedIpos = matchedIpos.filter(ipo => symbolSet.has(ipo.symbol?.toUpperCase()));
    
    console.log(`Found ${matchedIpos.length} matching IPOs for current year`);
    
    // If some symbols not found, try previous years
    const foundSymbols = new Set(matchedIpos.map(ipo => ipo.symbol?.toUpperCase()));
    const missingSymbols = symbols.filter((s: string) => !foundSymbols.has(s.toUpperCase()));
    
    if (missingSymbols.length > 0 && currentYear > 2020) {
      console.log(`Searching for missing symbols in previous years: ${missingSymbols.join(', ')}`);
      
      for (let y = currentYear - 1; y >= currentYear - 5; y--) {
        if (missingSymbols.length === 0) break;
        
        const previousYearIpos = await fetchIPODataWithAI(missingSymbols, y);
        const matches = previousYearIpos.filter(ipo => 
          missingSymbols.some(s => s.toUpperCase() === ipo.symbol?.toUpperCase())
        );
        
        if (matches.length > 0) {
          console.log(`Found ${matches.length} IPOs in year ${y}`);
          matchedIpos.push(...matches);
          
          // Remove found symbols from missing list
          for (const match of matches) {
            const idx = missingSymbols.findIndex(s => s.toUpperCase() === match.symbol?.toUpperCase());
            if (idx !== -1) missingSymbols.splice(idx, 1);
          }
        }
      }
    }

    console.log(`Returning ${matchedIpos.length} IPOs total`);

    return new Response(
      JSON.stringify({ ipos: matchedIpos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-ipo-data:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
