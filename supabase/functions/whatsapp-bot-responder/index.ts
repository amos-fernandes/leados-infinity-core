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
    console.log('WhatsApp Bot Responder function started');
    
    const body = await req.json();
    const { message, phoneNumber, clientName, userId } = body;
    
    console.log('Processing WhatsApp message:', { message, phoneNumber, clientName, userId });

    if (!message || !userId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Message e userId são obrigatórios'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar informações da base de conhecimento para contextualizar a resposta
    const { data: knowledgeBase } = await supabase
      .from('campaign_knowledge')
      .select('content')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(10);

    const context = knowledgeBase?.map(k => k.content).join('\n') || '';

    // Chamar o RAG para gerar resposta inteligente
    const ragResponse = await supabase.functions.invoke('rag-chat', {
      body: {
        message: `WhatsApp Bot Request - Cliente: ${clientName || 'Cliente'} | Mensagem: ${message} | Contexto: ${context}`,
        userId: userId,
        isWhatsAppBot: true
      }
    });

    let botResponse = "Obrigado pela sua mensagem! Em breve um de nossos consultores entrará em contato.";
    
    if (ragResponse.data?.response) {
      botResponse = ragResponse.data.response;
    }

    // Personalizar resposta para WhatsApp
    const whatsappResponse = `🤖 *Única Contábil*

Olá ${clientName || 'Cliente'}!

${botResponse}

📞 *Fale conosco:*
*(62) 9 8195-9829*

📅 *Agende sua consultoria:*
https://calendly.com/unica-contabil

📧 *E-mail:*
contato@unicacontabil.com

*Especialistas em Consultoria Tributária para Grandes Empresas*`;

    // Armazenar a interação na base de conhecimento
    await supabase
      .from('campaign_knowledge')
      .insert({
        user_id: userId,
        content: `WhatsApp Bot - Cliente: ${clientName} | Pergunta: ${message} | Resposta: ${whatsappResponse}`,
        generated_at: new Date().toISOString()
      });

    // Enviar resposta de volta via WhatsApp (se configurado)
    try {
      const { error: sendError } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          to: phoneNumber,
          message: whatsappResponse,
          userId: userId
        }
      });

      if (sendError) {
        console.error('Error sending WhatsApp response:', sendError);
      } else {
        console.log('WhatsApp response sent successfully');
      }
    } catch (sendingError) {
      console.error('Error in sending WhatsApp response:', sendingError);
    }

    console.log('WhatsApp bot response generated successfully');

    return new Response(JSON.stringify({ 
      success: true,
      response: whatsappResponse,
      clientName: clientName || 'Cliente',
      originalMessage: message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in whatsapp-bot-responder function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});