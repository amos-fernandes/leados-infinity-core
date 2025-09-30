import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Módulo de WhatsApp seguindo a arquitetura proposta
class WhatsAppService {
  private supabase: any;
  private maytapiApiKey: string | undefined;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.maytapiApiKey = Deno.env.get('MAYTAPI_API_KEY');
  }

  // Enviar mensagem de teste direta
  async sendTestMessage(phoneNumber: string, userId: string) {
    console.log(`📱 Enviando mensagem de teste para ${phoneNumber}`);
    
    if (!this.maytapiApiKey) {
      throw new Error('MAYTAPI_API_KEY não configurada');
    }

    const testMessage = `🏦 *Teste de Contato - Infinity*

Olá! Este é um teste de envio de WhatsApp.

Seu sistema de campanhas automatizadas está funcionando corretamente! ✅

*✅ Benefícios da Conta PJ C6 Bank:*
• Conta 100% gratuita
• Pix ilimitado sem custo
• 100 TEDs gratuitos/mês
• 100 boletos gratuitos/mês
• Acesso a crédito sujeito a análise

---
*Escritório Infinity - C6 Bank PJ*
📞 (62) 99179-2303`;

    try {
      const success = await this.sendWhatsAppMessage({
        to: phoneNumber,
        message: testMessage,
        leadName: 'Teste'
      });

      if (success) {
        // Registrar mensagem de teste
        await this.supabase
          .from('whatsapp_messages')
          .insert({
            user_id: userId,
            phone_number: phoneNumber,
            sender_name: 'Teste Contato',
            message_content: testMessage,
            direction: 'outbound',
            message_type: 'text'
          });

        return {
          success: true,
          message: `Mensagem de teste enviada com sucesso para ${phoneNumber}`,
          phoneNumber
        };
      }
    } catch (error) {
      console.error('Erro ao enviar teste:', error);
      throw error;
    }
  }

  // Enviar campanha de WhatsApp
  async sendCampaignMessages(campaignId: string, userId: string) {
    console.log('📱 WhatsAppService: Iniciando campanha de WhatsApp');
    
    if (!this.maytapiApiKey) {
      console.warn('⚠️ MAYTAPI_API_KEY não configurada, simulando envios');
      return this.simulateWhatsAppCampaign(campaignId, userId);
    }

    try {
      // Buscar scripts da campanha
      const { data: scripts, error: scriptsError } = await this.supabase
        .from('campaign_scripts')
        .select('*, campaigns!inner(*)')
        .eq('campaign_id', campaignId)
        .eq('campaigns.user_id', userId);

      if (scriptsError) throw scriptsError;
      if (!scripts || scripts.length === 0) {
        throw new Error('Nenhum script encontrado para a campanha');
      }

      // Buscar leads correspondentes com WhatsApp
      const empresas = scripts.map((s: any) => s.empresa);
      const { data: leads } = await this.supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .in('empresa', empresas)
        .not('whatsapp', 'is', null);

      if (!leads || leads.length === 0) {
        console.warn('Nenhum lead com WhatsApp encontrado');
        return { sent: 0, errors: [], message: 'Nenhum lead com WhatsApp válido' };
      }

      console.log(`📲 Enviando WhatsApp para ${leads.length} leads`);

      const sent = [];
      const errors = [];

      // Enviar mensagens individualizadas
      for (const lead of leads) {
        const script = scripts.find((s: any) => s.empresa === lead.empresa);
        if (!script || !lead.whatsapp) continue;

        try {
          const message = this.formatWhatsAppMessage(script.roteiro_ligacao, lead);
          const success = await this.sendWhatsAppMessage({
            to: lead.whatsapp,
            message: message,
            leadName: lead.empresa
          });

          if (success) {
            sent.push(lead.empresa);
            
            // Marcar como enviado
            await this.supabase
              .from('campaign_scripts')
              .update({ whatsapp_enviado: true })
              .eq('id', script.id);

            // Registrar interação
            await this.supabase
              .from('interactions')
              .insert({
                user_id: userId,
                lead_id: lead.id,
                tipo: 'whatsapp',
                assunto: `WhatsApp - ${lead.empresa}`,
                descricao: `WhatsApp enviado: ${message.substring(0, 100)}...`,
                data_interacao: new Date().toISOString()
              });

            // Registrar mensagem
            await this.supabase
              .from('whatsapp_messages')
              .insert({
                user_id: userId,
                phone_number: lead.whatsapp,
                sender_name: lead.empresa,
                message_content: message,
                direction: 'outbound',
                message_type: 'text'
              });
          }
        } catch (error) {
          console.error(`Erro ao enviar WhatsApp para ${lead.empresa}:`, error);
          errors.push({ empresa: lead.empresa, error: error instanceof Error ? error.message : 'Erro desconhecido' });
        }

        // Delay entre envios para evitar bloqueios
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      return {
        sent: sent.length,
        errors,
        message: `${sent.length} mensagens WhatsApp enviadas com sucesso`,
        details: sent
      };

    } catch (error) {
      console.error('❌ Erro na campanha de WhatsApp:', error);
      throw error;
    }
  }

  // Enviar mensagem individual via MayTapi
  async sendWhatsAppMessage({ to, message, leadName }: any) {
    try {
      // Limpar e formatar número
      const cleanPhone = to.replace(/\D/g, '');
      
      const response = await fetch(`https://api.maytapi.com/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-maytapi-key': this.maytapiApiKey!
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

      const result = await response.json();
      console.log(`✅ WhatsApp enviado para ${leadName}: ${result.message_id || 'success'}`);
      return true;

    } catch (error) {
      console.error(`❌ Falha ao enviar WhatsApp para ${leadName}:`, error);
      throw error;
    }
  }

  // Formatar mensagem de WhatsApp
  formatWhatsAppMessage(template: string, lead: any) {
    const empresa = lead.empresa || '[EMPRESA]';
    const contato = lead.contato_decisor || 'responsável';
    
    const message = `🏦 *Conta PJ C6 Bank - Infinity*

${template}

*✅ Benefícios Exclusivos:*
• Conta 100% gratuita
• Pix ilimitado sem custo
• 100 TEDs gratuitos/mês
• 100 boletos gratuitos/mês
• Acesso a crédito sujeito a análise
• Atendimento humano especializado

*🚀 Abertura 100% digital*

Posso enviar mais detalhes sobre os benefícios para a ${empresa}?

---
*Escritório Infinity - C6 Bank PJ*
📞 (62) 99179-2303`;

    return message;
  }

  // Simular campanha de WhatsApp (quando MayTapi não está configurado)
  async simulateWhatsAppCampaign(campaignId: string, userId: string) {
    console.log('🎭 Simulando campanha de WhatsApp');
    
    const { data: scripts } = await this.supabase
      .from('campaign_scripts')
      .select('*')
      .eq('campaign_id', campaignId);

    if (!scripts) return { sent: 0, message: 'Nenhum script encontrado' };

    // Marcar como enviado (simulação)
    await this.supabase
      .from('campaign_scripts')
      .update({ whatsapp_enviado: true })
      .eq('campaign_id', campaignId);

    // Criar interações simuladas
    const interactions = scripts.map((script: any) => ({
      user_id: userId,
      tipo: 'whatsapp_simulado',
      assunto: `WhatsApp - ${script.empresa}`,
      descricao: `[SIMULADO] WhatsApp enviado para ${script.empresa} com proposta de conta PJ C6 Bank`,
      data_interacao: new Date().toISOString()
    }));

    await this.supabase
      .from('interactions')
      .insert(interactions);

    // Criar mensagens simuladas
    const messages = scripts.map((script: any) => ({
      user_id: userId,
      phone_number: '62999999999',
      sender_name: script.empresa,
      message_content: `[SIMULADO] Mensagem para ${script.empresa}`,
      direction: 'outbound',
      message_type: 'text'
    }));

    await this.supabase
      .from('whatsapp_messages')
      .insert(messages);

    return {
      sent: scripts.length,
      message: `${scripts.length} mensagens WhatsApp simuladas (configure MAYTAPI_API_KEY para envios reais)`,
      simulated: true
    };
  }

  // Processar respostas recebidas
  async processInboundMessages() {
    console.log('📥 Processando mensagens recebidas');
    
    const { data: messages } = await this.supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('direction', 'inbound')
      .eq('response_sent', false)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return { processed: 0, message: 'Nenhuma mensagem nova' };
    }

    const processed = [];
    
    for (const message of messages) {
      try {
        // Análise de sentimento básica
        const isPositive = this.analyzeMessageSentiment(message.message_content);
        
        if (isPositive) {
          // Enviar resposta automática para interesse positivo
          await this.sendFollowUpMessage(message);
          
          // Marcar lead como interessado
          await this.updateLeadStatus(message.phone_number, 'interessado');
        }

        // Marcar como processado
        await this.supabase
          .from('whatsapp_messages')
          .update({ 
            response_sent: true,
            processed_at: new Date().toISOString()
          })
          .eq('id', message.id);

        processed.push(message.id);
      } catch (error) {
        console.error(`Erro ao processar mensagem ${message.id}:`, error);
      }
    }

    return {
      processed: processed.length,
      message: `${processed.length} mensagens processadas`
    };
  }

  // Análise básica de sentimento
  analyzeMessageSentiment(message: string) {
    const positiveWords = ['sim', 'interessado', 'quero', 'gostaria', 'pode', 'enviar', 'saber'];
    const negativeWords = ['não', 'nao', 'obrigado', 'desculpa', 'pare', 'remover'];
    
    const lowerMessage = message.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length;
    
    return positiveCount > negativeCount;
  }

  // Enviar mensagem de follow-up
  async sendFollowUpMessage(originalMessage: any) {
    const followUpMessage = `Ótimo! Que bom que tem interesse na conta PJ C6 Bank! 🎉

Vou enviar agora mesmo os detalhes completos e o link para iniciar a abertura da conta.

Em alguns minutos você receberá:
✅ Proposta personalizada
✅ Link de abertura 100% digital
✅ Contato direto comigo para tirar dúvidas

Aguarde só um momento! 😊`;

    await this.sendWhatsAppMessage({
      to: originalMessage.phone_number,
      message: followUpMessage,
      leadName: originalMessage.sender_name
    });
  }

  // Atualizar status do lead
  async updateLeadStatus(phoneNumber: string, status: string) {
    await this.supabase
      .from('leads')
      .update({ status })
      .eq('whatsapp', phoneNumber);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, campaignId, userId, channel } = body;

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

    const whatsappService = new WhatsAppService(supabase);
    
    let result;

    switch (action) {
      case 'sendTest':
        const { phoneNumber } = body;
        if (!phoneNumber) {
          throw new Error('phoneNumber é obrigatório para teste');
        }
        result = await whatsappService.sendTestMessage(phoneNumber, userId);
        break;
      case 'processInbound':
        result = await whatsappService.processInboundMessages();
        break;
      default:
        if (campaignId) {
          result = await whatsappService.sendCampaignMessages(campaignId, userId);
        } else {
          throw new Error('campaignId é obrigatório para campanhas');
        }
    }

    return new Response(JSON.stringify({ 
      success: true,
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no WhatsAppService:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});