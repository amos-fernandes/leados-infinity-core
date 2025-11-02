import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, method = 'POST', body } = await req.json();

    console.log('🔄 Proxy request to n8n:', { url, method, body });

    if (!url) {
      throw new Error('URL é obrigatória');
    }

    const n8nApiKey = Deno.env.get('N8N_API_KEY');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (n8nApiKey) {
      headers['X-N8N-API-KEY'] = n8nApiKey;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log('✅ n8n response status:', response.status);

    const data = await response.json().catch(() => ({}));

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error in n8n proxy:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
