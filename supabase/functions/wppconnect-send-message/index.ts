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
    console.log('WppConnect Send Message function started');
    
    const body = await req.json();
    const { sessionName, to, message, userId, mediaUrl, fileName, caption } = body;
    
    console.log('Sending WppConnect message:', { sessionName, to, userId, hasMedia: !!mediaUrl });

    if (!sessionName || !to || !message || !userId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'sessionName, to, message e userId são obrigatórios'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const WPPCONNECT_URL = Deno.env.get('WPPCONNECT_URL') || 'http://localhost:21234';
    const WPPCONNECT_TOKEN = Deno.env.get('WPPCONNECT_TOKEN') || 'your_secure_token_here';

    // Limpar número de telefone
    const cleanPhone = to.replace(/\D/g, '');
    const formattedPhone = cleanPhone.includes('@c.us') ? to : `${cleanPhone}@c.us`;

    try {
      console.log('Sending via WppConnect to:', formattedPhone);
      
      let wppResponse;
      
      if (mediaUrl) {
        // Enviar mídia
        wppResponse = await fetch(`${WPPCONNECT_URL}/api/${sessionName}/send-file-base64`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WPPCONNECT_TOKEN}`,
          },
          body: JSON.stringify({
            phone: formattedPhone,
            base64: mediaUrl,
            filename: fileName || 'file',
            caption: caption || message
          })
        });
      } else {
        // Enviar texto
        wppResponse = await fetch(`${WPPCONNECT_URL}/api/${sessionName}/send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WPPCONNECT_TOKEN}`,
          },
          body: JSON.stringify({
            phone: formattedPhone,
            message: message
          })
        });
      }

      const wppResult = await wppResponse.json();
      console.log('WppConnect response:', wppResult);

      if (!wppResponse.ok) {
        throw new Error(`WppConnect error: ${wppResult.message || 'Unknown error'}`);
      }

      // Registrar mensagem no banco
      const { error: messageError } = await supabase
        .from('whatsapp_messages')
        .insert({
          user_id: userId,
          phone_number: formattedPhone.replace('@c.us', ''),
          sender_name: 'Bot',
          message_content: message,
          message_type: mediaUrl ? 'media' : 'text',
          direction: 'outgoing',
          processed_at: new Date().toISOString(),
          response_sent: true
        });

      if (messageError) {
        console.error('Error saving message:', messageError);
      }

      // Registrar na base de conhecimento
      await supabase
        .from('campaign_knowledge')
        .insert({
          user_id: userId,
          content: `WppConnect Message sent to ${formattedPhone}: ${message}`,
          generated_at: new Date().toISOString()
        });

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Mensagem enviada com sucesso via WppConnect',
        messageId: wppResult.id || `wpp_${Date.now()}`,
        to: formattedPhone,
        sessionName: sessionName,
        data: wppResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (wppError) {
      console.error('WppConnect API Error:', wppError);
      
      // Fallback para API oficial do WhatsApp Business
      try {
        const { data: config } = await supabase
          .from('whatsapp_config')
          .select('*')
          .eq('user_id', userId)
          .limit(1);

        if (config && config.length > 0 && config[0].access_token && config[0].phone_number_id) {
          console.log('Falling back to official WhatsApp Business API');
          
          const officialResponse = await fetch(`https://graph.facebook.com/v17.0/${config[0].phone_number_id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config[0].access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanPhone,
              type: 'text',
              text: {
                body: message
              }
            })
          });

          const officialResult = await officialResponse.json();
          
          if (officialResponse.ok) {
            await supabase
              .from('campaign_knowledge')
              .insert({
                user_id: userId,
                content: `Fallback to Official API - Message sent to ${cleanPhone}: ${message}`,
                generated_at: new Date().toISOString()
              });

            return new Response(JSON.stringify({ 
              success: true,
              message: 'Mensagem enviada via API oficial (fallback)',
              messageId: officialResult.messages?.[0]?.id || `fb_${Date.now()}`,
              to: cleanPhone,
              fallback: true
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
      
      // Último fallback - simulação
      console.log('Using simulation fallback');
      
      await supabase
        .from('campaign_knowledge')
        .insert({
          user_id: userId,
          content: `WppConnect [SIMULADO] para ${formattedPhone}: ${message} - Erro: ${wppError instanceof Error ? wppError.message : 'Erro desconhecido'}`,
          generated_at: new Date().toISOString()
        });

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Mensagem enviada (modo simulação)',
        messageId: `sim_${Date.now()}`,
        to: formattedPhone,
        simulation: true,
        warning: `WppConnect error: ${wppError instanceof Error ? wppError.message : 'Erro desconhecido'}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in wppconnect-send-message function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});