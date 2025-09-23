import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const googleGeminiApiKey = Deno.env.get('GEMINI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadQualification {
  bant: {
    budget: {
      score: number;
      analysis: string;
    };
    authority: {
      score: number;
      analysis: string;
    };
    need: {
      score: number;
      analysis: string;
    };
    timeline: {
      score: number;
      analysis: string;
    };
  };
  overallScore: number;
  qualificationLevel: 'Alta' | 'Média' | 'Baixa';
  approachStrategy: string;
  channelRecommendation: {
    primary: string;
    secondary: string;
    reasoning: string;
  };
  estimatedRevenue: string;
  nextSteps: string[];
}

async function qualifyWithAI(leadData: any): Promise<LeadQualification | null> {
  if (!googleGeminiApiKey) {
    console.error('Google Gemini API key não configurada');
    return null;
  }

  const prompt = `
Você é um especialista em qualificação de leads B2B para consultoria tributária.

Analise o seguinte lead e forneça uma qualificação BANT completa:

DADOS DO LEAD:
- Empresa: ${leadData.empresa}
- Setor: ${leadData.setor || 'Não informado'}
- CNAE: ${leadData.cnae || 'Não informado'}
- Regime Tributário: ${leadData.regime_tributario || 'Não informado'}
- Contato Decisor: ${leadData.contato_decisor || 'Não informado'}
- Telefone: ${leadData.telefone || 'Não informado'}
- Email: ${leadData.email || 'Não informado'}
- Website: ${leadData.website || 'Não informado'}
- Eventos Recentes: ${leadData.recent_events || 'Nenhum evento identificado'}

CRITÉRIOS DE QUALIFICAÇÃO BANT:

1. BUDGET (Orçamento): Avalie a capacidade financeira da empresa baseado no setor, regime tributário e eventos recentes. Score 1-10.

2. AUTHORITY (Autoridade): Avalie se o contato tem poder de decisão baseado no cargo/posição informada. Score 1-10.

3. NEED (Necessidade): Analise a dor tributária baseada no setor, regime e complexidade fiscal. Score 1-10.

4. TIMELINE (Urgência): Determine a urgência baseada nos eventos recentes e situação tributária. Score 1-10.

Forneça também:
- Estratégia de abordagem específica
- Recomendação de canal (WhatsApp, Email, Telefone) com justificativa
- Estimativa de receita potential
- Próximos passos recomendados

IMPORTANTE: Retorne APENAS um JSON válido no seguinte formato:

{
  "bant": {
    "budget": {
      "score": 8,
      "analysis": "Empresa do setor industrial com regime tributário complexo indica porte médio/grande com orçamento para consultoria"
    },
    "authority": {
      "score": 7,
      "analysis": "Contato identificado como CFO, possui autoridade para decisões de consultoria fiscal"
    },
    "need": {
      "score": 9,
      "analysis": "Regime tributário complexo e setor com alta carga fiscal indicam necessidade clara de otimização"
    },
    "timeline": {
      "score": 8,
      "analysis": "Eventos recentes de expansão criam urgência para planejamento fiscal imediato"
    }
  },
  "overallScore": 8.0,
  "qualificationLevel": "Alta",
  "approachStrategy": "Focar na otimização fiscal da expansão recente, destacando economia potencial de impostos e compliance",
  "channelRecommendation": {
    "primary": "WhatsApp",
    "secondary": "Email",
    "reasoning": "WhatsApp para primeiro contato mais direto, email para envio de materiais técnicos"
  },
  "estimatedRevenue": "R$ 80.000 - R$ 200.000",
  "nextSteps": [
    "Enviar mensagem inicial via WhatsApp mencionando expansão recente",
    "Agendar reunião para apresentação de case similar",
    "Preparar proposta de diagnóstico fiscal gratuito"
  ]
}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleGeminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048
        }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Limite de requisições do Google Gemini atingido');
        return null;
      }
      console.error(`Google Gemini API error: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    let content = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      content = data.candidates[0].content.parts[0].text;
    } else {
      console.error('Resposta inválida da IA');
      return null;
    }
    
    // Limpar e parsear o JSON
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/```json\n?/g, '');
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.replace(/\n?```$/g, '');
    }
    
    const jsonStart = cleanedContent.indexOf('{');
    const jsonEnd = cleanedContent.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
    }
    
    return JSON.parse(cleanedContent);
    
  } catch (error) {
    console.error('Erro na qualificação com IA:', error);
    return null;
  }
}

