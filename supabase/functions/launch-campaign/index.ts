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
Você é um especialista em prospecção B2B para abertura de contas PJ no C6 Bank.
Crie um script de vendas personalizado para:

EMPRESA: ${lead.empresa}
SETOR: ${lead.setor || 'Não informado'}
REGIME TRIBUTÁRIO: ${lead.regime_tributario || 'Não informado'}
GANCHO DE PROSPECÇÃO: ${lead.gancho_prospeccao || 'Conta PJ gratuita'}
CONTATO DECISOR: ${lead.contato_decisor || '[Nome]'}

Use como base estes templates, mas personalize para a empresa:

SCRIPT BASE: "Bom dia, [Nome]. Falo com o dono ou sócio da [EMPRESA]? Nós trabalhamos com abertura de conta PJ gratuita no C6 Bank, com Pix ilimitado, 100 TEDs e 100 boletos gratuitos, além de acesso a crédito sujeito a análise. Gostaria de iniciar agora mesmo a abertura da conta ou conduzir uma análise de oportunidade para a sua empresa."

EMAIL BASE: "Prezado [Nome], Identificamos oportunidades para a [EMPRESA] reduzir custos com a abertura de uma conta PJ digital no C6 Bank. Benefícios principais: Conta 100% gratuita, Pix ilimitado, 100 TEDs sem custo, 100 boletos sem custo, Crédito sujeito a análise, Atendimento humano via escritório autorizado. Podemos dar andamento imediato à abertura da conta para a sua empresa?"

Crie um JSON com:
{
  "roteiro_ligacao": "Script personalizado baseado no template, adaptado para o setor da empresa (máx 150 palavras)",
  "assunto_email": "Assunto específico para a empresa (máx 60 caracteres)", 
  "modelo_email": "E-mail personalizado baseado no template, com benefícios específicos do setor (máx 200 palavras)"
}

Foque em:
- Conta PJ gratuita no C6 Bank
- Benefícios específicos (Pix ilimitado, TEDs, boletos gratuitos)
- Acesso a crédito
- Redução de custos bancários
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
  const nomeEmpresa = lead.empresa || '[EMPRESA]';
  const nomeContato = lead.contato_decisor || '[Nome]';
  
  return {
    roteiro_ligacao: `Bom dia, ${nomeContato}. Falo com o dono ou sócio da ${nomeEmpresa}? Nós trabalhamos com abertura de conta PJ gratuita no C6 Bank, com Pix ilimitado, 100 TEDs e 100 boletos gratuitos, além de acesso a crédito sujeito a análise. Gostaria de iniciar agora mesmo a abertura da conta ou conduzir uma análise de oportunidade para a sua empresa.`,
    assunto_email: `Conta PJ gratuita para a ${nomeEmpresa}`,
    modelo_email: `Prezado ${nomeContato},\n\nIdentificamos oportunidades para a ${nomeEmpresa} reduzir custos com a abertura de uma conta PJ digital no C6 Bank.\n\nBenefícios principais:\n\n• Conta 100% gratuita\n• Pix ilimitado\n• 100 TEDs sem custo\n• 100 boletos sem custo\n• Crédito sujeito a análise\n• Atendimento humano via escritório autorizado\n\nPodemos dar andamento imediato à abertura da conta para a sua empresa?\n\nAtenciosamente,\n[Nome do Consultor]`
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
      const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('whatsapp-campaign', {
        body: { 
          campaignId: campaign.id,
          userId: userId
        }
      });

      if (whatsappError) {
        console.warn('WhatsApp campaign failed:', whatsappError);
      } else {
        console.log('WhatsApp campaign triggered successfully:', whatsappResult);
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
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});