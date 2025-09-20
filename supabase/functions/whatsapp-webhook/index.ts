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
    console.log('WhatsApp Webhook function started');
    console.log('Request method:', req.method);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificação do webhook (GET) - para configuração inicial do webhook
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      
      console.log('Webhook verification:', { mode, token, challenge });
      
      // Token de verificação - deve ser configurado no WhatsApp Business API
      const VERIFY_TOKEN = 'UNICA_CONTABIL_WEBHOOK_TOKEN';
      
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verified successfully');
        return new Response(challenge, {
          headers: { 'Content-Type': 'text/plain' }
        });
      } else {
        console.log('Webhook verification failed');
        return new Response('Forbidden', { status: 403 });
      }
    }

    // Processamento de mensagens recebidas (POST)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Received WhatsApp webhook:', JSON.stringify(body, null, 2));

      // Estrutura esperada do webhook do WhatsApp Business API
      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              const value = change.value;
              
              // Processar mensagens recebidas
              for (const message of value.messages || []) {
                await processIncomingMessage(message, value, supabase);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('Error in whatsapp-webhook function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processIncomingMessage(message: any, value: any, supabase: any) {
  try {
    console.log('Processing incoming message:', message);

    const phoneNumber = message.from;
    const messageText = message.text?.body || '';
    const messageType = message.type || 'text';
    
    // Buscar informações do contato
    const contacts = value.contacts || [];
    const contact = contacts.find((c: any) => c.wa_id === phoneNumber);
    const senderName = contact?.profile?.name || `Cliente ${phoneNumber.slice(-4)}`;

    console.log('Message details:', {
      phoneNumber,
      senderName,
      messageText,
      messageType
    });

    // Buscar configuração ativa do WhatsApp para determinar o usuário
    const { data: activeConfigs } = await supabase
      .from('whatsapp_config')
      .select('user_id')
      .eq('is_active', true)
      .limit(1);

    if (!activeConfigs || activeConfigs.length === 0) {
      console.log('No active WhatsApp config found');
      return;
    }

    const userId = activeConfigs[0].user_id;
    console.log('Found active user:', userId);

    // Armazenar mensagem recebida
    const { error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        user_id: userId,
        phone_number: phoneNumber,
        sender_name: senderName,
        message_content: messageText,
        message_type: messageType,
        processed: false,
        response_sent: false
      });

    if (insertError) {
      console.error('Error storing message:', insertError);
      return;
    }

    console.log('Message stored successfully');

    // Chamar o bot responder para gerar resposta automática
    const { data: botResponse, error: botError } = await supabase.functions.invoke('whatsapp-bot-responder', {
      body: {
        message: messageText,
        phoneNumber: phoneNumber,
        clientName: senderName,
        userId: userId
      }
    });

    if (botError) {
      console.error('Error calling bot responder:', botError);
      return;
    }

    console.log('Bot response generated:', botResponse);

    // Aqui você integraria com a API do WhatsApp Business para enviar a resposta
    // Por enquanto, apenas registramos que a resposta foi gerada
    await supabase
      .from('whatsapp_messages')
      .update({ 
        processed: true,
        response_sent: true 
      })
      .eq('phone_number', phoneNumber)
      .eq('message_content', messageText);

    console.log('Message processing completed');

  } catch (error) {
    console.error('Error processing incoming message:', error);
  }
}