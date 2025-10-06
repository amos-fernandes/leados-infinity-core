import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Módulo centralizado de campanhas seguindo a arquitetura proposta
class CampaignService {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  // Criar campanha com configurações avançadas
  async createCampaign(campaignData: any) {
    console.log('🚀 CampaignService: Criando nova campanha');
    console.log('Dados recebidos:', JSON.stringify(campaignData, null, 2));
    
    // Validação explícita do userId
    if (!campaignData.userId) {
      throw new Error('userId é obrigatório para criar campanha');
    }
    
    const campaignPayload = {
      user_id: campaignData.userId,
      name: campaignData.name || `Campanha Automatizada - ${new Date().toLocaleDateString('pt-BR')}`,
      description: campaignData.description || 'Campanha automatizada completa: Google Maps + Scripts IA + Multi-canal',
      target_companies: campaignData.targetCompanies || [],
      status: 'ativa'
    };
    
    console.log('Payload da campanha:', JSON.stringify(campaignPayload, null, 2));
    
    const { data: campaign, error } = await this.supabase
      .from('campaigns')
      .insert(campaignPayload)
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir campanha:', error);
      throw error;
    }
    
    console.log('Campanha criada com sucesso:', campaign);
    return campaign;
  }

  // Executar campanha multi-canal com processamento em background
  async runCampaign(campaignId: string, userId: string) {
    console.log(`📊 CampaignService: Iniciando campanha ID: ${campaignId}`);
    
    try {
      // 1. Buscar leads que AINDA NÃO receberam disparo
      // Buscar empresas que já têm scripts com whatsapp_enviado = true ou email_enviado = true
      const { data: sentScripts } = await this.supabase
        .from('campaign_scripts')
        .select('empresa')
        .or('whatsapp_enviado.eq.true,email_enviado.eq.true');

      const sentCompanies = new Set((sentScripts || []).map((s: any) => s.empresa));
      console.log(`📊 Empresas que já receberam disparo: ${sentCompanies.size}`);

      // Buscar TODOS os leads, ordenados por data de criação (mais antigos primeiro)
      const { data: allLeads, error: leadsError } = await this.supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['qualificado', 'contatado', 'novo'])
        .order('created_at', { ascending: true });

      if (leadsError) throw leadsError;

      if (!allLeads || allLeads.length === 0) {
        throw new Error('Nenhum lead disponível para campanha');
      }

      // Filtrar apenas leads que NÃO receberam disparo ainda
      const pendingLeads = allLeads.filter(lead => !sentCompanies.has(lead.empresa));
      
      console.log(`✅ Total de leads no banco: ${allLeads.length}`);
      console.log(`📩 Leads que já receberam: ${allLeads.length - pendingLeads.length}`);
      console.log(`⏳ Leads pendentes de disparo: ${pendingLeads.length}`);

      if (pendingLeads.length === 0) {
        throw new Error('Todos os leads já receberam disparo. Nenhum lead pendente.');
      }

      // Limitar a 1000 leads por campanha (próximos 1000 pendentes)
      const leadsToProcess = pendingLeads.slice(0, 1000);
      console.log(`🎯 Processando próximos ${leadsToProcess.length} leads pendentes`);

      // 2. Atualizar campanha com status inicial e total de leads
      await this.supabase
        .from('campaigns')
        .update({ 
          status: 'em_execucao',
          description: `Iniciando disparo para ${leadsToProcess.length} leads pendentes de ${pendingLeads.length} disponíveis`,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      // 3. PROCESSAR EM BACKGROUND - não aguardar conclusão
      this.processAllLeadsInBackground(campaignId, userId, leadsToProcess);

      // 4. Retornar imediatamente (processamento continua em background)
      return {
        success: true,
        campaignId,
        message: `Campanha iniciada! Processando ${leadsToProcess.length} leads pendentes em background.`,
        totalLeads: leadsToProcess.length,
        totalPending: pendingLeads.length,
        totalInDatabase: allLeads.length,
        alreadySent: allLeads.length - pendingLeads.length,
        status: 'em_execucao'
      };

    } catch (error) {
      console.error('❌ Erro ao iniciar campanha:', error);
      
      await this.supabase
        .from('campaigns')
        .update({ status: 'erro' })
        .eq('id', campaignId);

      throw error;
    }
  }

  // Processar todos os leads em background (sem bloquear resposta)
  private async processAllLeadsInBackground(campaignId: string, userId: string, allLeads: any[]) {
    const BATCH_SIZE = 25; // Processar 25 leads por vez
    const totalLeads = allLeads.length;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    console.log(`🚀 BACKGROUND: Iniciando processamento de ${totalLeads} leads em lotes de ${BATCH_SIZE}`);

    try {
      // FASE 1: Gerar scripts para todos os leads (rápido, sem IA)
      console.log('📝 FASE 1/3: Gerando scripts...');
      const scriptsResult = await this.generateCampaignScriptsFast(campaignId, allLeads);
      console.log(`✅ Scripts gerados: ${scriptsResult.length}/${totalLeads}`);

      // FASE 2 & 3: Processar lotes de leads (WhatsApp + Email)
      console.log('📱📧 FASE 2-3/3: Disparando WhatsApp e Email...');
      
      for (let i = 0; i < allLeads.length; i += BATCH_SIZE) {
        const batch = allLeads.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalLeads / BATCH_SIZE);
        
        console.log(`📦 Processando lote ${batchNumber}/${totalBatches} (${batch.length} leads)`);

        // Processar lote em paralelo
        const batchPromises = batch.map(async (lead) => {
          try {
            // Enviar WhatsApp e Email em paralelo
            await Promise.all([
              this.sendWhatsAppForLead(campaignId, userId, lead),
              this.sendEmailForLead(campaignId, userId, lead)
            ]);
            successCount++;
          } catch (error) {
            console.error(`❌ Erro ao processar lead ${lead.empresa}:`, error);
            errorCount++;
          }
          processedCount++;
        });

        await Promise.all(batchPromises);

        // Atualizar progresso da campanha
        const progressPercent = Math.round((processedCount / totalLeads) * 100);
        await this.supabase
          .from('campaigns')
          .update({ 
            description: `Processando: ${processedCount}/${totalLeads} leads (${progressPercent}%)`,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId);

        console.log(`📊 Progresso: ${processedCount}/${totalLeads} (${progressPercent}%) - ✅ ${successCount} sucesso, ❌ ${errorCount} erros`);

        // Pequeno delay entre lotes para evitar sobrecarga
        if (i + BATCH_SIZE < allLeads.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Finalizar campanha
      await this.supabase
        .from('campaigns')
        .update({ 
          status: 'concluida',
          description: `Concluída! ${successCount}/${totalLeads} enviados com sucesso. ${errorCount} erros.`,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      console.log(`🎉 CAMPANHA CONCLUÍDA! Total: ${totalLeads}, Sucesso: ${successCount}, Erros: ${errorCount}`);

    } catch (error) {
      console.error('❌ ERRO CRÍTICO no processamento em background:', error);
      
      await this.supabase
        .from('campaigns')
        .update({ 
          status: 'erro',
          description: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);
    }
  }

  // Gerar scripts de forma otimizada (só templates, sem IA)
  private async generateCampaignScriptsFast(campaignId: string, leads: any[]) {
    const scripts = leads.map(lead => ({
      campaign_id: campaignId,
      empresa: lead.empresa,
      roteiro_ligacao: this.generateTemplateScript(lead).callScript,
      assunto_email: this.generateTemplateScript(lead).emailSubject,
      modelo_email: this.generateTemplateScript(lead).emailTemplate
    }));

    // Inserir em lotes de 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < scripts.length; i += BATCH_SIZE) {
      const batch = scripts.slice(i, i + BATCH_SIZE);
      await this.supabase.from('campaign_scripts').insert(batch);
    }

    return scripts;
  }

  // Enviar WhatsApp para um lead específico
  private async sendWhatsAppForLead(campaignId: string, userId: string, lead: any) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({
          action: 'sendSingle',
          campaignId,
          userId,
          lead
        })
      });

      if (!response.ok) throw new Error(`WhatsApp error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`WhatsApp failed for ${lead.empresa}:`, error);
      throw error;
    }
  }

  // Enviar Email para um lead específico
  private async sendEmailForLead(campaignId: string, userId: string, lead: any) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/email-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({
          action: 'sendSingle',
          campaignId,
          userId,
          lead
        })
      });

      if (!response.ok) throw new Error(`Email error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Email failed for ${lead.empresa}:`, error);
      throw error;
    }
  }

  // Processar WhatsApp para um lead específico - USA WHATSAPP-SERVICE
  private async processSingleLeadWhatsApp(campaignId: string, userId: string, lead: any) {
    // A função whatsapp-service já faz toda a validação e disparo
    // Ela registra automaticamente interações, oportunidades e atualiza status
    console.log(`📱 Delegando WhatsApp para ${lead.empresa} ao whatsapp-service`);
    
    // Simplesmente delegar para o serviço especializado
    // O whatsapp-service já cuida de tudo: validação, envio, registro de interações e oportunidades
  }

  // Processar E-mail para um lead específico - USA EMAIL-SERVICE
  private async processSingleLeadEmail(campaignId: string, userId: string, lead: any) {
    // A função email-service já faz toda a validação e disparo
    // Ela registra automaticamente interações e atualiza status
    console.log(`📧 Delegando E-mail para ${lead.empresa} ao email-service`);
    
    // Simplesmente delegar para o serviço especializado
    // O email-service já cuida de tudo: validação, envio, registro de interações
  }

  // MÉTODO LEGADO - mantido para compatibilidade
  async generateCampaignScripts(campaignId: string, leads: any[]) {
    return this.generateCampaignScriptsFast(campaignId, leads);
  }

  // Gerar script com IA (Gemini)
  async generateAIScript(lead: any, apiKey: string) {
    const prompt = `
Você é um especialista em vendas B2B para conta PJ do C6 Bank. 
Crie scripts personalizados para:

EMPRESA: ${lead.empresa}
SETOR: ${lead.setor || 'Não informado'}
CONTATO: ${lead.contato_decisor || '[Responsável]'}

PRODUTO: Conta PJ C6 Bank
BENEFÍCIOS: Conta gratuita, Pix ilimitado, 100 TEDs/boletos grátis, crédito sujeito a análise

Retorne um JSON com:
{
  "callScript": "Script de ligação profissional e direto (máx 100 palavras)",
  "emailSubject": "Assunto atrativo (máx 50 caracteres)",
  "emailTemplate": "E-mail executivo com benefícios específicos (máx 150 palavras)"
}

Foque em redução de custos bancários e facilidades operacionais.
`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
          }
        })
      });

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Extrair JSON do conteúdo
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Erro na geração com IA:', error);
    }

    return this.generateTemplateScript(lead);
  }

  // Script template de fallback
  generateTemplateScript(lead: any) {
    const empresa = lead.empresa || '[EMPRESA]';
    const contato = lead.contato_decisor || '[Responsável]';

    return {
      callScript: `Bom dia, ${contato}. Falo da Infinity, escritório autorizado C6 Bank. Temos uma proposta para reduzir custos bancários da ${empresa} com conta PJ 100% gratuita, Pix ilimitado e 100 TEDs/boletos grátis. Posso enviar os detalhes?`,
      emailSubject: `Conta PJ gratuita - ${empresa}`,
      emailTemplate: `Prezado ${contato},\n\nSomos escritório autorizado do C6 Bank e identificamos oportunidade para a ${empresa} reduzir custos bancários.\n\nBenefícios imediatos:\n• Conta PJ 100% gratuita\n• Pix ilimitado sem custo\n• 100 TEDs e boletos gratuitos/mês\n• Acesso a crédito sujeito a análise\n\nPodemos agendar uma apresentação dos benefícios?\n\nAtenciosamente,\nEscritório Infinity - C6 Bank PJ`
    };
  }

  // Criar interações no CRM - REMOVIDO, as interações são criadas individualmente em cada disparo
  async createCampaignInteractions(campaignId: string, userId: string, leads: any[]) {
    console.log('✅ Interações já registradas durante os disparos individuais');
    return leads.length;
  }

  // Agendar follow-ups automáticos
  async scheduleFollowUps(campaignId: string, userId: string) {
    const followUps = [
      {
        user_id: userId,
        tipo: 'follow_up_24h',
        assunto: 'Follow-up 24h - Conta PJ C6 Bank',
        descricao: 'Verificar respostas e agendar demonstração dos benefícios',
        data_interacao: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        user_id: userId,
        tipo: 'follow_up_72h',
        assunto: 'Follow-up 72h - Proposta C6 Bank',
        descricao: 'Ligação de conversão para finalizar abertura da conta',
        data_interacao: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      }
    ];

    await this.supabase
      .from('interactions')
      .insert(followUps);

    return followUps.length;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, userId, campaignId, campaignData } = body;

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

    const campaignService = new CampaignService(supabase);

    let result;

    switch (action) {
      case 'create':
        result = await campaignService.createCampaign(campaignData);
        break;
      case 'run':
        result = await campaignService.runCampaign(campaignId, userId);
        break;
      case 'scheduleFollowUps':
        result = await campaignService.scheduleFollowUps(campaignId, userId);
        break;
      default:
        throw new Error('Ação não reconhecida');
    }

    return new Response(JSON.stringify({ 
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no CampaignService:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});