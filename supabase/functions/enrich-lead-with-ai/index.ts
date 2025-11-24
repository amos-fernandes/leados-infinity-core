import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadEnrichment {
  website?: string;
  linkedin?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  setor?: string;
  porte?: string;
  decisor?: string;
  cargo_decisor?: string;
  insights?: string;
}

async function enrichWithOpenAI(leadData: any): Promise<LeadEnrichment | null> {
  if (!openaiApiKey) {
    console.error('OPENAI_API_KEY não configurada');
    return null;
  }

  const prompt = `Você é um especialista em enriquecimento de dados B2B. Analise as informações da empresa e forneça dados adicionais que possam ser úteis:

DADOS DISPONÍVEIS:
- Empresa: ${leadData.empresa}
- Setor: ${leadData.setor || 'Não informado'}
- CNAE: ${leadData.cnae || 'Não informado'}
- Cidade: ${leadData.cidade || 'Não informado'}
- Estado: ${leadData.uf || 'Não informado'}
- Telefone: ${leadData.telefone || 'Não informado'}
- Email: ${leadData.email || 'Não informado'}
- Website: ${leadData.website || 'Não informado'}

Sua tarefa é INFERIR e SUGERIR (baseado em conhecimento geral e padrões de mercado):
1. Website provável (se não fornecido)
2. LinkedIn da empresa (se não fornecido)
3. Email profissional mais provável (se não fornecido)
4. Telefone formatado corretamente (se fornecido)
5. WhatsApp provável da empresa (se não fornecido)
6. Setor específico (se apenas CNAE fornecido)
7. Porte estimado da empresa
8. Nome provável do decisor financeiro/CEO
9. Cargo do decisor
10. Insights sobre a empresa e oportunidades de abordagem

IMPORTANTE: 
- Para website, tente inferir o domínio mais provável baseado no nome da empresa
- Para LinkedIn, use o padrão: linkedin.com/company/nome-da-empresa-simplificado
- Para email, use padrões como: contato@dominio.com.br, comercial@dominio.com.br
- Para telefone/WhatsApp, use formato brasileiro: +55DDXXXXXXXXX
- Seja específico mas realista nas inferências

Retorne APENAS um JSON válido no formato:
{
  "website": "https://www.exemplo.com.br",
  "linkedin": "https://linkedin.com/company/exemplo",
  "email": "contato@exemplo.com.br",
  "telefone": "+5511999999999",
  "whatsapp": "+5511999999999",
  "setor": "Setor específico",
  "porte": "Médio/Grande/Pequeno",
  "decisor": "Nome do Decisor",
  "cargo_decisor": "CEO/CFO/Diretor",
  "insights": "Insights sobre a empresa e como abordar"
}`;

  try {
    console.log('Iniciando enriquecimento com OpenAI...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em enriquecimento de dados B2B. Retorne sempre JSON válido com inferências realistas.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      console.error('Erro na API OpenAI:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('OpenAI response received');
    
    let content = '';
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      content = data.choices[0].message.content;
    } else {
      console.error('Estrutura de resposta inválida da OpenAI');
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
    
    console.log('Attempting to parse OpenAI response JSON...');
    return JSON.parse(cleanedContent);
    
  } catch (error) {
    console.error('Erro no enriquecimento com OpenAI:', error);
    return null;
  }
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

    console.log('🔍 Enriquecendo lead:', leadData.empresa);

    // Enriquecer com OpenAI
    const enrichment = await enrichWithOpenAI(leadData);
    
    if (!enrichment) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Não foi possível enriquecer o lead com IA'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atualizar lead no banco apenas com dados que não existem
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const updateData: any = {};
    
    // Apenas atualizar campos vazios
    if (!leadData.website && enrichment.website) updateData.website = enrichment.website;
    if (!leadData.linkedin && enrichment.linkedin) updateData.linkedin = enrichment.linkedin;
    if (!leadData.email && enrichment.email) updateData.email = enrichment.email;
    if (!leadData.telefone && enrichment.telefone) updateData.telefone = enrichment.telefone;
    if (!leadData.whatsapp && enrichment.whatsapp) updateData.whatsapp = enrichment.whatsapp;
    if (!leadData.setor && enrichment.setor) updateData.setor = enrichment.setor;
    if (!leadData.contato_decisor && enrichment.decisor) {
      updateData.contato_decisor = `${enrichment.decisor} (${enrichment.cargo_decisor || 'Decisor'})`;
    }
    
    // Sempre adicionar insights
    if (enrichment.insights) {
      updateData.gancho_prospeccao = enrichment.insights;
    }

    const { error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Erro ao atualizar lead: ${error.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: enrichment,
      fieldsUpdated: Object.keys(updateData).length,
      message: `Lead enriquecido com sucesso! ${Object.keys(updateData).length} campos atualizados.`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enrich-lead-with-ai function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
