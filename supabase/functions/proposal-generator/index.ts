import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleGeminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProposalRequest {
  leadId: string;
  userId: string;
  leadData?: {
    empresa: string;
    setor: string;
    regime_tributario?: string;
    contato_decisor: string;
    email: string;
    telefone?: string;
  };
  customizations?: {
    services: string[];
    urgency: 'normal' | 'urgent';
    budget_range?: string;
  };
}

const SERVICES_CATALOG = {
  'recuperacao_creditos': {
    name: 'Recuperação de Créditos Tributários',
    description: 'Identificação e recuperação de créditos de ICMS, PIS/COFINS, IRPJ/CSLL',
    price_range: 'R$ 15.000 - R$ 50.000',
    duration: '3-6 meses'
  },
  'planejamento_tributario': {
    name: 'Planejamento Tributário Avançado',
    description: 'Estratégias de otimização fiscal para grandes empresas',
    price_range: 'R$ 25.000 - R$ 80.000',
    duration: '6-12 meses'
  },
  'compliance_auditoria': {
    name: 'Compliance e Auditoria Fiscal',
    description: 'Blindagem jurídica e conformidade tributária',
    price_range: 'R$ 20.000 - R$ 60.000',
    duration: '4-8 meses'
  },
  'reestruturacao_societaria': {
    name: 'Reestruturação Societária',
    description: 'Otimização da estrutura societária com foco tributário',
    price_range: 'R$ 30.000 - R$ 100.000',
    duration: '6-10 meses'
  },
  'incentivos_fiscais': {
    name: 'Incentivos Fiscais e Regimes Especiais',
    description: 'Aproveitamento de benefícios fiscais específicos do setor',
    price_range: 'R$ 10.000 - R$ 40.000',
    duration: '2-4 meses'
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Proposal generator function started');
    
    const body = await req.json();
    const { leadId, userId, leadData, customizations } = body as ProposalRequest;

    if (!leadId || !userId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Parâmetros obrigatórios: leadId, userId'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar dados do lead se não fornecidos
    let lead = leadData;
    if (!lead) {
      const { data: leadFromDB, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single();

      if (leadError || !leadFromDB) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Lead não encontrado'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      lead = leadFromDB;
    }

    // Buscar dados do consultor
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, company')
      .eq('user_id', userId)
      .single();

    const consultorName = profile?.display_name || 'Consultor Tributário';
    const consultorCompany = profile?.company || 'Consultoria Tributária Especializada';

    // Determinar serviços recomendados baseado no setor e regime tributário
    const recommendedServices = determineRecommendedServices(lead.setor, lead.regime_tributario);

    // Gerar proposta personalizada com IA
    if (!googleGeminiApiKey) {
      // Gerar proposta estática se não houver IA
      const proposalContent = generateStaticProposal(lead, consultorName, consultorCompany, recommendedServices);
      
      return new Response(JSON.stringify({
        success: true,
        proposal: proposalContent,
        proposalId: `PROP-${Date.now()}`,
        generatedBy: 'template'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gerar proposta com IA
    const aiProposal = await generateAIProposal(lead, consultorName, consultorCompany, recommendedServices);

    // Salvar proposta no banco
    const proposalData = {
      user_id: userId,
      lead_id: leadId,
      lead_name: lead.empresa,
      proposal_content: aiProposal,
      services_included: recommendedServices.map(s => s.key),
      status: 'enviada',
      created_at: new Date().toISOString()
    };

    const { data: savedProposal, error: saveError } = await supabase
      .from('proposals')
      .insert(proposalData)
      .select()
      .single();

    if (saveError) {
      console.error('Erro ao salvar proposta:', saveError);
      // Criar tabela se não existir
      await createProposalsTable(supabase);
      
      // Tentar salvar novamente
      const { data: retryProposal, error: retryError } = await supabase
        .from('proposals')
        .insert(proposalData)
        .select()
        .single();
        
      if (retryError) {
        console.log('Continuando sem salvar no banco...');
      } else {
        savedProposal = retryProposal;
      }
    }

    // Registrar interação no CRM
    await supabase
      .from('interactions')
      .insert({
        user_id: userId,
        contact_id: leadId,
        tipo: 'proposta',
        assunto: `Proposta Comercial - ${lead.empresa}`,
        descricao: `Proposta gerada automaticamente com serviços: ${recommendedServices.map(s => s.name).join(', ')}`,
        data_interacao: new Date().toISOString()
      });

    // Formatar para WhatsApp
    const whatsappMessage = formatWhatsAppProposal(lead, aiProposal, consultorName);

    console.log('Proposta gerada com sucesso');

    return new Response(JSON.stringify({
      success: true,
      message: 'Proposta gerada e enviada com sucesso!',
      proposal: aiProposal,
      proposalId: savedProposal?.id || `PROP-${Date.now()}`,
      whatsappMessage,
      recommendedServices,
      generatedBy: 'ai'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in proposal-generator function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateAIProposal(lead: any, consultorName: string, consultorCompany: string, services: any[]) {
  const prompt = `Você é um especialista em consultoria tributária para grandes empresas em Goiás. 

Gere uma proposta comercial profissional e persuasiva para:

**DADOS DO CLIENTE:**
- Empresa: ${lead.empresa}
- Setor: ${lead.setor || 'Não informado'}
- Regime Tributário: ${lead.regime_tributario || 'A definir'}
- Contato: ${lead.contato_decisor || 'Decisor'}

**CONSULTOR:** ${consultorName}
**EMPRESA:** ${consultorCompany}

**SERVIÇOS RECOMENDADOS:**
${services.map(s => `- ${s.name}: ${s.description} (${s.price_range})`).join('\n')}

**ESTRUTURA DA PROPOSTA:**
1. Apresentação personalizada da empresa cliente
2. Diagnóstico das oportunidades tributárias do setor
3. Serviços propostos com benefícios específicos
4. Investimento e condições comerciais
5. Próximos passos e timeline
6. Call-to-action persuasivo

**TOM:** Profissional, consultivo, técnico mas acessível, focado em ROI e benefícios tangíveis.

**TAMANHO:** Proposta concisa mas completa, entre 800-1200 palavras.

Gere a proposta em formato de texto corrido, bem estruturada e pronta para envio.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleGeminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro na API do Gemini: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
    return data.candidates[0].content.parts[0].text;
  } else {
    throw new Error('Resposta inválida da IA');
  }
}

function generateStaticProposal(lead: any, consultorName: string, consultorCompany: string, services: any[]): string {
  return `🏢 **PROPOSTA COMERCIAL - ${lead.empresa.toUpperCase()}**

Prezado(a) ${lead.contato_decisor || 'Gestor'},

É com grande satisfação que apresentamos nossa proposta de consultoria tributária especializada para ${lead.empresa}, reconhecendo o potencial de otimização fiscal significativo em empresas do setor ${lead.setor || 'de grande porte'}.

**🎯 DIAGNÓSTICO INICIAL**

Com base em nossa experiência com empresas similares, identificamos oportunidades estratégicas de:
• Redução da carga tributária em até 30%
• Recuperação de créditos tributários históricos
• Otimização do regime tributário atual
• Blindagem jurídica e compliance fiscal

**💼 SERVIÇOS PROPOSTOS**

${services.map(service => `
**${service.name}**
${service.description}
• Prazo de execução: ${service.duration}
• Investimento: ${service.price_range}
`).join('\n')}

**💰 RETORNO SOBRE INVESTIMENTO**

Nossos clientes do setor ${lead.setor || 'empresarial'} obtêm em média um ROI de 8:1, ou seja, para cada R$ 1,00 investido em consultoria, economizam R$ 8,00 em tributos.

**📋 PRÓXIMOS PASSOS**

1. Assinatura da proposta
2. Análise documental inicial (15 dias)
3. Apresentação do diagnóstico detalhado
4. Execução das estratégias aprovadas

**⏰ CONDIÇÕES ESPECIAIS**

Esta proposta é válida por 30 dias e inclui:
✅ Diagnóstico tributário gratuito
✅ Acompanhamento especializado
✅ Relatórios mensais de economia
✅ Suporte jurídico incluso

---

**${consultorName}**
**${consultorCompany}**
Especialista em Consultoria Tributária

*"Transformamos complexidade tributária em vantagem competitiva"*`;
}

function determineRecommendedServices(setor: string, regimeTributario: string) {
  const services = [];
  
  // Serviços base para todos
  services.push(SERVICES_CATALOG.recuperacao_creditos);
  services.push(SERVICES_CATALOG.planejamento_tributario);
  
  // Específicos por setor
  if (setor?.toLowerCase().includes('agro') || setor?.toLowerCase().includes('alimento')) {
    services.push(SERVICES_CATALOG.incentivos_fiscais);
  }
  
  if (setor?.toLowerCase().includes('construção') || setor?.toLowerCase().includes('energia')) {
    services.push(SERVICES_CATALOG.reestruturacao_societaria);
  }
  
  // Específicos por regime
  if (regimeTributario?.toLowerCase().includes('real')) {
    services.push(SERVICES_CATALOG.compliance_auditoria);
  }
  
  return services.map((service, index) => ({
    key: Object.keys(SERVICES_CATALOG)[Object.values(SERVICES_CATALOG).indexOf(service)],
    ...service
  }));
}

function formatWhatsAppProposal(lead: any, proposal: string, consultorName: string): string {
  const summary = proposal.substring(0, 300) + '...';
  
  return `📋 *PROPOSTA COMERCIAL PERSONALIZADA* 📋

Olá *${lead.contato_decisor || 'Gestor'}*!

Preparei uma proposta comercial especialmente para *${lead.empresa}* com oportunidades concretas de otimização tributária.

${summary}

📎 *A proposta completa será enviada por e-mail*

🎯 *Principais benefícios identificados:*
• Redução significativa da carga tributária
• Recuperação de créditos históricos  
• Compliance e blindagem jurídica
• ROI médio de 8:1

💬 Gostaria de agendar uma ligação para apresentar os detalhes?

*${consultorName}*
Especialista em Consultoria Tributária`;
}

async function createProposalsTable(supabase: any) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS proposals (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      lead_id UUID,
      lead_name TEXT NOT NULL,
      proposal_content TEXT NOT NULL,
      services_included TEXT[],
      status TEXT DEFAULT 'enviada',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can manage their own proposals" 
    ON proposals FOR ALL 
    USING (auth.uid() = user_id);
  `;
  
  try {
    await supabase.rpc('exec', { sql: createTableSQL });
  } catch (error) {
    console.log('Tabela proposals já existe ou erro na criação:', error);
  }
}