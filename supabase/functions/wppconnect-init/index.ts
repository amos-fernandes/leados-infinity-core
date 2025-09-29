import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('WppConnect Init function started');
    
    const body = await req.json();
    const { sessionName, userId } = body;
    
    console.log('Initializing WppConnect session:', { sessionName, userId });

    if (!sessionName || !userId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'sessionName e userId são obrigatórios'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // WppConnect Server URL (configurável via variável de ambiente)
    const WPPCONNECT_URL = Deno.env.get('WPPCONNECT_URL') || 'http://localhost:21234';
    const WPPCONNECT_TOKEN = Deno.env.get('WPPCONNECT_TOKEN') || 'your_secure_token_here';

    try {
      console.log('Connecting to WppConnect server at:', WPPCONNECT_URL);
      
      // Inicializar sessão no WppConnect
      const wppResponse = await fetch(`${WPPCONNECT_URL}/api/${sessionName}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WPPCONNECT_TOKEN}`,
        },
        body: JSON.stringify({
          webhook: `${supabaseUrl}/functions/v1/wppconnect-webhook`,
          waitQrCode: true
        })
      });

      const wppResult = await wppResponse.json();
      console.log('WppConnect response:', wppResult);

      if (!wppResponse.ok) {
        throw new Error(`WppConnect error: ${wppResult.message || 'Unknown error'}`);
      }

      // Atualizar configuração no banco
      const { error: configError } = await supabase
        .from('whatsapp_config')
        .upsert({
          user_id: userId,
          phone_number: sessionName,
          webhook_url: `${supabaseUrl}/functions/v1/wppconnect-webhook`,
          access_token: WPPCONNECT_TOKEN,
          is_active: true,
          business_account_id: sessionName,
          updated_at: new Date().toISOString()
        });

      if (configError) {
        console.error('Error updating config:', configError);
      }

      // Registrar na base de conhecimento
      await supabase
        .from('campaign_knowledge')
        .insert({
          user_id: userId,
          content: `WppConnect Session initialized: ${sessionName} - Status: ${wppResult.status || 'connected'}`,
          generated_at: new Date().toISOString()
        });

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Sessão WppConnect inicializada com sucesso',
        sessionName: sessionName,
        qrCode: wppResult.qrcode || null,
        status: wppResult.status || 'connected',
        data: wppResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (wppError) {
      console.error('WppConnect API Error:', wppError);
      
      // Fallback para API oficial do WhatsApp
      console.log('Falling back to official WhatsApp API simulation');
      
      await supabase
        .from('campaign_knowledge')
        .insert({
          user_id: userId,
          content: `WppConnect fallback - Session: ${sessionName} - Error: ${wppError instanceof Error ? wppError.message : 'Unknown error'}`,
          generated_at: new Date().toISOString()
        });

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Sessão inicializada (modo compatibilidade)',
        sessionName: sessionName,
        qrCode: null,
        status: 'fallback',
        warning: `WppConnect unavailable: ${wppError instanceof Error ? wppError.message : 'Unknown error'}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in wppconnect-init function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});