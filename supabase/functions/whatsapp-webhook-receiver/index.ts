import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Webhook Receiver para mensagens do WhatsApp
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📱 WhatsApp Webhook Receiver - Nova mensagem recebida');
    
    const body = await req.json();
    console.log('Webhook payload:', JSON.stringify(body, null, 2));

    // Extrair dados da mensagem (formato pode variar dependendo do provedor)
    const messageData = extractMessageData(body);
    
    if (!messageData) {
      console.log('❌ Mensagem não contém dados válidos');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Webhook recebido mas sem dados de mensagem válidos'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📥 Dados da mensagem extraídos:', messageData);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determinar userId (pode vir do webhook ou ser configurado)
    const userId = await determineUserId(messageData, supabase);
    
    if (!userId) {
      console.log('⚠️ UserId não determinado, salvando mensagem sem processamento');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'UserId não encontrado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Chamar o responder RAG
    const { data: ragResult, error: ragError } = await supabase.functions.invoke('whatsapp-rag-responder', {
      body: {
        action: 'processMessage',
        userId: userId,
        messageData: {
          phone: messageData.phone,
          message: messageData.message,
          senderName: messageData.senderName
        }
      }
    });

    if (ragError) {
      console.error('❌ Erro ao chamar RAG responder:', ragError);
      throw new Error(ragError.message);
    }

    console.log('✅ Mensagem processada com sucesso:', {
      conversationId: ragResult.conversationId,
      responseGenerated: !!ragResult.responseText,
      messageSent: ragResult.messageSent
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Mensagem processada e resposta enviada',
      conversationId: ragResult.conversationId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no webhook receiver:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Extrair dados da mensagem do webhook (adaptável para diferentes provedores)
function extractMessageData(webhookBody: any) {
  try {
    // Formato MayTapi
    if (webhookBody.type === 'message' && webhookBody.message) {
      return {
        phone: webhookBody.message.fromNumber || webhookBody.message.from,
        message: webhookBody.message.text || webhookBody.message.body,
        senderName: webhookBody.message.fromName || webhookBody.message.notifyName || 'Cliente',
        provider: 'maytapi'
      };
    }

    // Formato WhatsApp Business API
    if (webhookBody.entry && webhookBody.entry[0]?.changes) {
      const change = webhookBody.entry[0].changes[0];
      if (change.value?.messages && change.value.messages[0]) {
        const message = change.value.messages[0];
        return {
          phone: message.from,
          message: message.text?.body || message.body,
          senderName: change.value.contacts?.[0]?.profile?.name || 'Cliente',
          provider: 'whatsapp_business'
        };
      }
    }

    // Formato genérico
    if (webhookBody.phone && webhookBody.message) {
      return {
        phone: webhookBody.phone,
        message: webhookBody.message,
        senderName: webhookBody.senderName || 'Cliente',
        provider: 'generic'
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ao extrair dados da mensagem:', error);
    return null;
  }
}

// Determinar userId baseado na mensagem (pode ser implementado de várias formas)
async function determineUserId(messageData: any, supabase: any) {
  try {
    // Método 1: Buscar por configuração WhatsApp do usuário
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('user_id')
      .eq('phone_number', messageData.phone.substring(0, 13)) // Primeiros dígitos
      .eq('is_active', true)
      .single();

    if (config) {
      return config.user_id;
    }

    // Método 2: Buscar por conversação existente
    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('user_id')
      .eq('contact_phone', messageData.phone)
      .eq('status', 'ativa')
      .single();

    if (conversation) {
      return conversation.user_id;
    }

    // Método 3: Usar userId padrão (primeiro usuário do sistema - para demo)
    const { data: firstUser } = await supabase
      .from('profiles')
      .select('user_id')
      .limit(1)
      .single();

    if (firstUser) {
      console.log('⚠️ Usando primeiro usuário como fallback:', firstUser.user_id);
      return firstUser.user_id;
    }

    return null;
  } catch (error) {
    console.error('Erro ao determinar userId:', error);
    return null;
  }
}