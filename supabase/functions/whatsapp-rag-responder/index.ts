import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Serviço de Atendimento Receptivo com RAG
class WhatsAppRAGResponder {
  private supabase: any;
  private maytapiApiKey: string | undefined;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.maytapiApiKey = Deno.env.get('MAYTAPI_API_KEY');
  }

  // Processar mensagem recebida e responder automaticamente
  async processInboundMessage(messageData: any) {
    console.log('📱 WhatsAppRAGResponder: Processando mensagem recebida');
    
    const { phone, message, senderName, userId } = messageData;
    
    if (!phone || !message || !userId) {
      throw new Error('phone, message e userId são obrigatórios');
    }

    try {
      // 1. Salvar mensagem do usuário
      await this.saveMessage({
        userId,
        phone,
        message,
        direction: 'incoming',  // CORRIGIDO: era 'inbound'
        senderName: senderName || 'Cliente'
      });

      // 2. Buscar/criar conversação
      const conversation = await this.getOrCreateConversation(userId, phone, senderName);
      
      // 3. Buscar histórico da conversação
      const conversationHistory = await this.getConversationHistory(conversation.id);
      
      // 4. Chamar RAG AI para gerar resposta
      const aiResponse = await this.generateRAGResponse(message, conversationHistory);
      
      // 5. Salvar mensagem da resposta
      await this.saveConversationMessage(conversation.id, 'BOT', aiResponse);
      
      // 6. Enviar resposta via WhatsApp
      const messageSent = await this.sendWhatsAppResponse(phone, aiResponse, senderName);
      
      if (messageSent) {
        // 7. Salvar mensagem enviada no histórico
        await this.saveMessage({
          userId,
          phone,
          message: aiResponse,
          direction: 'outgoing',  // CORRIGIDO: era 'outbound'
          senderName: 'Escritório Infinity'
        });

        console.log(`✅ Resposta enviada para ${senderName || phone}: ${aiResponse.substring(0, 50)}...`);
      }

      return {
        success: true,
        conversationId: conversation.id,
        responseText: aiResponse,
        messageSent
      };

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      throw error;
    }
  }

  // Gerar resposta usando RAG (Lovable AI)
  async generateRAGResponse(userMessage: string, conversationHistory: any[]) {
    console.log('🤖 Gerando resposta RAG para:', userMessage);
    
    try {
      // Formatar histórico para contexto
      const historyContext = conversationHistory
        .slice(-10) // Últimas 10 mensagens para contexto
        .map(msg => `${msg.message_type === 'USER' ? 'Cliente' : 'Assistente'}: ${msg.content}`)
        .join('\n');

      const contextualMessage = historyContext ? 
        `Histórico da conversa:\n${historyContext}\n\nNova pergunta do cliente: ${userMessage}` :
        userMessage;

      // Chamar function AI do Lovable
      const { data: aiResult, error: aiError } = await this.supabase.functions.invoke('ai', {
        body: { message: contextualMessage }
      });

      if (aiError) {
        console.error('Erro na chamada AI:', aiError);
        throw new Error(aiError.message);
      }

      const response = aiResult?.response || 'Desculpe, não consegui processar sua solicitação no momento.';
      
      // Adicionar assinatura do escritório
      const formattedResponse = `${response}

---
*Escritório Infinity - C6 Bank PJ*
📞 (62) 99179-2303
✅ Abertura de conta PJ 100% gratuita`;

      return formattedResponse;

    } catch (error) {
      console.error('❌ Erro na geração RAG:', error);
      return 'Olá! Sou o assistente do Escritório Infinity. Como posso ajudá-lo com abertura de conta PJ C6 Bank? Temos conta 100% gratuita, Pix ilimitado e benefícios exclusivos!';
    }
  }

  // Buscar ou criar conversação
  async getOrCreateConversation(userId: string, phone: string, senderName?: string) {
    // Tentar buscar conversação existente
    const { data: existingConv } = await this.supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_phone', phone)
      .eq('status', 'ativa')
      .single();

    if (existingConv) {
      return existingConv;
    }

    // Criar nova conversação
    const { data: newConv, error } = await this.supabase
      .from('whatsapp_conversations')
      .insert({
        user_id: userId,
        contact_phone: phone,
        contact_name: senderName || `Cliente ${phone.substring(-4)}`,
        status: 'ativa'
      })
      .select()
      .single();

    if (error) throw error;
    return newConv;
  }

  // Buscar histórico da conversação
  async getConversationHistory(conversationId: string) {
    const { data: messages } = await this.supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20); // Últimas 20 mensagens

    return messages || [];
  }

  // Salvar mensagem na conversação
  async saveConversationMessage(conversationId: string, messageType: string, content: string) {
    const { error } = await this.supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        message_type: messageType,
        content: content,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'whatsapp_rag'
        }
      });

    if (error) {
      console.error('Erro ao salvar mensagem da conversação:', error);
    }
  }

  // Salvar mensagem no histórico WhatsApp
  async saveMessage({ userId, phone, message, direction, senderName }: any) {
    const { error } = await this.supabase
      .from('whatsapp_messages')
      .insert({
        user_id: userId,
        phone_number: phone,
        sender_name: senderName,
        message_content: message,
        direction: direction,
        message_type: 'text',
        response_sent: direction === 'outgoing'  // CORRIGIDO: era 'outbound'
      });

    if (error) {
      console.error('Erro ao salvar mensagem:', error);
    }
  }

  // Enviar resposta via WhatsApp
  async sendWhatsAppResponse(to: string, message: string, recipientName?: string) {
    if (!this.maytapiApiKey) {
      console.warn('⚠️ MAYTAPI_API_KEY não configurada, simulando envio');
      return true; // Simular sucesso
    }

    try {
      const cleanPhone = to.replace(/\D/g, '');
      
      const response = await fetch(`https://api.maytapi.com/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-maytapi-key': this.maytapiApiKey
        },
        body: JSON.stringify({
          to_number: cleanPhone,
          message: message,
          type: 'text'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MayTapi API error: ${response.status} - ${error}`);
      }

      return true;

    } catch (error) {
      console.error(`❌ Falha ao enviar WhatsApp para ${recipientName || to}:`, error);
      return false;
    }
  }

  // Processar múltiplas mensagens pendentes
  async processPendingMessages(userId: string) {
    console.log('📥 Processando mensagens pendentes...');
    
    try {
      // Buscar mensagens não respondidas
      const { data: pendingMessages } = await this.supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('direction', 'incoming')  // CORRIGIDO: era 'inbound'
        .eq('response_sent', false)
        .order('created_at', { ascending: true });

      if (!pendingMessages || pendingMessages.length === 0) {
        return { processed: 0, message: 'Nenhuma mensagem pendente' };
      }

      const processed = [];
      const errors = [];

      for (const msg of pendingMessages) {
        try {
          const result = await this.processInboundMessage({
            phone: msg.phone_number,
            message: msg.message_content,
            senderName: msg.sender_name,
            userId
          });

          if (result.success) {
            // Marcar como respondida
            await this.supabase
              .from('whatsapp_messages')
              .update({ 
                response_sent: true,
                processed_at: new Date().toISOString()
              })
              .eq('id', msg.id);

            processed.push(msg.id);
          }
        } catch (error) {
          console.error(`Erro ao processar mensagem ${msg.id}:`, error);
          errors.push({ messageId: msg.id, error: error instanceof Error ? error.message : 'Erro desconhecido' });
        }

        // Delay entre processamentos
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      return {
        processed: processed.length,
        errors: errors.length,
        total: pendingMessages.length,
        message: `${processed.length}/${pendingMessages.length} mensagens processadas`
      };

    } catch (error) {
      console.error('❌ Erro no processamento de mensagens pendentes:', error);
      throw error;
    }
  }

  // Gerar relatório de conversações
  async generateConversationReport(userId: string) {
    console.log('📊 Gerando relatório de conversações...');
    
    try {
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      // Stats das conversações
      const { data: conversations } = await this.supabase
        .from('whatsapp_conversations')
        .select(`
          *,
          conversation_messages(*)
        `)
        .eq('user_id', userId)
        .gte('updated_at', last24Hours.toISOString());

      if (!conversations) return { totalConversations: 0 };

      const stats = {
        totalConversations: conversations.length,
        activeConversations: conversations.filter((c: any) => c.status === 'ativa').length,
        totalMessages: conversations.reduce((acc: number, c: any) => acc + (c.conversation_messages?.length || 0), 0),
        averageMessagesPerConv: conversations.length > 0 ? 
          conversations.reduce((acc: number, c: any) => acc + (c.conversation_messages?.length || 0), 0) / conversations.length : 0,
        recentActivity: conversations.filter((c: any) =>
          new Date(c.updated_at) > last24Hours
        ).length
      };

      return stats;

    } catch (error) {
      console.error('❌ Erro ao gerar relatório:', error);
      throw error;
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, userId, messageData, phone, message } = body;

    if (!userId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'userId é obrigatório'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const responder = new WhatsAppRAGResponder(supabase);
    
    let result;

    switch (action) {
      case 'processMessage':
        if (!messageData) {
          throw new Error('messageData é obrigatório para processMessage');
        }
        result = await responder.processInboundMessage({ ...messageData, userId });
        break;
        
      case 'processPending':
        result = await responder.processPendingMessages(userId);
        break;
        
      case 'generateReport':
        result = await responder.generateConversationReport(userId);
        break;
        
      case 'quickResponse':
        if (!phone || !message) {
          throw new Error('phone e message são obrigatórios para quickResponse');
        }
        result = await responder.processInboundMessage({
          phone,
          message,
          userId,
          senderName: 'Cliente'
        });
        break;
        
      default:
        throw new Error('Ação não reconhecida');
    }

    return new Response(JSON.stringify({ 
      success: true,
      action,
      timestamp: new Date().toISOString(),
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no WhatsAppRAGResponder:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});