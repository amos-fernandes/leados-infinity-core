import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

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
    console.log('=== INÍCIO TESTE WHATSAPP ===');
    console.log(`📱 phoneNumber: ${phoneNumber}`);
    console.log(`👤 userId: ${userId}`);
    console.log(`🔑 MAYTAPI_API_KEY configurado: ${this.maytapiApiKey ? 'SIM' : 'NÃO'}`);
    console.log(`🔑 MAYTAPI_PRODUCT_ID: ${Deno.env.get('MAYTAPI_PRODUCT_ID') || 'NÃO CONFIGURADO'}`);
    console.log(`🔑 MAYTAPI_PHONE_ID: ${Deno.env.get('MAYTAPI_PHONE_ID') || 'NÃO CONFIGURADO'}`);
    
    if (!this.maytapiApiKey) {
      throw new Error('❌ MAYTAPI_API_KEY não está configurada');
    }

    const productId = Deno.env.get('MAYTAPI_PRODUCT_ID');
    const phoneId = Deno.env.get('MAYTAPI_PHONE_ID');

    if (!productId || !phoneId) {
      throw new Error('❌ MAYTAPI_PRODUCT_ID ou MAYTAPI_PHONE_ID não estão configurados');
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
      console.log('🚀 Iniciando envio...');
      const success = await this.sendWhatsAppMessage({
        to: phoneNumber,
        message: testMessage,
        leadName: 'Teste'
      });

      if (success) {
        console.log('✅ Mensagem enviada com sucesso!');
        
        // Registrar mensagem de teste
        await this.supabase
          .from('whatsapp_messages')
          .insert({
            user_id: userId,
            phone_number: phoneNumber,
            sender_name: 'Teste Contato',
            message_content: testMessage,
            direction: 'outgoing',  // CORRIGIDO: era 'outbound', agora é 'outgoing'
            message_type: 'text'
          });

        console.log('✅ Mensagem registrada no banco');

        return {
          success: true,
          message: `Mensagem de teste enviada com sucesso para ${phoneNumber}`,
          phoneNumber
        };
      }
    } catch (error) {
      console.error('❌ Erro ao enviar teste:', error);
      throw error;
    }
  }

  // Enviar campanha de WhatsApp
  async sendCampaignMessages(campaignId: string, userId: string) {
    console.log('📱 WhatsAppService: Iniciando campanha de WhatsApp');
    console.log(`📋 CampaignId: ${campaignId}, UserId: ${userId}`);
    
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

      console.log(`📝 Scripts encontrados: ${scripts?.length || 0}`);
      if (scriptsError) {
        console.error('❌ Erro ao buscar scripts:', scriptsError);
        throw scriptsError;
      }
      if (!scripts || scripts.length === 0) {
        throw new Error('Nenhum script encontrado para a campanha');
      }

      // Buscar leads correspondentes com telefone/WhatsApp
      // Filtrar empresas válidas (remover "-" e strings vazias)
      const empresas = scripts
        .map((s: any) => s.empresa)
        .filter((e: string) => e && e.trim() !== '' && e !== '-');
      
      console.log(`🏢 Total de empresas nos scripts: ${scripts.length}`);
      console.log(`✅ Empresas válidas (primeiras 10): ${empresas.slice(0, 10).join(', ')}`);
      console.log(`📊 Total de empresas válidas: ${empresas.length}`);
      
      if (empresas.length === 0) {
        console.warn('⚠️ Nenhuma empresa válida encontrada nos scripts');
        return { sent: 0, errors: [], message: 'Nenhuma empresa válida encontrada' };
      }

      // Buscar todos os leads do usuário primeiro, depois filtrar
      const { data: allLeads, error: leadsError } = await this.supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId);

      console.log(`👥 Total de leads encontrados: ${allLeads?.length || 0}`);
      if (leadsError) {
        console.error('❌ Erro ao buscar leads:', leadsError);
        throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
      }

      // Filtrar leads que pertençam às empresas da campanha E tenham telefone/whatsapp válido
      const leads = allLeads?.filter((lead: any) => {
        // Verificar se a empresa do lead está na lista de empresas da campanha
        const isInCampaign = empresas.includes(lead.empresa);
        if (!isInCampaign) return false;

        // Verificar se tem telefone ou whatsapp válido (mínimo 10 dígitos)
        const hasWhatsApp = lead.whatsapp && lead.whatsapp.replace(/\D/g, '').length >= 10;
        const hasTelefone = lead.telefone && lead.telefone.replace(/\D/g, '').length >= 10;
        return hasWhatsApp || hasTelefone;
      }) || [];

      if (leads.length > 0) {
        console.log('📊 Primeiros 3 leads válidos:');
        leads.slice(0, 3).forEach((lead: any) => {
          console.log(`  - ${lead.empresa}: whatsapp=${lead.whatsapp || 'vazio'}, telefone=${lead.telefone || 'vazio'}`);
        });
      }

      console.log(`✅ Leads com telefone/WhatsApp válido: ${leads.length}`);

      if (leads.length === 0) {
        console.warn('⚠️ Nenhum lead com telefone/WhatsApp encontrado');
        console.warn(`Total de leads: ${allLeads?.length || 0}, mas nenhum tem telefone/whatsapp válido (mínimo 10 dígitos)`);
        return { sent: 0, errors: [], message: 'Nenhum lead com telefone/WhatsApp válido' };
      }

      console.log(`📲 Enviando WhatsApp para ${leads.length} leads`);
      console.log('📝 Primeiros 5 leads que receberão mensagens:');
      leads.slice(0, 5).forEach((lead: any, index: any) => {
        console.log(`  ${index + 1}. ${lead.empresa} - Contato: ${lead.contato_decisor || 'Não informado'} - Tel: ${lead.whatsapp || lead.telefone}`);
      });

      const sent = [];
      const errors = [];

      // Enviar mensagens individualizadas
      for (const lead of leads) {
        const script = scripts.find((s: any) => s.empresa === lead.empresa);
        const phoneNumber = lead.whatsapp || lead.telefone;
        
        if (!script || !phoneNumber) continue;

        try {
          const message = this.formatWhatsAppMessage(script.roteiro_ligacao, lead);
          const success = await this.sendWhatsAppMessage({
            to: phoneNumber,
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
                phone_number: phoneNumber,
                sender_name: lead.empresa,
                message_content: message,
                direction: 'outgoing',  // CORRIGIDO: era 'outbound'
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

  // Enviar mensagem individual via Maytapi - API CORRETA
  async sendWhatsAppMessage({ to, message, leadName }: any) {
    try {
      console.log(`📱 Iniciando envio via Maytapi para ${leadName} (${to})`);
      
      // Limpar e formatar número - Maytapi aceita formato internacional
      const cleanPhone = to.replace(/\D/g, '');
      console.log(`Número limpo: ${cleanPhone}`);
      
      // Configuração Maytapi
      const productId = Deno.env.get('MAYTAPI_PRODUCT_ID');
      const phoneId = Deno.env.get('MAYTAPI_PHONE_ID');
      
      if (!productId || !phoneId) {
        throw new Error('MAYTAPI_PRODUCT_ID e MAYTAPI_PHONE_ID são necessários');
      }
      
      // URL correta da API Maytapi
      const apiUrl = `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`;
      console.log(`📡 URL da API: ${apiUrl}`);
      
      const payload = {
        to_number: cleanPhone,
        type: 'text',
        message: message
      };
      
      console.log('📦 Payload:', JSON.stringify(payload, null, 2));
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-maytapi-key': this.maytapiApiKey!
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      console.log(`✅ Status: ${response.status}`);
      console.log(`📄 Response: ${responseText}`);

      if (!response.ok) {
        throw new Error(`Maytapi API error ${response.status}: ${responseText}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { message: responseText };
      }
      
      console.log(`✅ WhatsApp enviado para ${leadName}!`);
      return true;

    } catch (error) {
      console.error(`❌ Falha ao enviar WhatsApp para ${leadName}:`, error);
      throw error;
    }
  }

  // Formatar mensagem de WhatsApp
  formatWhatsAppMessage(template: string, lead: any) {
    const empresa = lead.empresa || '[EMPRESA]';
    
    // Substituir [Responsável] pelo nome da empresa no template
    const templateFormatted = template.replace(/\[Responsável\]/gi, empresa);
    
    const message = `🏦 *Olá, ${empresa}!*

${templateFormatted}

*✅ Benefícios Exclusivos para ${empresa}:*
• Conta 100% gratuita
• Pix ilimitado sem custo
• 100 TEDs gratuitos/mês
• 100 boletos gratuitos/mês
• Acesso a crédito sujeito a análise
• Atendimento humano especializado

*🚀 Abertura 100% digital*

Posso enviar mais detalhes sobre os benefícios para sua empresa?

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
      direction: 'outgoing',  // CORRIGIDO: era 'outbound'
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
      .eq('direction', 'incoming')  // CORRIGIDO: era 'inbound'
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
  console.log('=== WHATSAPP SERVICE CHAMADO ===');
  console.log('Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    console.log('Body recebido:', bodyText);
    
    const body = JSON.parse(bodyText);
    const { action, campaignId, userId, phoneNumber } = body;
    
    console.log('Parâmetros:', { action, campaignId, userId, phoneNumber });

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

    console.log('Action recebida:', action);

    switch (action) {
      case 'sendTest':
        if (!phoneNumber) {
          throw new Error('phoneNumber é obrigatório para teste');
        }
        console.log('Executando sendTest...');
        result = await whatsappService.sendTestMessage(phoneNumber, userId);
        break;
      case 'processInbound':
        console.log('Executando processInbound...');
        result = await whatsappService.processInboundMessages();
        break;
      default:
        if (campaignId) {
          console.log('Executando sendCampaignMessages...');
          result = await whatsappService.sendCampaignMessages(campaignId, userId);
        } else {
          throw new Error('campaignId é obrigatório para campanhas');
        }
    }

    console.log('Resultado:', JSON.stringify(result));

    return new Response(JSON.stringify({ 
      success: true,
      ...result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no WhatsAppService:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});