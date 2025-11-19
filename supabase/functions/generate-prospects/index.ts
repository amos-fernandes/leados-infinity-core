import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const googleGeminiApiKey = Deno.env.get('GEMINI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

console.log('Environment check:', {
  hasGeminiKey: !!googleGeminiApiKey,
  hasSupabaseUrl: !!supabaseUrl,
  hasServiceKey: !!supabaseServiceKey
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    console.log('Generate prospects function started');
    
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    const { userId } = body;
    console.log('Generating prospects for user:', userId, 'Body received:', body);
    
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'UserId é obrigatório'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!googleGeminiApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Google Gemini API key não configurada'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const prompt = `
    Você é um especialista em inteligência de mercado focado em prospecção B2B para uma analise contábil e tributária especializada em medias empresas na cidade de goiania, estado de Goias.

    REGRAS OBRIGATÓRIAS DE FILTRO:
    1. NUNCA incluir empresas MEI (Microempreendedor Individual)
    2. APENAS empresas com faturamento anual até R$ 1.000.000,00 (um milhão de reais)
    3. Focar em empresas EPP (Empresa de Pequeno Porte) e DEMAIS
    
    Sua tarefa é identificar EXATAMENTE 50 prospects de alto potencial que atendam TODOS os critérios acima nas seguintes áreas:
KNOWLEDGE BASE - CAMPANHAS DE PROSPECÇÃO
Sistema Integrado CRM + WhatsApp + E-mail + IA

EXPERTISE DO AGENTE IA

=================================

Conhecimento Base - Especialista em Abertura de Conta PJ Digital

Foco exclusivo em abertura de conta C6 Bank PJ via escritório autorizado Infinity

Especialização em prospecção B2B (todos os CNPJs, exceto MEI e terceiro setor)

Conhecimento avançado em benefícios de conta PJ digital: Pix ilimitado, 100 TEDs gratuitos, 100 boletos gratuitos, acesso a crédito (sujeito a análise)

Expertise em relacionamento humano + atendimento digital

Atuação em consultoria empresarial como diferencial agregado

Setores de Atuação Prioritários

Todo e qualquer setor com CNPJ ativo (nacional)

EXCLUSÕES OBRIGATÓRIAS:
- MEI (Microempreendedor Individual) - NUNCA INCLUIR
- Terceiro setor
- Empresas com faturamento acima de R$ 1.000.000,00/ano

PERFIL IDEAL:
- EPP (Empresa de Pequeno Porte) ou DEMAIS
- Faturamento anual: R$ 100.000,00 até R$ 1.000.000,00
- CNPJ ativo e regularizado

ESTRATÉGIAS DE PROSPECÇÃO

=================================

Metodologia BANT Adaptada

Budget: Faturamento entre R$ 100.000,00 e R$ 1.000.000,00/ano (OBRIGATÓRIO)

Authority: Dono ou sócio da empresa (decisor obrigatório)

Need: Necessidade de crédito (sujeito a análise) e redução de custos bancários

Timing: Interesse imediato em abertura de conta, migração ou redução de custos

IMPORTANTE: Cada prospect gerado DEVE ter faturamento estimado dentro do limite de R$ 1.000.000,00

Ganchos de Prospecção (Fontes Auditáveis)

Financeiro:

Necessidade de crédito (sujeito a análise)

Custos elevados em transações (Pix/TED)

Custos com emissão de boletos

Operacional:

Empresas em expansão que precisam de soluções ágeis

Empresas que buscam serviços digitais sem perder atendimento humano

TEMPLATES DE COMUNICAÇÃO

=================================

Script de Ligação Base

"Bom dia, [Nome]. Falo com o dono ou sócio da [EMPRESA]? Nós trabalhamos com abertura de conta PJ gratuita no C6 Bank, com Pix ilimitado, 100 TEDs e 100 boletos gratuitos, além de acesso a crédito sujeito a análise. Gostaria de iniciar agora mesmo a abertura da conta ou conduzir uma análise de oportunidade para a sua empresa."

Template E-mail Base

Assunto: Conta PJ gratuita para a [Nome da Empresa]

Prezado [Nome],

Identificamos oportunidades para a [EMPRESA] reduzir custos com a abertura de uma conta PJ digital no C6 Bank.

Benefícios principais:

Conta 100% gratuita

Pix ilimitado

100 TEDs sem custo

100 boletos sem custo

Crédito sujeito a análise

Atendimento humano via escritório autorizado

Podemos dar andamento imediato à abertura da conta para a sua empresa?

Atenciosamente,
[Nome do Consultor]

Template WhatsApp

🏢 Olá [Nome]!

Conferimos o CNPJ [CNPJ] da [EMPRESA] e identificamos que você pode se beneficiar de uma conta PJ gratuita no C6 Bank.

💡 Benefícios imediatos:
✅ Pix ilimitado
✅ 100 TEDs gratuitos
✅ 100 boletos gratuitos
✅ Crédito sujeito a análise
✅ Atendimento humano via escritório autorizado

🎯 Você tem interesse em aproveitar esses benefícios ou prefere receber uma proposta detalhada para sua empresa?

FLUXO DE CAMPANHA AUTOMATIZADA

=================================

Fase 1: Identificação (IA)

Prospecção web de empresas com CNPJ ativo

Exclusão automática de MEI e terceiro setor

Qualificação por decisor (dono/sócio)

Fase 2: Abordagem Multi-canal

WhatsApp (foco principal)

Ligação (apoio)

E-mail (reforço)

Fase 3: Qualificação Avançada

Validação da necessidade de redução de custos ou crédito sujeito a análise

Envio de benefícios claros (Pix, TEDs e boletos gratuitos)

Proposta imediata: abertura de conta

Fase 4: Acompanhamento

CRM integrado com histórico

Automação de follow-ups

Tracking de conversões

INDICADORES DE PERFORMANCE

=================================

Métricas de Prospecção

Taxa de resposta WhatsApp: >3%

Taxa de conexão telefônica: >15%

Taxa de abertura e-mail: >?%

Taxa de abertura de conta: >30%

Métricas de Conversão

Lead para abertura de conta: >30%

Ticket médio indireto (via crédito): variável conforme análise

COMPLIANCE E FONTES DE DADOS

=================================

Fontes Auditáveis Aprovadas

Receita Federal (consulta CNPJs ativos)

Juntas Comerciais

Sites oficiais das empresas

Imprensa especializada

Protocolos de Verificação

Sempre validar CNPJ ativo

Confirmar decisor (dono/sócio)

Evitar prospecção em MEI e terceiro setor

Usar somente dados públicos ou fornecidos pelo prospect

ATUALIZAÇÃO CONTÍNUA

=================================
Este knowledge base é atualizado automaticamente com:

Novos prospects identificados

Scripts testados e otimizados

Resultados de campanhas

Feedback dos consultores

Alterações em políticas do C6 Bank PJ
    Retorne APENAS um JSON válido no formato:
        {
          "prospects": [
            {
              "empresa": "Nome da Empresa S.A.",
              "setor": "Agroindústria - Açúcar e Etanol", 
              "cnae": "1071-6/00",
              "regime_tributario": "Lucro Real",
              "contato_decisor": "João Silva (CFO)",
              "telefone": "(62) 3321-8200",
              "email": "joao.silva@empresa.com.br",
              "website": "empresa.com.br",
              "gancho_prospeccao": "Investimentos recentes em expansão, problemas fiscais"
            }
          ]
        }`;

    console.log('Calling Google Gemini API...');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleGeminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
          temperature: 0.5
        }
      })
    });
    
    console.log('Google Gemini response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Limite de requisições do Google Gemini atingido. Aguarde alguns minutos.');
      }
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    let content = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      content = data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Resposta inválida da IA. Estrutura de dados inesperada.');
    }
    
    console.log('Parsing Google Gemini response...');
    console.log('Raw content from Gemini:', content.substring(0, 200));
    
    let cleanedContent = ''; // Initialize cleanedContent outside try block
    let prospectsData;
    try {
      // Clean the content more thoroughly
      cleanedContent = content.trim();
      
      // Remove markdown code blocks if present
      cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Find the JSON object in the response - look for the first { and last }
      const jsonStart = cleanedContent.indexOf('{');
      let jsonEnd = cleanedContent.lastIndexOf('}');
      
      if (jsonStart === -1) {
        console.error('No opening brace found in response');
        throw new Error('Resposta da IA não contém JSON válido');
      }
      
      // If no closing brace found, the response might be truncated
      if (jsonEnd === -1 || jsonEnd <= jsonStart) {
        console.log('JSON appears to be truncated, attempting to reconstruct');
        
        // Try to find the end of the prospects array
        const prospectsStart = cleanedContent.indexOf('"prospects"');
        if (prospectsStart !== -1) {
          // Find the array opening bracket
          const arrayStart = cleanedContent.indexOf('[', prospectsStart);
          if (arrayStart !== -1) {
            // Find the last complete prospect object
            let lastCompleteObject = arrayStart;
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            
            for (let i = arrayStart + 1; i < cleanedContent.length; i++) {
              const char = cleanedContent[i];
              
              if (escapeNext) {
                escapeNext = false;
                continue;
              }
              
              if (char === '\\') {
                escapeNext = true;
                continue;
              }
              
              if (char === '"') {
                inString = !inString;
                continue;
              }
              
              if (!inString) {
                if (char === '{') {
                  braceCount++;
                } else if (char === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    lastCompleteObject = i;
                  }
                }
              }
            }
            
            if (lastCompleteObject > arrayStart) {
              // Reconstruct the JSON with complete objects only
              cleanedContent = '{"prospects": [' + 
                cleanedContent.substring(arrayStart + 1, lastCompleteObject + 1) + 
                ']}';
              console.log('Reconstructed JSON from truncated response');
            }
          }
        }
      } else {
        cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
      }
      
      console.log('Cleaned JSON content length:', cleanedContent.length);
      
      prospectsData = JSON.parse(cleanedContent);
      console.log('Successfully parsed JSON, prospects count:', prospectsData?.prospects?.length || 0);
      
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Erro de parsing desconhecido';
      console.error('JSON parse error:', errorMessage);
      console.error('Content that failed to parse:', content.substring(0, 500) + '...');
      if (cleanedContent) {
        console.error('Cleaned content length:', cleanedContent.length);
        console.error('Cleaned content start:', cleanedContent.substring(0, 200));
        console.error('Cleaned content end:', cleanedContent.substring(-200));
      }
      
      // Try alternative parsing - extract complete objects manually
      try {
        const prospectsMatch = content.match(/"prospects"\s*:\s*\[/);
        if (prospectsMatch) {
          const startIndex = content.indexOf('"prospects"');
          const arrayStart = content.indexOf('[', startIndex);
          
          if (arrayStart !== -1) {
            // Find complete objects
            const prospectObjects = [];
            let currentPos = arrayStart + 1;
            let objectCount = 0;
            
            while (currentPos < content.length && objectCount < 15) { // Limit to 15 objects max
              // Find start of next object
              const objStart = content.indexOf('{', currentPos);
              if (objStart === -1) break;
              
              // Find end of this object
              let braceCount = 1;
              let pos = objStart + 1;
              let inString = false;
              let escaped = false;
              
              while (pos < content.length && braceCount > 0) {
                const char = content[pos];
                
                if (escaped) {
                  escaped = false;
                } else if (char === '\\') {
                  escaped = true;
                } else if (char === '"' && !escaped) {
                  inString = !inString;
                } else if (!inString) {
                  if (char === '{') braceCount++;
                  else if (char === '}') braceCount--;
                }
                pos++;
              }
              
              if (braceCount === 0) {
                const objStr = content.substring(objStart, pos);
                try {
                  const testObj = JSON.parse(objStr);
                  if (testObj.empresa) { // Validate it has required fields
                    prospectObjects.push(objStr);
                    objectCount++;
                  }
                } catch (objParseError) {
                  console.log(`Skipping malformed object at position ${objStart}`);
                }
              }
              
              currentPos = pos;
            }
            
            if (prospectObjects.length > 0) {
              const reconstructedJson = `{"prospects":[${prospectObjects.join(',')}]}`;
              prospectsData = JSON.parse(reconstructedJson);
              console.log(`Successfully reconstructed JSON with ${prospectObjects.length} prospects`);
            } else {
              throw new Error('Could not extract any valid prospect objects');
            }
          } else {
            throw new Error('Could not find prospects array start');
          }
        } else {
          throw new Error('Could not find prospects array in response');
        }
      } catch (altParseError) {
        const altErrorMessage = altParseError instanceof Error ? altParseError.message : 'Erro de parsing alternativo desconhecido';
        console.error('Alternative parsing also failed:', altErrorMessage);
        throw new Error('Resposta inválida da IA. A resposta não está em formato JSON válido.');
      }
    }

    if (!prospectsData.prospects || !Array.isArray(prospectsData.prospects)) {
      throw new Error('Estrutura de dados inválida da IA');
    }

    console.log('Saving to database...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configuração do Supabase não encontrada');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const leadsToInsert = prospectsData.prospects.map((prospect: any) => ({
      user_id: userId,
      empresa: prospect.empresa,
      setor: prospect.setor,
      cnae: prospect.cnae,
      regime_tributario: prospect.regime_tributario,
      contato_decisor: prospect.contato_decisor,
      telefone: prospect.telefone,
      email: prospect.email,
      website: prospect.website,
      gancho_prospeccao: prospect.gancho_prospeccao,
      status: 'novo'
    }));

    const { data: insertedLeads, error: insertError } = await supabase.from('leads').insert(leadsToInsert).select();
    
    if (insertError) {
      console.error('Database error:', insertError);
      throw new Error(`Erro no banco de dados: ${insertError.message}`);
    }
    
    // Salvar nos contatos
    const contactsToInsert = prospectsData.prospects.map((prospect: any) => ({
      user_id: userId,
      nome: prospect.contato_decisor,
      empresa: prospect.empresa,
      cargo: prospect.contato_decisor.includes('(') ? prospect.contato_decisor.split('(')[1].replace(')', '') : 'Decisor',
      email: prospect.email,
      telefone: prospect.telefone,
      website: prospect.website,
      status: 'ativo'
    }));

    await supabase.from('contacts').insert(contactsToInsert);
    
    console.log('Success! Generated', insertedLeads?.length || 0, 'prospects');
    
    return new Response(JSON.stringify({
      success: true,
      message: `${prospectsData.prospects.length} prospects gerados e cadastrados com sucesso!`,
      prospects: insertedLeads
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in generate-prospects function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});