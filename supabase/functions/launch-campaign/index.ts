import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para gerar scripts personalizados com IA
async function generatePersonalizedScript(lead: any) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    console.log('OpenAI API Key not found, using template script');
    return generateTemplateScript(lead);
  }

  try {
    const prompt = `
Você é um especialista em prospecção B2B para uma agência de contabilidade em Goiás.
Crie um script de vendas personalizado para:

EMPRESA: ${lead.empresa}
SETOR: ${lead.setor || 'Não informado'}
REGIME TRIBUTÁRIO: ${lead.regime_tributario || 'Não informado'}
GANCHO DE PROSPECÇÃO: ${lead.gancho_prospeccao || 'Oportunidade fiscal'}
CONTATO DECISOR: ${lead.contato_decisor || '[Nome]'}

Crie um JSON com:
{
  "roteiro_ligacao": "Script de telefone direto, objetivo, mencionando ganhos específicos (máx 150 palavras)",
  "assunto_email": "Assunto atrativo e específico (máx 60 caracteres)", 
  "modelo_email": "E-mail personalizado, profissional, com CTA claro (máx 200 palavras)"
}

Foque em:
- Recuperação tributária (ICMS, PIS/COFINS)
- Compliance e planejamento fiscal
- Benefícios específicos do setor
- Linguagem executiva e direta
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Clean and parse the JSON response
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
    console.error('Error generating AI script:', error);
    return generateTemplateScript(lead);
  }
}

// Função para gerar script template quando IA não está disponível
function generateTemplateScript(lead: any) {
  return {
    roteiro_ligacao: `Bom dia, falo com ${lead.contato_decisor || '[Nome]'}? Sou da [Agência], especializada em recuperação tributária. Identificamos oportunidades na ${lead.empresa} relacionadas a ${lead.gancho_prospeccao || 'créditos fiscais'}. Posso explicar como maximizar esses benefícios em 15 minutos?`,
    assunto_email: `Oportunidades fiscais para ${lead.empresa}`,
    modelo_email: `Prezado ${lead.contato_decisor || '[Nome]'},\n\nIdentificamos oportunidades de recuperação tributária na ${lead.empresa}, especificamente relacionadas a ${lead.gancho_prospeccao || 'créditos de ICMS e benefícios fiscais'}.\n\nAtuamos com empresas do setor ${lead.setor || 'similar'} para maximizar créditos e reduzir passivos tributários.\n\nPodemos agendar 20 minutos para apresentar os ganhos potenciais?\n\nAtenciosamente,\n[Seu Nome]`
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Launch campaign function started');
    
    const body = await req.json();
    const { userId } = body;
    
    console.log('Processing campaign launch for user:', userId);

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
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configuração do Supabase não encontrada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Fetching hot and warm leads from CRM...');
    
    // Buscar leads qualificados e contatados do CRM
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['qualificado', 'contatado']);

    if (leadsError) {
      console.error('Erro ao buscar leads:', leadsError);
      throw new Error(`Erro ao buscar leads: ${leadsError.message}`);
    }

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Nenhum lead qualificado ou contatado encontrado no CRM. Qualifique leads primeiro.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${leads.length} qualified/contacted leads`);
    
    console.log('Creating campaign...');
    
    // Criar nova campanha
    const targetCompanies = leads.map(lead => lead.empresa);
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        name: `Campanha CRM - ${new Date().toLocaleDateString('pt-BR')}`,
        description: `Campanha para ${leads.length} leads qualificados e contatados do CRM`,
        target_companies: targetCompanies,
        status: 'ativa'
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Erro ao criar campanha:', campaignError);
      throw new Error(`Erro ao criar campanha: ${campaignError.message}`);
    }

    console.log('Campaign created with ID:', campaign.id);
    
    // Gerar scripts personalizados para cada lead
    console.log('Generating personalized scripts...');
    const campaignScriptsData = [];
    
    for (const lead of leads) {
      try {
        console.log(`Generating script for ${lead.empresa}...`);
        const script = await generatePersonalizedScript(lead);
        
        campaignScriptsData.push({
          campaign_id: campaign.id,
          empresa: lead.empresa,
          roteiro_ligacao: script.roteiro_ligacao,
          assunto_email: script.assunto_email,
          modelo_email: script.modelo_email
        });
      } catch (error) {
        console.error(`Error generating script for ${lead.empresa}:`, error);
        // Continue with other leads if one fails
      }
    }

    if (campaignScriptsData.length === 0) {
      throw new Error('Não foi possível gerar nenhum script para os leads');
    }

    // Inserir roteiros da campanha
    const { error: scriptsError } = await supabase
      .from('campaign_scripts')
      .insert(campaignScriptsData);

    if (scriptsError) {
      console.error('Erro ao inserir roteiros:', scriptsError);
      throw new Error(`Erro ao criar roteiros: ${scriptsError.message}`);
    }

    console.log(`Campaign scripts created successfully for ${campaignScriptsData.length} companies`);

    // Chamar função de WhatsApp para enviar mensagens
    console.log('Calling WhatsApp function...');
    
    try {
      const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-campaign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          campaignId: campaign.id,
          userId: userId
        })
      });

      if (whatsappResponse.ok) {
        console.log('WhatsApp campaign triggered successfully');
      } else {
        console.warn('WhatsApp campaign failed:', await whatsappResponse.text());
      }
    } catch (whatsappError) {
      console.warn('Erro ao disparar WhatsApp (não crítico):', whatsappError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `✅ **Campanha Criada com Sucesso!**\n\nCampanha "${campaign.name}" foi criada com ${campaignScriptsData.length} roteiros personalizados baseados no seu CRM.\n\n📊 **Empresas incluídas:** ${targetCompanies.join(', ')}\n\n🚀 **Próximos passos automáticos:**\n- WhatsApp será enviado para prospects qualificados\n- E-mails de follow-up serão disparados\n- RAG AI fará o acompanhamento das respostas\n\nVocê pode acompanhar o progresso na aba de Campanhas!`,
      campaignId: campaign.id,
      totalScripts: campaignScriptsData.length,
      companies: targetCompanies
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in launch-campaign function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});