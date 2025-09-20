import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Usando a chave de API do Google Gemini
const googleGeminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, leadIds } = await req.json();
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Buscar leads para qualificar
    let leadsQuery = supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId);
      
    if (leadIds && leadIds.length > 0) {
      leadsQuery = leadsQuery.in('id', leadIds);
    } else {
      leadsQuery = leadsQuery.eq('status', 'novo').limit(10);
    }
    
    const { data: leads, error: fetchError } = await leadsQuery;

    if (fetchError) {
      throw new Error(`Database fetch error: ${fetchError.message}`);
    }

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum lead encontrado para qualificação.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const qualifiedLeads = [];

    for (const lead of leads) {
      if (!googleGeminiApiKey) {
        console.error('Google Gemini API key não configurada. Pulando qualificação.');
        continue;
      }
      
      const prompt = `
     
Você é um especialista em qualificação de leads B2B para consultoria tributária.
Analise a seguinte empresa, utilizando fontes de dados públicas e auditáveis, e gere um relatório de qualificação completo e acionável com base nos seguintes dados de entrada:

    Empresa: ${lead.empresa}

    Setor: ${lead.setor}

    CNAE: ${lead.cnae}

    Regime Tributário: ${lead.regime_tributario}

    Contato Decisor: ${lead.contato_decisor}

Tarefas e Fontes de Dados

    Análise de Notícias e Eventos:

        Pesquise eventos corporativos dos últimos 12 meses (fusões, aquisições, investimentos, expansões, IPOs, etc.) em veículos de imprensa de negócios e no Diário Oficial.

        Busque por balanços financeiros públicos e notícias sobre resultados que possam indicar uma alta carga tributária, perdas recorrentes ou problemas de fluxo de caixa.

        Identifique eventuais autuações fiscais, problemas de compliance ou mudanças regulatórias que afetam diretamente a empresa ou o setor.

    Identificação de Dores e Oportunidades:

        Com base no CNAE e no regime tributário, detalhe os desafios tributários específicos mais comuns para o setor. Foque em impostos complexos como ICMS, PIS/COFINS, IRPJ/CSLL, ou em questões de incentivos fiscais e regimes especiais.

        Relacione as notícias encontradas a uma dor ou oportunidade tributária concreta. Por exemplo:

            Anúncio de expansão -> Oportunidade para otimização do ICMS e aproveitamento de créditos.

            Balanço com alta carga tributária -> Dor de ineficiência fiscal.

            Fusão -> Necessidade de due diligence tributária.

    Avaliação e Priorização Estratégica:

        Atribua uma pontuação de qualificação (Score) de 1 a 5, onde 5 representa a mais alta prioridade e 1 a mais baixa. Justifique a pontuação com base nas dores e oportunidades identificadas.

        Defina um nível de urgência (Alta, Média, Baixa) para a abordagem, considerando a relevância e o prazo dos eventos recentes.

      
      Retorne APENAS um JSON válido no seguinte formato:
      {
        "qualificationScore": "A",
        "urgencyLevel": "Alta",
        "notes": "Empresa anunciou expansão de R$ 200M em nova unidade. Alto ICMS e possível aproveitamento de créditos. Setor em crescimento.",
        "bestContactTime": "Manhã (9h-11h)",
        "approachStrategy": "Focar em otimização fiscal da nova unidade",
        "estimatedRevenue": "R$ 50.000 - R$ 150.000"
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
              temperature: 0.3
            }
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.error(`Limite de requisições do Google Gemini atingido para lead ${lead.id}. Pulando...`);
            continue;
          }
          console.error(`Google Gemini API error for lead ${lead.id}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        
        let content = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
          content = data.candidates[0].content.parts[0].text;
        } else {
          console.error(`Resposta inválida da IA para lead ${lead.id}. Estrutura de dados inesperada.`);
          continue;
        }
        
        let qualificationData;
        try {
          // Clean the content more thoroughly
          let cleanedContent = content.trim();
          if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/```json\n?/g, '');
          }
          if (cleanedContent.endsWith('```')) {
            cleanedContent = cleanedContent.replace(/\n?```$/g, '');
          }
          
          // Find the JSON object in the response
          const jsonStart = cleanedContent.indexOf('{');
          const jsonEnd = cleanedContent.lastIndexOf('}');
          
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
          }
          
          qualificationData = JSON.parse(cleanedContent);
        } catch (parseError) {
          console.error(`JSON parse error for lead ${lead.id}:`, parseError);
          console.error(`Content that failed to parse for lead ${lead.id}:`, content.substring(0, 200));
          continue;
        }

        // Atualizar o lead no banco
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            status: 'qualificado',
            qualificationScore: qualificationData.qualificationScore,
            urgencyLevel: qualificationData.urgencyLevel,
            notes: qualificationData.notes,
            bestContactTime: qualificationData.bestContactTime,
            approach_strategy: qualificationData.approachStrategy,
            estimatedRevenue: qualificationData.estimatedRevenue,
          })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`Update error for lead ${lead.id}:`, updateError.message);
          continue;
        }

        qualifiedLeads.push({
          ...lead,
          ...qualificationData
        });

      } catch (error) {
        console.error(`Error qualifying lead ${lead.id}:`, error);
        continue;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${qualifiedLeads.length} leads qualificados com sucesso!`,
      qualifiedLeads
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in qualify-leads function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});