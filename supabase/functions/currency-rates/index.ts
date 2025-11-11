import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExchangeRatesResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const base = url.searchParams.get('base') || 'USD';
    const symbols = url.searchParams.get('symbols') || '';

    let apiUrl = `https://api.frankfurter.dev/v1/latest?base=${base}`;
    if (symbols) {
      apiUrl += `&symbols=${symbols}`;
    }

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.status}`);
    }

    const data: ExchangeRatesResponse = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        base: data.base,
        date: data.date,
        rates: data.rates,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching currency rates:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});