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

async function fetchIPODataFromChittorgarh(year: number = 2025): Promise<IPOData[]> {
  try {
    const url = `https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/mainboard/?year=${year}`;
    
    console.log(`Fetching IPO data from ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch IPO data: ${response.status}`);
      return [];
    }

    const html = await response.text();
    
    // Parse the HTML table to extract IPO data
    const ipos: IPOData[] = [];
    
    // Find table rows - look for the main table with IPO data
    const tableRegex = /<tr[^>]*>.*?<\/tr>/gs;
    const rows = html.match(tableRegex) || [];
    
    console.log(`Found ${rows.length} rows in HTML`);
    
    for (const row of rows) {
      try {
        // Extract cells from the row
        const cellRegex = /<td[^>]*>(.*?)<\/td>/gs;
        const cells = [];
        let cellMatch;
        
        while ((cellMatch = cellRegex.exec(row)) !== null) {
          // Clean up the cell content (remove HTML tags, entities, etc.)
          let content = cellMatch[1]
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&#039;/g, "'")
            .replace(/&quot;/g, '"')
            .trim();
          cells.push(content);
        }
        
        if (cells.length < 3) continue;
        
        // Typically the table structure is:
        // 0: Company Name, 1: Symbol, 2: Allotment Price, 3: Listing Date, 4: Listing Price, etc.
        // But this may vary, so we need to be flexible
        
        const company = cells[0];
        const symbol = cells[1]?.toUpperCase();
        
        // Try to extract prices and dates from remaining cells
        let allotmentPrice: number | null = null;
        let listingDate: string | null = null;
        let listingPrice: number | null = null;
        
        // Parse numeric values for prices
        for (let i = 2; i < cells.length; i++) {
          const cell = cells[i];
          const numValue = parseFloat(cell.replace(/[^\d.]/g, ''));
          
          if (!isNaN(numValue) && numValue > 0) {
            // Assume first price is allotment, second is listing price
            if (allotmentPrice === null) {
              allotmentPrice = numValue;
            } else if (listingPrice === null) {
              listingPrice = numValue;
            }
          }
          
          // Try to parse date (look for patterns like DD-Mon-YY or DD/MM/YYYY)
          if (listingDate === null && cell.match(/\d{1,2}[-\/]\w+[-\/]\d{2,4}/)) {
            // Parse date like "15-Jan-25" or "15/01/2025"
            const dateMatch = cell.match(/(\d{1,2})[-\/](\w+|\\d{1,2})[-\/](\d{2,4})/);
            if (dateMatch) {
              try {
                const day = dateMatch[1];
                const monthStr = dateMatch[2];
                const year = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
                
                // If month is numeric
                const monthNum = isNaN(parseInt(monthStr)) ? new Date(`${monthStr} 1, 2000`).getMonth() + 1 : parseInt(monthStr);
                const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // Validate the date
                if (!isNaN(new Date(dateStr).getTime())) {
                  listingDate = dateStr;
                }
              } catch (e) {
                console.warn(`Failed to parse date: ${cell}`);
              }
            }
          }
        }
        
        if (symbol && company) {
          ipos.push({
            symbol,
            company,
            allotmentPrice,
            listingDate,
            listingPrice,
          });
        }
      } catch (e) {
        console.warn(`Failed to parse row:`, e);
      }
    }
    
    console.log(`Extracted ${ipos.length} IPOs from HTML`);
    return ipos;
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
    console.log(`Fetching IPO data for year ${currentYear}`);

    // Fetch IPO data for the specified year
    const allIpos = await fetchIPODataFromChittorgarh(currentYear);
    
    // Filter to only the requested symbols
    const symbolSet = new Set(symbols.map((s: string) => s.toUpperCase()));
    const matchedIpos = allIpos.filter(ipo => symbolSet.has(ipo.symbol));
    
    console.log(`Matched ${matchedIpos.length} IPOs out of ${symbols.length} requested symbols`);
    
    // If no matches found for current year, try previous years
    if (matchedIpos.length === 0 && currentYear > 2020) {
      for (let y = currentYear - 1; y >= currentYear - 4; y--) {
        const previousYearIpos = await fetchIPODataFromChittorgarh(y);
        const matches = previousYearIpos.filter(ipo => symbolSet.has(ipo.symbol));
        if (matches.length > 0) {
          matchedIpos.push(...matches);
          console.log(`Found ${matches.length} IPOs in year ${y}`);
          if (matchedIpos.length >= symbols.length) break;
        }
      }
    }

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
