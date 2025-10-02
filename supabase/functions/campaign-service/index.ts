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

  // Executar campanha multi-canal com resiliência a falhas
  async runCampaign(campaignId: string, userId: string) {
    console.log(`📊 CampaignService: Iniciando campanha resiliente ID: ${campaignId}`);
    
    const results: {
      whatsapp: any;
      email: any;
      scripts: any;
      interactions: any;
    } = {
      whatsapp: { successCount: 0, failureCount: 0, errors: [] },
      email: { successCount: 0, failureCount: 0, errors: [] },
      scripts: null,
      interactions: null
    };

    try {
      // 1. Buscar leads qualificados para a campanha
      const { data: leads } = await this.supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['qualificado', 'contatado', 'novo']);

      if (!leads || leads.length === 0) {
        throw new Error('Nenhum lead disponível para campanha');
      }

      console.log(`Encontrados ${leads.length} leads para processar`);

      // 2. Gerar scripts personalizados
      console.log('📝 Gerando scripts personalizados...');
      const scripts = await this.generateCampaignScripts(campaignId, leads);
      results.scripts = { 
        status: 'success', 
        count: scripts.length,
        details: 'Scripts personalizados criados com IA'
      };

      // 3. Executar WhatsApp via whatsapp-service
      console.log('📱 Chamando whatsapp-service para disparo...');
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const functionUrl = `${supabaseUrl}/functions/v1/whatsapp-service`;
        
        console.log(`Invocando WhatsApp Service: ${functionUrl}`);
        console.log(`Payload: campaignId=${campaignId}, userId=${userId}`);
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ 
            campaignId,
            userId
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`WhatsApp Service error (${response.status}): ${errorText}`);
        }

        const whatsappResult = await response.json();
        
        results.whatsapp = {
          successCount: whatsappResult?.sent || 0,
          failureCount: whatsappResult?.errors?.length || 0,
          errors: whatsappResult?.errors || [],
          details: whatsappResult
        };
        console.log(`✅ WhatsApp: ${whatsappResult?.sent || 0} enviados`);
      } catch (whatsappError) {
        console.error('❌ Erro no whatsapp-service:', whatsappError);
        results.whatsapp = {
          successCount: 0,
          failureCount: leads.length,
          errors: [{ error: whatsappError instanceof Error ? whatsappError.message : 'Erro WhatsApp' }]
        };
      }

      // 4. Executar E-mail via email-service
      console.log('📧 === INICIANDO ENVIO DE E-MAILS ===');
      console.log(`📊 Leads totais: ${leads.length}`);
      console.log(`📊 Scripts criados: ${scripts.length}`);
      
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!supabaseUrl || !serviceRoleKey) {
          throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
        }
        
        const functionUrl = `${supabaseUrl}/functions/v1/email-service`;
        
        console.log(`📧 Invocando Email Service: ${functionUrl}`);
        console.log(`📧 Payload: campaignId=${campaignId}, userId=${userId}`);
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`
          },
          body: JSON.stringify({ 
            campaignId,
            userId
          })
        });

        console.log(`📧 Email Service Response Status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Email Service Error Response: ${errorText}`);
          throw new Error(`Email Service error (${response.status}): ${errorText}`);
        }

        const emailResult = await response.json();
        console.log(`📧 Email Service Result:`, JSON.stringify(emailResult));
        
        results.email = {
          successCount: emailResult?.sent || 0,
          failureCount: emailResult?.errors?.length || 0,
          errors: emailResult?.errors || [],
          details: emailResult
        };
        console.log(`✅ E-mail: ${emailResult?.sent || 0} enviados com sucesso`);
      } catch (emailError) {
        console.error('❌ ERRO CRÍTICO no email-service:', emailError);
        console.error('Stack trace:', emailError instanceof Error ? emailError.stack : 'N/A');
        results.email = {
          successCount: 0,
          failureCount: leads.length,
          errors: [{ error: emailError instanceof Error ? emailError.message : 'Erro E-mail desconhecido' }],
          criticalError: true
        };
      }
      
      console.log('📧 === ENVIO DE E-MAILS FINALIZADO ===');

      // 5. Interações já foram registradas pelos serviços individuais
      results.interactions = { 
        status: 'success', 
        count: results.whatsapp.successCount + results.email.successCount,
        details: 'Interações registradas automaticamente por whatsapp-service e email-service'
      };

      console.log(`🎯 Campanha finalizada. WhatsApp: ${results.whatsapp.successCount}/${leads.length}, E-mail: ${results.email.successCount}/${leads.length}`);

      return {
        success: true,
        campaignId,
        results,
        totalLeads: leads.length,
        summary: `Sucessos: WhatsApp ${results.whatsapp.successCount}, E-mail ${results.email.successCount}. Falhas: WhatsApp ${results.whatsapp.failureCount}, E-mail ${results.email.failureCount}`
      };

    } catch (error) {
      console.error('❌ Erro crítico na campanha:', error);
      
      // Reverter status da campanha em caso de erro crítico
      await this.supabase
        .from('campaigns')
        .update({ status: 'erro' })
        .eq('id', campaignId);

      return {
        success: false,
        campaignId,
        error: error instanceof Error ? error.message : 'Erro crítico desconhecido',
        results
      };
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

  // Gerar scripts personalizados com IA
  async generateCampaignScripts(campaignId: string, leads: any[]) {
    const scripts = [];
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    for (const lead of leads) {
      try {
        let script;
        
        if (geminiApiKey) {
          script = await this.generateAIScript(lead, geminiApiKey);
        } else {
          script = this.generateTemplateScript(lead);
        }

        const scriptData = {
          campaign_id: campaignId,
          empresa: lead.empresa,
          roteiro_ligacao: script.callScript,
          assunto_email: script.emailSubject,
          modelo_email: script.emailTemplate
        };

        scripts.push(scriptData);
      } catch (error) {
        console.error(`Erro ao gerar script para ${lead.empresa}:`, error);
      }
    }

    // Inserir scripts no banco
    if (scripts.length > 0) {
      const { error } = await this.supabase
        .from('campaign_scripts')
        .insert(scripts);

      if (error) {
        console.error('Erro ao inserir scripts:', error);
      }
    }

    return scripts;
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