function generateFallbackQualification(leadData: any): LeadQualification {
  // Qualificação básica baseada em regras quando IA não está disponível
  let budgetScore = 5;
  let authorityScore = 5;
  let needScore = 6;
  let timelineScore = 5;

  // Budget baseado no regime tributário
  if (leadData.regime_tributario === 'lucro_real') budgetScore = 8;
  else if (leadData.regime_tributario === 'lucro_presumido') budgetScore = 6;
  else if (leadData.regime_tributario === 'simples_nacional') budgetScore = 4;

  // Authority baseado no contato
  if (leadData.contato_decisor?.toLowerCase().includes('cfo') || 
      leadData.contato_decisor?.toLowerCase().includes('diretor financeiro')) {
    authorityScore = 8;
  } else if (leadData.contato_decisor?.toLowerCase().includes('contador') ||
             leadData.contato_decisor?.toLowerCase().includes('gerente')) {
    authorityScore = 6;
  }

  // Need baseado no setor
  const highNeedSectors = ['construção', 'indústria', 'agronegócio'];
  if (highNeedSectors.some(s => leadData.setor?.toLowerCase().includes(s))) {
    needScore = 8;
  }

  // Timeline baseado em eventos recentes
  if (leadData.recent_events) {
    timelineScore = 7;
  }

  const overallScore = (budgetScore + authorityScore + needScore + timelineScore) / 4;
  
  let qualificationLevel: 'Alta' | 'Média' | 'Baixa' = 'Baixa';
  if (overallScore >= 7) qualificationLevel = 'Alta';
  else if (overallScore >= 5) qualificationLevel = 'Média';

  return {
    bant: {
      budget: {
        score: budgetScore,
        analysis: `Score baseado no regime tributário ${leadData.regime_tributario || 'não informado'}`
      },
      authority: {
        score: authorityScore,
        analysis: `Score baseado no contato ${leadData.contato_decisor || 'não identificado'}`
      },
      need: {
        score: needScore,
        analysis: `Score baseado no setor ${leadData.setor || 'não informado'} e complexidade tributária`
      },
      timeline: {
        score: timelineScore,
        analysis: leadData.recent_events ? 'Eventos recentes indicam oportunidade' : 'Sem urgência identificada'
      }
    },
    overallScore: Math.round(overallScore * 10) / 10,
    qualificationLevel,
    approachStrategy: `Abordar com foco em otimização tributária para ${leadData.setor || 'o setor'}`,
    channelRecommendation: {
      primary: leadData.telefone ? 'WhatsApp' : 'Email',
      secondary: leadData.email ? 'Email' : 'Telefone',
      reasoning: 'Canal baseado nos contatos disponíveis'
    },
    estimatedRevenue: qualificationLevel === 'Alta' ? 'R$ 50.000 - R$ 150.000' : 
                     qualificationLevel === 'Média' ? 'R$ 20.000 - R$ 80.000' : 'R$ 10.000 - R$ 40.000',
    nextSteps: [
      'Fazer contato inicial',
      'Apresentar casos de sucesso do setor',
      'Agendar reunião de diagnóstico'
    ]
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, userId, leadData } = await req.json();
    
    if (!leadData || !leadId || !userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Dados do lead, leadId e userId são obrigatórios' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Tentar qualificação com IA primeiro
    let qualification = await qualifyWithAI(leadData);
    
    // Se falhou, usar qualificação de fallback
    if (!qualification) {
      qualification = generateFallbackQualification(leadData);
    }

    // Atualizar lead no banco
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('leads')
      .update({
        status: 'qualificado',
        qualification_score: qualification.overallScore.toString(),
        qualification_level: qualification.qualificationLevel,
        approach_strategy: qualification.approachStrategy,
        estimated_revenue: qualification.estimatedRevenue,
        recommended_channel: qualification.channelRecommendation.primary,
        bant_analysis: JSON.stringify(qualification.bant),
        next_steps: JSON.stringify(qualification.nextSteps),
        qualified_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Erro ao atualizar lead: ${error.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: qualification,
      message: `Lead qualificado com sucesso! Nível: ${qualification.qualificationLevel} (Score: ${qualification.overallScore})`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in qualify-lead-with-ai function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});