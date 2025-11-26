import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch CRM data
    const [leadsRes, opportunitiesRes, interactionsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('user_id', userId).limit(100),
      supabase.from('opportunities').select('*').eq('user_id', userId).limit(50),
      supabase.from('interactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
    ]);

    const leads = leadsRes.data || [];
    const opportunities = opportunitiesRes.data || [];
    const interactions = interactionsRes.data || [];

    // Calculate metrics
    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter(l => l.status === 'qualificado').length;
    const newLeads = leads.filter(l => l.status === 'novo').length;
    const contactedLeads = leads.filter(l => l.status === 'em_contato').length;
    
    const totalOpportunities = opportunities.length;
    const pipelineValue = opportunities.reduce((sum, o) => sum + (o.valor || 0), 0);
    const closedOpportunities = opportunities.filter(o => o.estagio === 'fechamento').length;
    const conversionRate = totalLeads > 0 ? ((closedOpportunities / totalLeads) * 100).toFixed(1) : '0';

    // Distribution by stage
    const stageDistribution = {
      prospeccao: opportunities.filter(o => o.estagio === 'prospeccao').length,
      qualificacao: opportunities.filter(o => o.estagio === 'qualificacao').length,
      proposta: opportunities.filter(o => o.estagio === 'proposta').length,
      negociacao: opportunities.filter(o => o.estagio === 'negociacao').length,
      fechamento: opportunities.filter(o => o.estagio === 'fechamento').length,
    };

    // Lead status distribution
    const statusDistribution = {
      novo: newLeads,
      em_contato: contactedLeads,
      qualificado: qualifiedLeads,
      convertido: leads.filter(l => l.status === 'convertido').length,
      perdido: leads.filter(l => l.status === 'perdido').length,
    };

    // Recent activity
    const recentInteractions = interactions.slice(0, 10).map(i => ({
      tipo: i.tipo,
      assunto: i.assunto,
      data: i.data_interacao
    }));

    // Build context for AI
    const crmContext = `
## CRM Data Summary:
- Total Leads: ${totalLeads}
- Qualified Leads: ${qualifiedLeads} (${totalLeads > 0 ? ((qualifiedLeads/totalLeads)*100).toFixed(1) : 0}%)
- New Leads: ${newLeads}
- Leads In Contact: ${contactedLeads}
- Total Opportunities: ${totalOpportunities}
- Pipeline Value: R$ ${pipelineValue.toLocaleString('pt-BR')}
- Conversion Rate: ${conversionRate}%
- Closed Deals: ${closedOpportunities}

## Pipeline Stages:
- Prospecção: ${stageDistribution.prospeccao}
- Qualificação: ${stageDistribution.qualificacao}
- Proposta: ${stageDistribution.proposta}
- Negociação: ${stageDistribution.negociacao}
- Fechamento: ${stageDistribution.fechamento}

## Recent Activity:
${recentInteractions.map(i => `- ${i.tipo}: ${i.assunto}`).join('\n')}

## Top Leads (by potential):
${leads.slice(0, 5).map(l => `- ${l.empresa} (${l.status}) - ${l.setor || 'Setor não definido'}`).join('\n')}
`;

    let systemPrompt = '';
    let userPrompt = '';

    if (action === 'insights') {
      systemPrompt = `Você é um consultor de vendas B2B especialista em análise de CRM. Responda sempre em português brasileiro de forma clara e objetiva.`;
      userPrompt = `Baseado nos dados do CRM abaixo, forneça 3-5 insights estratégicos acionáveis para melhorar as vendas. Seja específico e prático.

${crmContext}

Formato da resposta (JSON):
{
  "insights": [
    {
      "title": "Título do insight",
      "description": "Descrição detalhada",
      "priority": "high|medium|low",
      "action": "Ação recomendada específica"
    }
  ],
  "summary": "Resumo executivo em 2-3 frases"
}`;
    } else if (action === 'lead_scoring') {
      systemPrompt = `Você é um especialista em lead scoring B2B. Analise os leads e atribua scores de 0-100 baseado em potencial de conversão.`;
      userPrompt = `Analise os seguintes leads e forneça uma pontuação de scoring:

${leads.slice(0, 20).map(l => `
Lead: ${l.empresa}
- Status: ${l.status}
- Setor: ${l.setor || 'N/A'}
- Email: ${l.email ? 'Sim' : 'Não'}
- Telefone: ${l.telefone ? 'Sim' : 'Não'}
- Website: ${l.website ? 'Sim' : 'Não'}
`).join('\n---\n')}

Formato da resposta (JSON):
{
  "scores": [
    {
      "empresa": "Nome da empresa",
      "score": 85,
      "reasoning": "Motivo do score",
      "next_action": "Próxima ação recomendada"
    }
  ]
}`;
    } else if (action === 'recommendations') {
      systemPrompt = `Você é um estrategista de vendas B2B. Forneça recomendações personalizadas baseadas na análise do pipeline.`;
      userPrompt = `Baseado no estado atual do CRM, quais são as 5 principais ações que devo tomar esta semana para maximizar conversões?

${crmContext}

Formato da resposta (JSON):
{
  "recommendations": [
    {
      "action": "Ação específica",
      "reason": "Por que fazer isso",
      "expected_impact": "Impacto esperado",
      "priority": 1
    }
  ],
  "weekly_focus": "Foco principal da semana em uma frase"
}`;
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    console.log(`📊 CRM AI Insights - Action: ${action}`);
    console.log(`📈 Leads: ${totalLeads}, Opportunities: ${totalOpportunities}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Rate limit exceeded. Please try again later." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Payment required. Please add credits to your Lovable workspace." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let parsedContent;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedContent = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      parsedContent = { raw: content };
    }

    // Include metrics in response
    const responseData = {
      success: true,
      action,
      data: parsedContent,
      metrics: {
        totalLeads,
        qualifiedLeads,
        newLeads,
        contactedLeads,
        totalOpportunities,
        pipelineValue,
        conversionRate: parseFloat(conversionRate),
        closedOpportunities,
        stageDistribution,
        statusDistribution
      }
    };

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("CRM AI Insights error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
