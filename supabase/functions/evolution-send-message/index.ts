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
    console.log('📤 Evolution send message function started');
    
    const { instanceId, number, text, mediaUrl, mediaType, caption } = await req.json();
    
    if (!instanceId || !number) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'instanceId e number são obrigatórios'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar instância
    const { data: instance, error: instanceError } = await supabase
      .from('evolution_instances')
      .select('*')
      .eq('id', instanceId)
      .eq('is_active', true)
      .single();

    if (instanceError || !instance) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Instância não encontrada ou inativa'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se a instância realmente existe na Evolution API
    try {
      // Limpar base URL
      let baseUrl = instance.instance_url.trim().replace(/\/$/, '').replace(/\/manager$/, '');
      const statusUrl = `${baseUrl}/instance/connectionState/${instance.instance_name}`;
      console.log('🔍 Verificando status da instância:', statusUrl);
      
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instance.api_key
        }
      });

      if (statusResponse.status === 404) {
        console.error('❌ Instância não existe na Evolution API');
        
        // Atualizar status no banco
        await supabase
          .from('evolution_instances')
          .update({ 
            status: 'disconnected',
            is_active: false 
          })
          .eq('id', instanceId);

        return new Response(JSON.stringify({ 
          success: false,
          error: `Instância "${instance.instance_name}" não existe mais na Evolution API. Status atualizado.`
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const statusData = await statusResponse.json();
      console.log('📊 Status real da instância:', statusData);

      // Se não estiver conectada, atualizar banco
      if (statusData.state !== 'open') {
        await supabase
          .from('evolution_instances')
          .update({ status: 'disconnected' })
          .eq('id', instanceId);

        return new Response(JSON.stringify({ 
          success: false,
          error: `Instância está ${statusData.state}. Conecte novamente.`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (statusError) {
      console.error('⚠️ Erro ao verificar status:', statusError);
      // Continuar mesmo com erro de verificação
    }

    if (instance.status !== 'connected') {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Instância não está conectada. Verifique a conexão.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Formatar número para WhatsApp (brasileiro)
    let formattedNumber = number.replace(/\D/g, '');
    if (!formattedNumber.startsWith('55')) {
      formattedNumber = '55' + formattedNumber;
    }
    if (!formattedNumber.endsWith('@s.whatsapp.net')) {
      formattedNumber = formattedNumber + '@s.whatsapp.net';
    }

    console.log('📱 Sending to:', formattedNumber);

    // Preparar payload para Evolution API
    let endpoint = '/message/sendText';
    let payload: any = {
      number: formattedNumber,
    };

    if (mediaUrl) {
      // Enviar mídia
      if (mediaType === 'image') {
        endpoint = '/message/sendMedia';
        payload.mediatype = 'image';
        payload.media = mediaUrl;
        if (caption) payload.caption = caption;
      } else if (mediaType === 'video') {
        endpoint = '/message/sendMedia';
        payload.mediatype = 'video';
        payload.media = mediaUrl;
        if (caption) payload.caption = caption;
      } else if (mediaType === 'audio') {
        endpoint = '/message/sendMedia';
        payload.mediatype = 'audio';
        payload.media = mediaUrl;
      } else if (mediaType === 'document') {
        endpoint = '/message/sendMedia';
        payload.mediatype = 'document';
        payload.media = mediaUrl;
        if (caption) payload.fileName = caption;
      }
    } else if (text) {
      payload.text = text;
    } else {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Texto ou mídia são obrigatórios'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enviar para Evolution API
    // Limpar base URL removendo paths desnecessários
    let baseUrl = instance.instance_url.trim();
    // Remover trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');
    // Remover /manager se existir no final
    baseUrl = baseUrl.replace(/\/manager$/, '');
    
    const evolutionUrl = `${baseUrl}${endpoint}/${instance.instance_name}`;
    console.log('🔗 Evolution URL:', evolutionUrl);
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));
    
    let evolutionResponse;
    let evolutionData;
    
    try {
      evolutionResponse = await fetch(evolutionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instance.api_key
        },
        body: JSON.stringify(payload)
      });

      const responseText = await evolutionResponse.text();
      console.log('📥 Evolution raw response:', responseText);
      
      try {
        evolutionData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse Evolution response:', parseError);
        throw new Error(`Invalid JSON response from Evolution API: ${responseText}`);
      }
      
      console.log('📥 Evolution parsed response:', evolutionData);

      if (!evolutionResponse.ok) {
        console.error('❌ Evolution API returned error:', {
          status: evolutionResponse.status,
          statusText: evolutionResponse.statusText,
          data: evolutionData
        });
        throw new Error(`Evolution API error (${evolutionResponse.status}): ${JSON.stringify(evolutionData)}`);
      }
    } catch (fetchError) {
      console.error('❌ Network error calling Evolution API:', fetchError);
      throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }

    // Salvar mensagem enviada no banco
    const { data: savedMessage, error: saveError } = await supabase
      .from('evolution_messages')
      .insert({
        instance_id: instance.id,
        user_id: instance.user_id,
        message_id: evolutionData.key?.id || null,
        remote_jid: formattedNumber,
        from_me: true,
        message_type: mediaUrl ? (mediaType || 'media') : 'text',
        message_content: text || caption || '',
        media_url: mediaUrl || null,
        status: 'sent',
        webhook_data: evolutionData,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ Error saving message:', saveError);
    }

    // Criar interação no CRM se houver lead associado
    const phoneOnly = formattedNumber.split('@')[0];
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('user_id', instance.user_id)
      .eq('whatsapp', phoneOnly.replace('55', ''))
      .single();

    if (lead) {
      await supabase
        .from('interactions')
        .insert({
          user_id: instance.user_id,
          lead_id: lead.id,
          tipo: 'whatsapp',
          assunto: 'Mensagem enviada via Evolution API',
          descricao: text || `Mídia enviada: ${mediaType}`,
          data_interacao: new Date().toISOString()
        });
      
      // Atualizar mensagem com lead_id
      if (savedMessage) {
        await supabase
          .from('evolution_messages')
          .update({ lead_id: lead.id })
          .eq('id', savedMessage.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      data: evolutionData,
      messageId: savedMessage?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in evolution-send-message:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
