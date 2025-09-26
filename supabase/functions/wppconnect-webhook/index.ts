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
    console.log('WppConnect Webhook function started');
    console.log('Request method:', req.method);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Received WppConnect webhook:', JSON.stringify(body, null, 2));

      // Estrutura esperada do WppConnect webhook
      if (body.event === 'message' && body.data) {
        await processIncomingMessage(body.data, supabase);
      } else if (body.event === 'qr') {
        await processQRCode(body.data, supabase);
      } else if (body.event === 'ready') {
        await processSessionReady(body.data, supabase);
      } else if (body.event === 'disconnected') {
        await processSessionDisconnected(body.data, supabase);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('Error in wppconnect-webhook function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processIncomingMessage(messageData: any, supabase: any) {
  try {
    console.log('Processing incoming message:', messageData);

    const phoneNumber = messageData.from || messageData.chatId;
    const messageText = messageData.body || messageData.content || '';
    const messageType = messageData.type || 'text';
    const senderName = messageData.pushname || messageData.notifyName || `Cliente ${phoneNumber.slice(-4)}`;

    console.log('Message details:', {
      phoneNumber,
      senderName,
      messageText,
      messageType
    });

    // Buscar configuração ativa do WhatsApp para determinar o usuário
    const { data: activeConfigs } = await supabase
      .from('whatsapp_config')
      .select('user_id, business_account_id')
      .eq('is_active', true);

    if (!activeConfigs || activeConfigs.length === 0) {
      console.log('No active WhatsApp config found');
      return;
    }

    // Determinar qual usuário corresponde à sessão
    const sessionName = messageData.session || messageData.sessionName;
    let userId = activeConfigs[0].user_id;

    if (sessionName) {
      const matchingConfig = activeConfigs.find((config: any) => 
        config.business_account_id === sessionName
      );
      if (matchingConfig) {
        userId = matchingConfig.user_id;
      }
    }

    console.log('Found active user:', userId);

    // Armazenar mensagem recebida
    const { error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        user_id: userId,
        phone_number: phoneNumber.replace('@c.us', ''),
        sender_name: senderName,
        message_content: messageText,
        message_type: messageType,
        direction: 'incoming',
        processed_at: new Date().toISOString(),
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
        userId: userId,
        sessionName: sessionName
      }
    });

    if (botError) {
      console.error('Error calling bot responder:', botError);
      return;
    }

    console.log('Bot response generated:', botResponse);

    // Marcar mensagem como processada
    await supabase
      .from('whatsapp_messages')
      .update({ 
        processed_at: new Date().toISOString(),
        response_sent: true 
      })
      .eq('phone_number', phoneNumber.replace('@c.us', ''))
      .eq('message_content', messageText);

    console.log('Message processing completed');

  } catch (error) {
    console.error('Error processing incoming message:', error);
  }
}

async function processQRCode(qrData: any, supabase: any) {
  try {
    console.log('Processing QR Code:', qrData);
    
    // Registrar evento de QR Code
    await supabase
      .from('campaign_knowledge')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Sistema
        content: `WppConnect QR Code generated for session: ${qrData.session || 'unknown'}`,
        generated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error processing QR code:', error);
  }
}

async function processSessionReady(sessionData: any, supabase: any) {
  try {
    console.log('Processing session ready:', sessionData);
    
    // Atualizar status da sessão
    const sessionName = sessionData.session || sessionData.sessionName;
    
    if (sessionName) {
      await supabase
        .from('whatsapp_config')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('business_account_id', sessionName);
    }

    await supabase
      .from('campaign_knowledge')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        content: `WppConnect Session ready: ${sessionName || 'unknown'}`,
        generated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error processing session ready:', error);
  }
}

async function processSessionDisconnected(sessionData: any, supabase: any) {
  try {
    console.log('Processing session disconnected:', sessionData);
    
    const sessionName = sessionData.session || sessionData.sessionName;
    
    if (sessionName) {
      await supabase
        .from('whatsapp_config')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('business_account_id', sessionName);
    }

    await supabase
      .from('campaign_knowledge')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        content: `WppConnect Session disconnected: ${sessionName || 'unknown'}`,
        generated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error processing session disconnected:', error);
  }
}