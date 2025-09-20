import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const googleGeminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para busca RAG aprimorada
async function performDeepRAGSearch(query: string, userId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .or(`empresa.ilike.%${query}%,setor.ilike.%${query}%,gancho_prospeccao.ilike.%${query}%`)
      .limit(10);

    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .or(`nome.ilike.%${query}%,empresa.ilike.%${query}%,cargo.ilike.%${query}%`)
      .limit(10);

    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*, campaign_scripts(*)')
      .eq('user_id', userId)
      .limit(5);

    const { data: allLeads } = await supabase
      .from('leads')
      .select('status')
      .eq('user_id', userId);

    const totalLeads = allLeads?.length || 0;
    const qualifiedLeads = allLeads?.filter(l => l.status === 'qualificado').length || 0;
    const activeCampaigns = campaigns?.filter(c => c.status === 'ativa').length || 0;

    return {
      totalLeads,
      qualifiedLeads,
      activeCampaigns,
      relevantData: {
        leads: leads || [],
        contacts: contacts || [],
        campaigns: campaigns || []
      },
      recentInteractions: 'Dados carregados do CRM'
    };
  } catch (error) {
    console.error('Erro no deep search:', error);
    return {
      totalLeads: 0,
      qualifiedLeads: 0,
      activeCampaigns: 0,
      relevantData: {
        leads: [],
        contacts: [],
        campaigns: []
      },
      recentInteractions: 'Erro ao carregar dados'
    };
  }
}


serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('RAG Chat function started');
    
    const body = await req.json();
    const { message, userId } = body;
    
    console.log('Processing message:', message?.substring(0, 50), 'for user:', userId);

    if (!message || !userId) {
      return new Response(JSON.stringify({ 
        response: 'Parâmetros obrigatórios em falta: message e userId são necessários.',
        error: 'Missing required parameters'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!googleGeminiApiKey) {
      return new Response(JSON.stringify({ 
        response: 'Google Gemini API key não configurada. Configure a chave nas configurações.',
        error: 'Google Gemini API key missing'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Buscar dados do CRM
    console.log('Fetching CRM data...');
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .limit(5);

    console.log('Found leads:', leads?.length || 0);

    // Detectar comandos e intenções avançadas
    const lowerMessage = message.toLowerCase();
    let actionDetected = null;

    // Comandos existentes
    if (lowerMessage.includes('criar prospects') || lowerMessage.includes('nova campanha')) {
      actionDetected = 'generate_prospects';
    } else if (lowerMessage.includes('qualificar')) {
      actionDetected = 'qualify_leads';
    }
    
    // Novos comandos - Agendamento
    else if (lowerMessage.includes('agendar ligação') || lowerMessage.includes('marcar reunião') || 
             lowerMessage.includes('agendar reunião') || lowerMessage.includes('falar com consultor') ||
             lowerMessage.includes('marcar ligação') || lowerMessage.includes('agendar call')) {
      actionDetected = 'schedule_meeting';
    }
    
    // Novos comandos - Propostas
    else if (lowerMessage.includes('enviar proposta') || lowerMessage.includes('gerar proposta') ||
             lowerMessage.includes('fazer proposta') || lowerMessage.includes('proposta comercial') ||
             lowerMessage.includes('quanto custa') || lowerMessage.includes('preço do serviço')) {
      actionDetected = 'generate_proposal';
    }
    
    // Novos comandos - Conteúdo/Marketing
    else if (lowerMessage.includes('criar conteúdo') || lowerMessage.includes('post linkedin') ||
             lowerMessage.includes('reel instagram') || lowerMessage.includes('mensagem whatsapp') ||
             lowerMessage.includes('engajar lead') || lowerMessage.includes('campanha de conteúdo')) {
      actionDetected = 'generate_content';
    }
    
    // Redirecionamento para humano
    else if (lowerMessage.includes('falar com humano') || lowerMessage.includes('atendente') ||
             lowerMessage.includes('pessoa') || lowerMessage.includes('não entendi') ||
             lowerMessage.includes('preciso de ajuda') || lowerMessage.includes('suporte humano')) {
      actionDetected = 'redirect_to_human';
    }

    // Análise de sentimento para todas as mensagens
    let sentimentAnalysis = null;
    try {
      const sentimentResponse = await fetch(`${supabaseUrl}/functions/v1/sentiment-analysis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: message,
          userId: userId,
          conversationHistory: [] // Poderia passar histórico real aqui
        })
      });

      if (sentimentResponse.ok) {
        const sentimentData = await sentimentResponse.json();
        sentimentAnalysis = sentimentData.analysis;
        
        // Se análise indica redirecionamento, sobrescrever ação
        if (sentimentAnalysis?.redirect_to_human && !actionDetected) {
          actionDetected = 'redirect_to_human';
        }
      }
    } catch (error) {
      console.log('Análise de sentimento falhou, continuando sem ela:', error.message);
    }

    console.log('Action detected:', actionDetected);
    console.log('Sentiment analysis:', sentimentAnalysis);

    // Executar ações baseadas na detecção
    if (actionDetected === 'generate_prospects') {
      try {
        console.log('Calling generate-prospects function...');
        
        const prospectResponse = await fetch(`${supabaseUrl}/functions/v1/generate-prospects`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId })
        });

        console.log('Generate prospects response status:', prospectResponse.status);

        if (prospectResponse.ok) {
          const result = await prospectResponse.json();
          
          if (result.success) {
            return new Response(JSON.stringify({ 
              response: `✅ **Prospects Criados com Sucesso!**\n\n${result.message}\n\n📊 **Total de prospects gerados:** ${result.totalLeads || 'N/A'}\n\n🎯 **Próximo passo:** Use o comando "Qualificar Prospects" para refinar sua lista.`,
              actionExecuted: actionDetected,
              crmStats: { leads: result.totalLeads }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } else {
            throw new Error(result.error || 'Erro desconhecido na geração de prospects');
          }
        } else {
          const errorText = await prospectResponse.text();
          console.error('Generate prospects error response:', errorText);
          
          let errorMessage = 'Erro interno na geração de prospects';
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.log('Could not parse error response, using status text');
            errorMessage = prospectResponse.statusText || errorMessage;
          }
          
          throw new Error(`Erro ${prospectResponse.status}: ${errorMessage}`);
        }
      } catch (error) {
        console.error('Error calling generate-prospects:', error);
        
        let userFriendlyMessage = 'Erro ao criar prospects. ';
        
        if (error.message.includes('500')) {
          userFriendlyMessage += 'Problema interno no servidor de IA. Tente novamente em alguns minutos.';
        } else if (error.message.includes('Gemini')) {
          userFriendlyMessage += 'Verifique se a API do Google Gemini está configurada corretamente.';
        } else {
          userFriendlyMessage += error.message;
        }
        
        return new Response(JSON.stringify({ 
          response: `❌ **Erro na Criação de Prospects**\n\n${userFriendlyMessage}\n\n🔧 **Soluções:**\n• Verifique sua conexão com a internet\n• Aguarde alguns minutos e tente novamente\n• Verifique se as chaves de API estão configuradas`,
          error: error.message
        }), {
          status: 200, // Changed to 200 to avoid client-side error handling
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Ação: Agendamento de ligação/reunião
    else if (actionDetected === 'schedule_meeting') {
      try {
        console.log('Calling calendar-integration function...');
        
        // Para demonstração, usar dados do primeiro lead disponível
        const { data: sampleLead } = await supabase
          .from('leads')
          .select('*')
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (!sampleLead) {
          return new Response(JSON.stringify({ 
            response: `❌ **Erro no Agendamento**\n\nPara agendar uma ligação, preciso ter pelo menos um lead cadastrado no seu CRM.\n\n🎯 **Como resolver:**\n• Primeiro use "Criar Prospects" para gerar leads\n• Depois poderá agendar ligações com eles`,
            actionExecuted: actionDetected
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const scheduleResponse = await fetch(`${supabaseUrl}/functions/v1/calendar-integration`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId: sampleLead.id,
            userId: userId,
            leadEmail: sampleLead.email || 'lead@exemplo.com',
            leadName: sampleLead.contato_decisor || sampleLead.empresa,
            meetingType: 'call',
            duration: 60,
            notes: `Agendamento solicitado via WhatsApp RAG para ${sampleLead.empresa}`
          })
        });

        console.log('Calendar integration response status:', scheduleResponse.status);

        if (scheduleResponse.ok) {
          const result = await scheduleResponse.json();
          
          if (result.success) {
            return new Response(JSON.stringify({ 
              response: `🗓️ **Ligação Agendada com Sucesso!**\n\n${result.whatsappMessage}\n\n📊 **Detalhes:**\n• ID do Evento: ${result.eventId}\n• Link da Reunião: ${result.meetingLink}\n\n✅ **Próximos passos:** Um convite será enviado por e-mail com todos os detalhes.`,
              actionExecuted: actionDetected,
              scheduleData: result
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } else {
            throw new Error(result.error || 'Erro desconhecido no agendamento');
          }
        } else {
          const errorText = await scheduleResponse.text();
          console.error('Calendar integration error response:', errorText);
          throw new Error(`Erro ${scheduleResponse.status}: ${errorText}`);
        }
      } catch (error) {
        console.error('Error calling calendar-integration:', error);
        
        return new Response(JSON.stringify({ 
          response: `❌ **Erro no Agendamento**\n\n${error.message}\n\n🔧 **Soluções:**\n• Verifique se você tem leads cadastrados\n• Tente especificar data e horário\n• Use: "Agendar ligação para amanhã às 14h"`,
          error: error.message
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Ação: Geração de proposta
    else if (actionDetected === 'generate_proposal') {
      try {
        console.log('Calling proposal-generator function...');
        
        // Buscar lead mais promissor para proposta
        const { data: qualifiedLead } = await supabase
          .from('leads')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'qualificado')
          .limit(1)
          .single();

        const targetLead = qualifiedLead || leads?.[0];

        if (!targetLead) {
          return new Response(JSON.stringify({ 
            response: `❌ **Erro na Geração de Proposta**\n\nPara gerar uma proposta, preciso ter leads cadastrados no seu CRM.\n\n🎯 **Como resolver:**\n• Use "Criar Prospects" para gerar leads\n• Qualifique leads com "Qualificar Prospects"\n• Depois poderá gerar propostas personalizadas`,
            actionExecuted: actionDetected
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const proposalResponse = await fetch(`${supabaseUrl}/functions/v1/proposal-generator`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId: targetLead.id,
            userId: userId,
            leadData: targetLead
          })
        });

        console.log('Proposal generator response status:', proposalResponse.status);

        if (proposalResponse.ok) {
          const result = await proposalResponse.json();
          
          if (result.success) {
            const shortProposal = result.proposal.substring(0, 500) + '...';
            
            return new Response(JSON.stringify({ 
              response: `📋 **Proposta Comercial Gerada!**\n\n${result.whatsappMessage}\n\n📄 **Prévia da Proposta:**\n${shortProposal}\n\n✅ **ID da Proposta:** ${result.proposalId}\n\n📧 **A proposta completa será enviada por e-mail**`,
              actionExecuted: actionDetected,
              proposalData: result
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } else {
            throw new Error(result.error || 'Erro desconhecido na geração de proposta');
          }
        } else {
          const errorText = await proposalResponse.text();
          console.error('Proposal generator error response:', errorText);
          throw new Error(`Erro ${proposalResponse.status}: ${errorText}`);
        }
      } catch (error) {
        console.error('Error calling proposal-generator:', error);
        
        return new Response(JSON.stringify({ 
          response: `❌ **Erro na Geração de Proposta**\n\n${error.message}\n\n🔧 **Soluções:**\n• Verifique se você tem leads qualificados\n• Use "Qualificar Prospects" primeiro\n• Especifique o tipo de serviço desejado`,
          error: error.message
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Ação: Geração de conteúdo
    else if (actionDetected === 'generate_content') {
      try {
        console.log('Calling content-agent function...');
        
        const targetLead = leads?.[0];
        if (!targetLead) {
          return new Response(JSON.stringify({ 
            response: `❌ **Erro na Geração de Conteúdo**\n\nPara gerar conteúdo personalizado, preciso ter leads cadastrados.\n\n🎯 **Como resolver:**\n• Use "Criar Prospects" primeiro\n• Depois especifique: "Post LinkedIn para [empresa]"\n• Ou: "Reel Instagram sobre tributação"`,
            actionExecuted: actionDetected
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Determinar tipo de conteúdo baseado na mensagem
        let contentType = 'whatsapp-message';
        if (lowerMessage.includes('linkedin')) contentType = 'linkedin-post';
        else if (lowerMessage.includes('instagram') || lowerMessage.includes('reel')) contentType = 'instagram-reel';
        else if (lowerMessage.includes('facebook')) contentType = 'facebook-post';

        const contentResponse = await fetch(`${supabaseUrl}/functions/v1/content-agent`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId: targetLead.id,
            userId: userId,
            contentType: contentType,
            leadData: targetLead,
            tone: 'consultative'
          })
        });

        console.log('Content agent response status:', contentResponse.status);

        if (contentResponse.ok) {
          const result = await contentResponse.json();
          
          if (result.success) {
            const shortContent = result.content.substring(0, 400) + '...';
            
            return new Response(JSON.stringify({ 
              response: `🎨 **Conteúdo ${result.contentType.toUpperCase()} Gerado!**\n\n**Para:** ${result.metadata.leadName}\n**Plataforma:** ${result.metadata.platform}\n\n📝 **Prévia:**\n${shortContent}\n\n✅ **ID do Conteúdo:** ${result.contentId}\n\n🚀 **Próximo passo:** Revisar e publicar o conteúdo nas redes sociais`,
              actionExecuted: actionDetected,
              contentData: result
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } else {
            throw new Error(result.error || 'Erro desconhecido na geração de conteúdo');
          }
        } else {
          const errorText = await contentResponse.text();
          console.error('Content agent error response:', errorText);
          throw new Error(`Erro ${contentResponse.status}: ${errorText}`);
        }
      } catch (error) {
        console.error('Error calling content-agent:', error);
        
        return new Response(JSON.stringify({ 
          response: `❌ **Erro na Geração de Conteúdo**\n\n${error.message}\n\n🔧 **Tipos disponíveis:**\n• "Post LinkedIn sobre tributação"\n• "Reel Instagram para agroindústria"\n• "Mensagem WhatsApp personalizada"`,
          error: error.message
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Ação: Redirecionamento para humano
    else if (actionDetected === 'redirect_to_human') {
      console.log('Redirecting to human agent...');
      
      const redirectMessage = sentimentAnalysis?.sentiment === 'frustrated' 
        ? `😔 **Entendo sua frustração e estou aqui para ajudar!**\n\nVou conectar você com um dos nossos consultores especialistas que poderá dar atenção personalizada ao seu caso.\n\n👨‍💼 **Um consultor entrará em contato em até 30 minutos via:**\n• WhatsApp\n• Ligação telefônica\n• E-mail\n\n📋 **Seu caso foi marcado como prioridade ${sentimentAnalysis?.urgency_level || 'alta'}**\n\nEnquanto isso, posso tentar esclarecer alguma dúvida específica?`
        : `👨‍💼 **Conectando com Consultor Humano**\n\nEntendi que você gostaria de falar com um de nossos consultores especializados.\n\n⏰ **Tempo de resposta:** Até 1 hora\n📞 **Contato:** WhatsApp ou telefone\n📧 **E-mail:** Resumo da conversa será enviado\n\n💡 **Enquanto aguarda, posso:**\n• Gerar propostas comerciais\n• Agendar ligações\n• Criar prospects\n• Qualificar leads\n\nPrecisa de algo específico agora?`;

      return new Response(JSON.stringify({ 
        response: redirectMessage,
        actionExecuted: actionDetected,
        sentimentAnalysis: sentimentAnalysis,
        humanRedirect: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resposta padrão da IA com contexto melhorado
    console.log('Calling Google Gemini for standard response...');
    
    const systemPrompt = `Você é um PHD em Contabilidade e Finanças especialista em consultoria tributária para grandes empresas.

CONHECIMENTO ESPECIALIZADO:
- Recuperação de créditos tributários (ICMS, PIS/COFINS, IRPJ/CSLL)
- Planejamento tributário avançado para multinacionais
- Compliance e auditoria fiscal
- Incentivos fiscais e regimes especiais
- Reestruturação societária com otimização tributária

DADOS DO CRM ATUAL:
- Leads cadastrados: ${leads?.length || 0}

COMANDOS DISPONÍVEIS:
1. "Criar Prospects" - Gera novos prospects com IA
2. "Qualificar Prospects/Leads" - Qualifica leads existentes  
3. "Agendar Ligação" - Agenda reuniões e calls
4. "Gerar Proposta" - Cria propostas comerciais personalizadas
5. "Criar Conteúdo" - Gera posts LinkedIn, Reels Instagram, mensagens WhatsApp
6. "Falar com Humano" - Conecta com consultor especialista

FUNCIONALIDADES AVANÇADAS:
- Análise de sentimento em tempo real
- Detecção automática de urgência e frustração
- Redirecionamento inteligente para atendimento humano
- Geração de conteúdo para redes sociais
- Integração com calendário para agendamentos
- Propostas comerciais com IA

CONTEXTO DE CAMPANHA:
Você atende clientes via WhatsApp, ligações e emails sobre:
- Oportunidades de recuperação tributária
- Estratégias de redução de carga fiscal
- Compliance e blindagem jurídica
- Diagnósticos tributários gratuitos

Sempre responda de forma técnica, consultiva e com foco em gerar valor para grandes corporações.`;

    // Ponto principal de alteração
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
                text: systemPrompt + '\n\n' + message
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.5
        }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Limite de requisições atingido. Aguarde alguns minutos e tente novamente.');
      }
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Novo tratamento da resposta para o formato do Gemini
    let aiResponse = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      aiResponse = data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Resposta inválida da IA. Estrutura de dados inesperada.');
    }

    console.log('Google Gemini response received successfully');

    // Incluir informações de sentimento na resposta se disponível
    const responseData: any = {
      response: aiResponse,
      actionExecuted: actionDetected,
      crmStats: {
        leads: leads?.length || 0
      }
    };

    if (sentimentAnalysis) {
      responseData.sentimentAnalysis = sentimentAnalysis;
      
      // Ajustar tom da resposta baseado no sentimento
      if (sentimentAnalysis.sentiment === 'frustrated' && !actionDetected) {
        responseData.response = `😔 **Percebo que você pode estar com dificuldades. Estou aqui para ajudar!**\n\n${aiResponse}\n\n💡 **Posso também:**\n• Conectar você com um consultor humano\n• Agendar uma ligação personalizada\n• Gerar uma proposta específica para seu caso\n\nDiga como prefere prosseguir!`;
      } else if (sentimentAnalysis.urgency_level === 'high' || sentimentAnalysis.urgency_level === 'critical') {
        responseData.response = `⚡ **Urgência Detectada - Priorizando seu Atendimento**\n\n${aiResponse}\n\n🚀 **Ações rápidas disponíveis:**\n• "Falar com Humano" - Contato imediato\n• "Agendar Ligação" - Para hoje mesmo\n• "Gerar Proposta" - Resposta comercial rápida`;
      }
    }

    // Store interaction in knowledge base for training
    try {
      console.log('Storing interaction in knowledge base...');
      const knowledgeEntry = {
        user_id: userId,
        content: `User Question: ${message} | AI Response: ${responseData.response}`,
        generated_at: new Date().toISOString()
      };
      
      const { data: insertResult, error: insertError } = await supabase
        .from('campaign_knowledge')
        .insert(knowledgeEntry);
        
      if (insertError) {
        console.error('Knowledge base insert error:', insertError);
      } else {
        console.log('Interaction stored successfully in knowledge base');
      }
    } catch (error) {
      console.error('Error storing interaction:', error);
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in rag-chat function:', error);
    return new Response(JSON.stringify({ 
      response: `Desculpe, ocorreu um erro: ${error.message}. Tente novamente em alguns momentos.`,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});