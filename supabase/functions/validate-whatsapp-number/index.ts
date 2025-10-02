import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { phone, phoneNumberId } = await req.json();
    
    if (!phone || !phoneNumberId) {
      return new Response(JSON.stringify({ 
        error: 'Parâmetros obrigatórios: phone, phoneNumberId' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = Deno.env.get('FACEBOOK_ACCESS_TOKEN');
    if (!accessToken) {
      return new Response(JSON.stringify({ 
        error: 'Facebook Access Token não configurado' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Formatar número (remover caracteres especiais e adicionar código do país se necessário)
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    console.log('Validating WhatsApp number:', formattedPhone);

    // Validar usando WhatsApp Business API
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: 'hello_world', // Template padrão para validação
          language: {
            code: 'pt_BR'
          }
        }
      })
    });

    const result = await response.json();
    
    if (response.ok && result.messages) {
      // Número válido
      return new Response(JSON.stringify({
        valid: true,
        phone: formattedPhone,
        messageId: result.messages[0]?.id,
        message: 'Número WhatsApp válido e ativo'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Número inválido ou erro
      console.log('WhatsApp validation failed:', result);
      return new Response(JSON.stringify({
        valid: false,
        phone: formattedPhone,
        error: result.error?.message || 'Número não possui WhatsApp ativo',
        details: result
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error validating WhatsApp number:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      valid: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});