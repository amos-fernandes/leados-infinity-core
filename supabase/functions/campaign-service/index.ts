import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    
    const { data: campaign, error } = await this.supabase
      .from('campaigns')
      .insert({
        user_id: campaignData.userId,
        name: campaignData.name || `Campanha Infinity - ${new Date().toLocaleDateString('pt-BR')}`,
        description: campaignData.description || 'Campanha automatizada para conta PJ C6 Bank',
        target_companies: campaignData.targetCompanies || [],
        status: 'ativa'
      })
      .select()
      .single();

    if (error) throw error;
    return campaign;
  }

  // Executar campanha multi-canal
  async runCampaign(campaignId: string, userId: string) {
    console.log('📊 CampaignService: Executando campanha multi-canal');
    
    const results = {
      whatsapp: null,
      email: null,
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

      // 2. Gerar scripts personalizados
      console.log('📝 Gerando scripts personalizados...');
      const scripts = await this.generateCampaignScripts(campaignId, leads);
      results.scripts = { 
        status: 'success', 
        count: scripts.length,
        details: 'Scripts personalizados criados com IA'
      };

      // 3. Disparar WhatsApp (canal prioritário)
      try {
        console.log('📱 Disparando WhatsApp...');
        const { data: whatsappResult, error: whatsappError } = await this.supabase.functions.invoke('whatsapp-service', {
          body: { campaignId, userId, channel: 'whatsapp' }
        });

        results.whatsapp = whatsappError ? 
          { status: 'failed', error: whatsappError.message } :
          { status: 'success', sent: whatsappResult?.sent || 0 };
      } catch (error) {
        results.whatsapp = { status: 'failed', error: error.message };
      }

      // 4. Disparar E-mails (canal de reforço)
      try {
        console.log('📧 Disparando E-mails...');
        const { data: emailResult, error: emailError } = await this.supabase.functions.invoke('email-service', {
          body: { campaignId, userId, channel: 'email' }
        });

        results.email = emailError ? 
          { status: 'failed', error: emailError.message } :
          { status: 'success', sent: emailResult?.sent || 0 };
      } catch (error) {
        results.email = { status: 'failed', error: error.message };
      }

      // 5. Registrar interações no CRM
      const interactionCount = await this.createCampaignInteractions(campaignId, userId, leads);
      results.interactions = { 
        status: 'success', 
        count: interactionCount,
        details: 'Interações registradas no CRM'
      };

      return {
        success: true,
        campaignId,
        results,
        totalLeads: leads.length
      };

    } catch (error) {
      console.error('❌ Erro na execução da campanha:', error);
      return {
        success: false,
        campaignId,
        error: error.message,
        results
      };
    }
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

  // Criar interações no CRM
  async createCampaignInteractions(campaignId: string, userId: string, leads: any[]) {
    const interactions = leads.map(lead => ({
      user_id: userId,
      lead_id: lead.id,
      tipo: 'campanha_automatizada',
      assunto: `Campanha Multi-canal - ${lead.empresa}`,
      descricao: `Campanha automatizada executada: WhatsApp + E-mail + Scripts de ligação para ${lead.empresa}. Foco: Conta PJ C6 Bank com benefícios exclusivos.`,
      data_interacao: new Date().toISOString()
    }));

    const { error } = await this.supabase
      .from('interactions')
      .insert(interactions);

    if (error) {
      console.error('Erro ao criar interações:', error);
      return 0;
    }

    return interactions.length;
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