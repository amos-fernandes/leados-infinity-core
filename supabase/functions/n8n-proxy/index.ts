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

    console.log('🔄 Proxy request to n8n:', { url, method, bodyPreview: JSON.stringify(body).substring(0, 100) });

    if (!url) {
      throw new Error('URL é obrigatória');
    }

    const n8nApiKey = Deno.env.get('N8N_API_KEY');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (n8nApiKey) {
      headers['X-N8N-API-KEY'] = n8nApiKey;
    }

    console.log('📤 Sending request to:', url);

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    console.log('📥 n8n response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log('📄 Non-JSON response:', text.substring(0, 200));
      data = { rawResponse: text };
    }

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error in n8n proxy:', error);
    console.error('❌ Error stack:', error.stack);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        errorType: error.name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
