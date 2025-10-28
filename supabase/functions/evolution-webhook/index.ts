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
    console.log('🔔 Evolution Webhook received');
    
    const payload = await req.json();
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extrair informações do webhook
    const { event, instance, data } = payload;
    
    // Buscar a instância no banco de dados
    const { data: evolutionInstance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('instance_name', instance)
      .single();

    if (instanceError || !evolutionInstance) {
      console.warn('⚠️ Instância não encontrada:', instance);
      // Log webhook mesmo sem instância
      await supabase.from('evolution_webhook_logs').insert({
        event_type: event,
        payload: payload,
        processed: false,
        error_message: 'Instance not found'
      });
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Instance not found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    // Log do webhook
    await supabase.from('evolution_webhook_logs').insert({
      instance_id: evolutionInstance.id,
      event_type: event,
      payload: payload,
      processed: false
    });

    // Processar diferentes tipos de eventos
    switch (event) {
      case 'qrcode.updated':
        await handleQRCode(supabase, evolutionInstance, data);
        break;
      
      case 'connection.update':
        await handleConnectionUpdate(supabase, evolutionInstance, data);
        break;
      
      case 'messages.upsert':
        await handleMessage(supabase, evolutionInstance, data);
        break;
      
      case 'messages.update':
        await handleMessageStatusUpdate(supabase, evolutionInstance, data);
        break;
      
      case 'call.received':
        await handleCall(supabase, evolutionInstance, data);
        break;
      
      default:
        console.log('ℹ️ Evento não tratado:', event);
    }

    // Marcar webhook como processado
    await supabase
      .from('evolution_webhook_logs')
      .update({ processed: true })
      .eq('instance_id', evolutionInstance.id)
      .eq('event_type', event)
      .eq('processed', false)
      .order('created_at', { ascending: false })
      .limit(1);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in evolution-webhook:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleQRCode(supabase: any, instance: any, data: any) {
  console.log('📱 Updating QR Code for instance:', instance.instance_name);
  
  const qrCode = data.qrcode || data.base64 || data;
  
  await supabase
    .from('evolution_instances')
    .update({ 
      qr_code: qrCode,
      status: 'qr_code',
      updated_at: new Date().toISOString()
    })
    .eq('id', instance.id);
}

async function handleConnectionUpdate(supabase: any, instance: any, data: any) {
  console.log('🔌 Connection update for instance:', instance.instance_name, data);
  
  const state = data.state || data.status;
  let status = 'disconnected';
  
  if (state === 'open' || state === 'connected') {
    status = 'connected';
  } else if (state === 'connecting') {
    status = 'connecting';
  }
  
  const updateData: any = { 
    status,
    updated_at: new Date().toISOString()
  };
  
  // Limpar QR code quando conectado
  if (status === 'connected') {
    updateData.qr_code = null;
    if (data.phoneNumber) {
      updateData.phone_number = data.phoneNumber;
    }
  }
  
  await supabase
    .from('evolution_instances')
    .update(updateData)
    .eq('id', instance.id);
}

async function handleMessage(supabase: any, instance: any, data: any) {
  console.log('💬 New message received for instance:', instance.instance_name);
  
  const message = data.message || data;
  const key = message.key || {};
  const messageContent = message.message || {};
  
  // Extrair conteúdo da mensagem
  let content = '';
  let messageType = 'text';
  let mediaUrl = null;
  
  if (messageContent.conversation) {
    content = messageContent.conversation;
  } else if (messageContent.extendedTextMessage) {
    content = messageContent.extendedTextMessage.text;
  } else if (messageContent.imageMessage) {
    messageType = 'image';
    content = messageContent.imageMessage.caption || '';
    mediaUrl = messageContent.imageMessage.url;
  } else if (messageContent.videoMessage) {
    messageType = 'video';
    content = messageContent.videoMessage.caption || '';
    mediaUrl = messageContent.videoMessage.url;
  } else if (messageContent.audioMessage) {
    messageType = 'audio';
    mediaUrl = messageContent.audioMessage.url;
  } else if (messageContent.documentMessage) {
    messageType = 'document';
    content = messageContent.documentMessage.fileName || '';
    mediaUrl = messageContent.documentMessage.url;
  }
  
  const fromMe = key.fromMe || false;
  const remoteJid = key.remoteJid || key.participant || '';
  
  // Salvar mensagem no banco
  const { data: savedMessage, error: messageError } = await supabase
    .from('evolution_messages')
    .insert({
      instance_id: instance.id,
      user_id: instance.user_id,
      message_id: key.id,
      remote_jid: remoteJid,
      from_me: fromMe,
      message_type: messageType,
      message_content: content,
      media_url: mediaUrl,
      status: 'received',
      webhook_data: data,
      timestamp: message.messageTimestamp ? new Date(message.messageTimestamp * 1000).toISOString() : new Date().toISOString()
    })
    .select()
    .single();
  
  if (messageError) {
    console.error('❌ Error saving message:', messageError);
    return;
  }
  
  // Se a mensagem não é de mim, processar com IA
  if (!fromMe && content) {
    console.log('🤖 Processing incoming message with AI...');
    
    // Buscar ou criar lead
    const phoneNumber = remoteJid.split('@')[0];
    let leadId = null;
    
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('user_id', instance.user_id)
      .eq('whatsapp', phoneNumber)
      .single();
    
    if (existingLead) {
      leadId = existingLead.id;
    } else {
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          user_id: instance.user_id,
          empresa: message.pushName || phoneNumber,
          whatsapp: phoneNumber,
          telefone: phoneNumber,
          status: 'novo'
        })
        .select()
        .single();
      
      if (newLead) {
        leadId = newLead.id;
      }
    }
    
    // Atualizar mensagem com lead_id
    if (leadId) {
      await supabase
        .from('evolution_messages')
        .update({ lead_id: leadId })
        .eq('id', savedMessage.id);
    }
    
    // Responder com IA (chama o RAG)
    try {
      const { data: ragResponse } = await supabase.functions.invoke('rag-chat', {
        body: {
          message: content,
          userId: instance.user_id,
          context: `Cliente via WhatsApp: ${message.pushName || phoneNumber}`
        }
      });
      
      if (ragResponse?.response) {
        // Enviar resposta via Evolution API
        await supabase.functions.invoke('evolution-send-message', {
          body: {
            instanceId: instance.id,
            number: phoneNumber,
            text: ragResponse.response
          }
        });
      }
    } catch (aiError) {
      console.error('❌ Error processing with AI:', aiError);
    }
    
    // Criar interação no CRM
    if (leadId) {
      await supabase
        .from('interactions')
        .insert({
          user_id: instance.user_id,
          lead_id: leadId,
          tipo: 'whatsapp',
          assunto: 'Mensagem recebida via Evolution API',
          descricao: content,
          data_interacao: new Date().toISOString()
        });
    }
  }
}

async function handleMessageStatusUpdate(supabase: any, instance: any, data: any) {
  console.log('✅ Message status update:', data);
  
  const update = data.update || data;
  const key = update.key || {};
  const status = update.status;
  
  if (key.id && status) {
    await supabase
      .from('evolution_messages')
      .update({ status: status })
      .eq('message_id', key.id)
      .eq('instance_id', instance.id);
  }
}

async function handleCall(supabase: any, instance: any, data: any) {
  console.log('📞 Call received:', data);
  
  const call = data.call || data;
  const from = call.from || call.remoteJid;
  const phoneNumber = from.split('@')[0];
  
  // Criar interação de chamada no CRM
  await supabase
    .from('interactions')
    .insert({
      user_id: instance.user_id,
      tipo: 'chamada_whatsapp',
      assunto: 'Chamada WhatsApp recebida',
      descricao: `Chamada recebida de ${phoneNumber} via ${instance.instance_name}`,
      data_interacao: new Date().toISOString()
    });
  
  // Salvar como mensagem especial
  await supabase
    .from('evolution_messages')
    .insert({
      instance_id: instance.id,
      user_id: instance.user_id,
      remote_jid: from,
      from_me: false,
      message_type: 'call',
      message_content: 'Chamada recebida',
      status: 'received',
      webhook_data: data,
      timestamp: new Date().toISOString()
    });
}
